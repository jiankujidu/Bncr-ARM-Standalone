#!/usr/bin/env node
/**
 * Bncr-ARM Standalone v3.3.0
 * Termux优化版本 - 使用Cookie认证 + Token管理
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const WORK_DIR = process.env.BNCR_DATA || path.join(__dirname, 'BncrData');
const PORT = parseInt(process.env.PORT || 9090);

const CONFIG = {
    name: 'Bncr-ARM',
    version: '3.3.0',
    port: PORT,
    admin: { username: 'admin', password: 'admin123' }
};

const utils = {
    now: () => new Date().toISOString(),
    today: () => new Date().toISOString().split('T')[0],
    uuid: () => crypto.randomUUID(),
    md5: (s) => crypto.createHash('md5').update(s).digest('hex'),
    ensureDir: (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); },
    formatTime: (ms) => {
        const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
        if (d > 0) return d + '天' + (h % 24) + '小时';
        if (h > 0) return h + '小时' + (m % 60) + '分';
        if (m > 0) return m + '分' + (s % 60) + '秒';
        return s + '秒';
    },
    formatBytes: (b) => {
        if (b === 0) return '0 B';
        const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(b) / Math.log(k));
        return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
};

const dirs = {
    root: WORK_DIR,
    config: path.join(WORK_DIR, 'config'),
    db: path.join(WORK_DIR, 'db'),
    logs: path.join(WORK_DIR, 'logs'),
    plugins: path.join(WORK_DIR, 'plugins')
};

for (const d of Object.values(dirs)) utils.ensureDir(d);

class Logger {
    constructor() {
        this.logFile = path.join(dirs.logs, utils.today() + '.log');
        this.logs = [];
    }
    log(level, type, msg) {
        const line = '[' + utils.now() + '] [' + level + '] [' + type + ']: ' + msg;
        console.log(line);
        this.logs.unshift({ time: utils.now(), level, type, msg });
        if (this.logs.length > 500) this.logs = this.logs.slice(0, 500);
        try { fs.appendFileSync(this.logFile, line + '\n'); } catch(e) {}
    }
    info(m, t) { this.log('INFO', t || 'system', m); }
    error(m, t) { this.log('ERROR', t || 'system', m); }
    warn(m, t) { this.log('WARN', t || 'system', m); }
    getLogs(n) { return this.logs.slice(0, n || 100); }
}
const logger = new Logger();

class Database {
    constructor() {
        this.dbFile = path.join(dirs.db, 'data.json');
        this.cfgFile = path.join(dirs.config, 'system.json');
        this.data = this.loadDb();
        this.cfg = this.loadCfg();
        this.sessions = new Map();
        this.msgs = [];
        this.startTime = Date.now();
        this.init();
    }
    loadDb() {
        try { return JSON.parse(fs.readFileSync(this.dbFile, 'utf8')); } 
        catch { return { users: {}, groups: {} }; }
    }
    loadCfg() {
        try { return JSON.parse(fs.readFileSync(this.cfgFile, 'utf8')); } 
        catch { return this.defaultCfg(); }
    }
    defaultCfg() {
        return {
            adapters: {
                tgbot: { name: 'tgbot', enabled: false, type: 'telegram', desc: 'Telegram Bot' },
                qqbot: { name: 'qqbot', enabled: false, type: 'qq', desc: 'QQ Bot' },
                wxbot: { name: 'wxbot', enabled: false, type: 'wechat', desc: '微信 Bot' },
                system: { name: 'system', enabled: true, type: 'system', desc: '系统适配器' }
            },
            plugins: {},
            settings: { logLevel: 'info', maxMsgs: 1000 }
        };
    }
    init() {
        const plugins = {
            'system.js': `module.exports = async (msg, db) => {
    const t = msg.text?.trim();
    if (!t) return null;
    if (t === "ping") return "Pong!";
    if (t === "time") return new Date().toLocaleString("zh-CN");
    if (t === "版本") return "Bncr-ARM v3.3.0";
    const g = t.match(/^get\\s+(\\S+)\\s+(\\S+)$/);
    if (g) return JSON.stringify(db.get(g[1], g[2]));
    const s = t.match(/^set\\s+(\\S+)\\s+(\\S+)\\s+(.*)$/);
    if (s) { db.set(s[1], s[2], s[3]); return "已设置"; }
    return null;
};`,
            'echo.js': `module.exports = async (msg) => {
    const m = msg.text?.match(/^echo\\s+(.+)$/);
    return m ? m[1] : null;
};`,
            'help.js': `module.exports = async (msg) => {
    if (msg.text === "帮助") return "命令列表:\\n• ping - 测试\\n• time - 时间\\n• 版本 - 版本信息\\n• get 表 键 - 查询\\n• set 表 键 值 - 设置\\n• echo 内容 - 回声\\n• 帮助 - 显示此菜单";
    return null;
};`
        };
        for (const [f, c] of Object.entries(plugins)) {
            const p = path.join(dirs.plugins, f);
            if (!fs.existsSync(p)) {
                fs.writeFileSync(p, c);
                const name = f.replace('.js', '');
                this.cfg.plugins[name] = { enabled: true, desc: name + '插件' };
            }
        }
        this.save();
    }
    save() {
        try {
            fs.writeFileSync(this.dbFile, JSON.stringify(this.data, null, 2));
            fs.writeFileSync(this.cfgFile, JSON.stringify(this.cfg, null, 2));
        } catch(e) {}
    }
    newSession() { 
        const t = utils.uuid(); 
        this.sessions.set(t, { last: Date.now(), created: Date.now() }); 
        return t; 
    }
    check(t) { 
        const s = this.sessions.get(t); 
        if (!s) return false; 
        if (Date.now() - s.last > 3600000) { 
            this.sessions.delete(t); 
            return false; 
        } 
        s.last = Date.now(); 
        return true; 
    }
    getSessions() {
        const list = [];
        for (const [token, data] of this.sessions) {
            list.push({
                token: token.substring(0, 8) + '...',
                fullToken: token,
                created: new Date(data.created).toLocaleString('zh-CN'),
                lastActive: new Date(data.last).toLocaleString('zh-CN'),
                expiresIn: Math.max(0, Math.floor((3600000 - (Date.now() - data.last)) / 1000))
            });
        }
        return list.sort((a, b) => b.lastActive.localeCompare(a.lastActive));
    }
    deleteSession(token) {
        return this.sessions.delete(token);
    }
    get(table, key) { return this.data[table]?.[key]; }
    set(table, key, val) { 
        if (!this.data[table]) this.data[table] = {}; 
        this.data[table][key] = val; 
        this.save(); 
    }
    getTable(table) { return this.data[table] || {}; }
    getPlugins() { 
        return Object.entries(this.cfg.plugins).map(([n, p]) => ({ 
            name: n, ...p, 
            exists: fs.existsSync(path.join(dirs.plugins, n + '.js')) 
        })); 
    }
    getPluginCode(n) { 
        try { return fs.readFileSync(path.join(dirs.plugins, n + '.js'), 'utf8'); } 
        catch { return ''; } 
    }
    savePlugin(n, code) { 
        fs.writeFileSync(path.join(dirs.plugins, n + '.js'), code); 
        if (!this.cfg.plugins[n]) this.cfg.plugins[n] = { enabled: false, desc: n }; 
        this.save(); 
    }
    deletePlugin(n) { 
        try { fs.unlinkSync(path.join(dirs.plugins, n + '.js')); } catch {} 
        delete this.cfg.plugins[n]; 
        this.save(); 
    }
    togglePlugin(n) { 
        const p = this.cfg.plugins[n]; 
        if (p) { p.enabled = !p.enabled; this.save(); } 
        return p; 
    }
    getAdapters() { 
        return Object.entries(this.cfg.adapters).map(([n, a]) => ({ name: n, ...a })); 
    }
    toggleAdapter(n) { 
        const a = this.cfg.adapters[n]; 
        if (a) { a.enabled = !a.enabled; this.save(); } 
        return a; 
    }
    addMsg(m) { 
        this.msgs.unshift({ ...m, id: Date.now(), time: utils.now() }); 
        if (this.msgs.length > this.cfg.settings.maxMsgs) 
            this.msgs = this.msgs.slice(0, this.cfg.settings.maxMsgs);    }
    getMsgs(n) { return this.msgs.slice(0, n || 100); }
    clearMsgs() { this.msgs = []; }
    getStats() {
        const mem = process.memoryUsage();
        return {
            totalMsgs: this.msgs.length,
            totalUsers: Object.keys(this.data.users || {}).length,
            activePlugins: Object.values(this.cfg.plugins).filter(p => p.enabled).length,
            totalPlugins: Object.keys(this.cfg.plugins).length,
            activeAdapters: Object.values(this.cfg.adapters).filter(a => a.enabled).length,
            totalAdapters: Object.keys(this.cfg.adapters).length,
            uptime: utils.formatTime(Date.now() - this.startTime),
            sessions: this.sessions.size,
            node: process.version,
            platform: process.platform,
            arch: process.arch,
            memory: { rss: utils.formatBytes(mem.rss), heap: utils.formatBytes(mem.heapUsed) },
            hostname: os.hostname()
        };
    }
}

class WebServer {
    constructor(db) { this.db = db; }
    
    start() {
        http.createServer((req, res) => this.handle(req, res)).listen(CONFIG.port, () => {
            logger.info('服务启动: http://0.0.0.0:' + CONFIG.port);
            logger.info('账号: admin / admin123');
        });
    }
    
    getCookie(req, name) {
        const cookies = req.headers.cookie;
        if (!cookies) return null;
        const match = cookies.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
    }
    
    handle(req, res) {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
            try { req.body = JSON.parse(body); } catch { req.body = {}; }
            this.route(req, res);
        });
    }
    
    route(req, res) {
        const { url, method } = req;
        
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        if (method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
        
        // 公开页面
        if (url === '/' || url === '/login') {
            if (method === 'POST' && url === '/login') return this.doLogin(req, res);
            return this.serveLogin(res);
        }
        
        // 获取token (从Cookie或Header)
        let token = this.getCookie(req, 'token') || req.headers.authorization?.replace('Bearer ', '');
        
        // API需要认证
        if (url.startsWith('/api/')) {
            if (!token || !this.db.check(token)) {
                return this.json(res, 401, { error: '未授权，请重新登录' });
            }
            return this.handleApi(req, res, token);
        }
        
        // 管理页面 - 如果已登录直接显示，否则跳转到登录
        if (url === '/admin') {
            if (token && this.db.check(token)) {
                return this.serveAdmin(res);
            }
            return this.serveLogin(res);
        }
        
        this.json(res, 404, { error: 'Not Found' });
    }
    
    handleApi(req, res, token) {
        const { url, method } = req;
        
        if (url === '/api/stats') return this.json(res, 200, this.db.getStats());
        if (url === '/api/messages') return this.json(res, 200, this.db.getMsgs());
        if (url === '/api/messages/clear' && method === 'POST') { 
            this.db.clearMsgs(); 
            return this.json(res, 200, { ok: true }); 
        }
        if (url === '/api/plugins') return this.json(res, 200, this.db.getPlugins());
        if (url.startsWith('/api/plugins/code/') && method === 'GET') 
            return this.json(res, 200, { code: this.db.getPluginCode(url.split('/').pop()) });
        if (url.startsWith('/api/plugins/save/') && method === 'POST') { 
            this.db.savePlugin(url.split('/').pop(), req.body.code); 
            return this.json(res, 200, { ok: true }); 
        }
        if (url.startsWith('/api/plugins/toggle/') && method === 'POST') { 
            const p = this.db.togglePlugin(url.split('/').pop()); 
            return this.json(res, 200, { ok: true, plugin: p }); 
        }
        if (url.startsWith('/api/plugins/delete/') && method === 'POST') { 
            this.db.deletePlugin(url.split('/').pop()); 
            return this.json(res, 200, { ok: true }); 
        }
        if (url === '/api/adapters') return this.json(res, 200, this.db.getAdapters());
        if (url.startsWith('/api/adapters/toggle/') && method === 'POST') { 
            const a = this.db.toggleAdapter(url.split('/').pop()); 
            return this.json(res, 200, { ok: true, adapter: a }); 
        }
        if (url === '/api/logs') return this.json(res, 200, logger.getLogs());
        if (url.startsWith('/api/db/get/') && method === 'GET') { 
            const p = url.split('/'); 
            return this.json(res, 200, { value: this.db.get(p[4], p[5]) }); 
        }
        if (url.startsWith('/api/db/set/') && method === 'POST') { 
            const p = url.split('/'); 
            this.db.set(p[4], p[5], req.body.value); 
            return this.json(res, 200, { ok: true }); 
        }
        // Token管理API
        if (url === '/api/tokens') return this.json(res, 200, this.db.getSessions());
        if (url.startsWith('/api/tokens/delete/') && method === 'POST') { 
            const t = url.split('/').pop();
            const deleted = this.db.deleteSession(t);
            return this.json(res, 200, { ok: deleted }); 
        }
        if (url === '/api/tokens/clear' && method === 'POST') { 
            const count = this.db.sessions.size;
            this.db.sessions.clear();
            return this.json(res, 200, { ok: true, count: count }); 
        }
        if (url === '/api/logout') { 
            this.db.sessions.delete(token); 
            return this.json(res, 200, { ok: true }); 
        }
        
        this.json(res, 404, { error: 'API Not Found' });
    }
    
    doLogin(req, res) {
        const { username, password } = req.body || {};
        if (username === CONFIG.admin.username && password === CONFIG.admin.password) {
            const token = this.db.newSession();
            res.setHeader('Set-Cookie', 'token=' + token + '; Path=/; HttpOnly; Max-Age=3600');
            return this.json(res, 200, { ok: true, token });
        }
        return this.json(res, 401, { error: '用户名或密码错误' });
    }
    
    json(res, code, data) {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }
    
    serveLogin(res) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${CONFIG.name} 登录</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.login-box{background:#fff;border-radius:16px;padding:40px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.3)}
h1{text-align:center;color:#667eea;margin-bottom:8px;font-size:1.8em}
.subtitle{text-align:center;color:#888;margin-bottom:30px;font-size:0.95em}
.input-group{margin-bottom:20px}
label{display:block;margin-bottom:8px;color:#555;font-weight:500}
input{width:100%;padding:12px 16px;border:2px solid #e0e0e0;border-radius:8px;font-size:1em;transition:border-color 0.3s}
input:focus{outline:none;border-color:#667eea}
button{width:100%;padding:14px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;border:none;border-radius:8px;font-size:1em;font-weight:600;cursor:pointer;transition:all 0.3s}
button:hover{
transform:translateY(-2px);box-shadow:0 8px 20px rgba(102,126,234,0.4)}
.error{color:#e74c3c;text-align:center;margin-top:16px;font-size:0.9em;padding:10px;background:#fdf2f2;border-radius:6px;display:none}
.success{color:#27ae60;text-align:center;margin-top:16px;font-size:0.9em;padding:10px;background:#d4edda;border-radius:6px;display:none}
.version{text-align:center;color:#aaa;margin-top:24px;font-size:0.85em}
</style></head>
<body>
<div class="login-box">
<h1>🤖 ${CONFIG.name}</h1>
<p class="subtitle">ARM Linux 聊天机器人框架</p>
<form id="loginForm">
<div class="input-group"><label>用户名</label><input type="text" id="username" placeholder="admin" required></div>
<div class="input-group"><label>密码</label><input type="password" id="password" placeholder="admin123" required></div>
<button type="submit">登录</button>
<p class="error" id="error"></p>
<p class="success" id="success"></p>
</form>
<p class="version">v${CONFIG.version}</p>
</div>
<script>
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    var u = document.getElementById('username').value;
    var p = document.getElementById('password').value;
    var err = document.getElementById('error');
    var suc = document.getElementById('success');
    err.style.display = 'none';
    suc.style.display = 'none';
    
    fetch('/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username: u, password: p})
    }).then(function(r) {
        return r.json();
    }).then(function(d) {
        if (d.ok) {
            suc.textContent = '登录成功，跳转中...';
            suc.style.display = 'block';
            localStorage.setItem('token', d.token);
            setTimeout(function() {
                window.location.href = '/admin';
            }, 500);
        } else {
            err.textContent = d.error || '登录失败';
            err.style.display = 'block';
        }
    }).catch(function(e) {
        err.textContent = '网络错误: ' + e.message;
        err.style.display = 'block';
    });
});
</script>
</body></html>`);
    }
    
    serveAdmin(res) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${CONFIG.name} 管理面板</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f7fa;min-height:100vh}
.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:16px 24px;position:fixed;top:0;left:0;right:0;z-index:100;box-shadow:0 2px 8px rgba(0,0,0,0.1)}
.header h1{font-size:1.3em;display:flex;align-items:center;gap:10px}
.header nav{margin-top:8px;display:flex;gap:16px;flex-wrap:wrap}
.header a{color:#fff;text-decoration:none;opacity:0.85;font-size:0.9em;cursor:pointer}
.header a:hover{opacity:1}
.logout{position:absolute;right:24px;top:20px;background:rgba(255,255,255,0.2);padding:6px 14px;border-radius:6px;color:#fff;text-decoration:none;font-size:0.85em;cursor:pointer}
.logout:hover{background:rgba(255,255,255,0.3)}
.container{max-width:1200px;margin:0 auto;padding:100px 20px 30px}
.card{background:#fff;border-radius:12px;padding:20px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.08)}
.card h2{color:#667eea;margin-bottom:16px;font-size:1.2em;display:flex;align-items:center;gap:8px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px}
.stat-card{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:16px;border-radius:10px;text-align:center}
.stat-value{font-size:1.8em;font-weight:bold}.stat-label{margin-top:4px;opacity:0.9;font-size:0.85em}
table{width:100%;border-collapse:collapse;font-size:0.9em}th,td{padding:10px;text-align:left;border-bottom:1px solid #eee}
th{color:#667eea;font-weight:600;background:#f8f9fa}
.status-badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:0.8em;font-weight:500}
.status-on{background:#d4edda;color:#155724}.status-off{background:#f8d7da;color:#721c24}
.btn{padding:6px 12px;border:none;border-radius:6px;cursor:pointer;font-size:0.85em;transition:all 0.2s}
.btn-primary{background:#667eea;color:#fff}.btn-primary:hover{background:#5a6fd6}
.btn-danger{background:#e74c3c;color:#fff}.btn-danger:hover{background:#c0392b}
.btn-success{background:#27ae60;color:#fff}.btn-success:hover{background:#219a52}
.btn-sm{padding:4px 10px;font-size:0.8em}
pre{background:#f8f9fa;padding:12px;border-radius:8px;overflow-x:auto;font-size:0.85em;border:1px solid #e9ecef;max-height:300px}
.msg-item{padding:10px;border-bottom:1px solid #eee}.msg-item:last-child{border-bottom:none}
.msg-time{color:#888;font-size:0.75em}.msg-content{margin-top:4px;font-size:0.9em;word-break:break-all}
.empty{color:#888;text-align:center;padding:30px}
.editor{width:100%;min-height:250px;font-family:monospace;font-size:13px;padding:12px;border:1px solid #ddd;border-radius:8px;resize:vertical}
.tabs{display:flex;border-bottom:2px solid #eee;margin-bottom:20px;flex-wrap:wrap}.tab{padding:10px 16px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;font-size:0.9em}.tab.active{border-bottom-color:#667eea;color:#667eea;font-weight:600}.tab:hover{color:#667eea}
.tab-content{display:none}.tab-content.active{display:block}
.modal{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:none;align-items:center;justify-content:center;z-index:1000;padding:20px}.modal.show{display:flex}
.modal-content{background:#fff;padding:20px;border-radius:12px;max-width:800px;width:100%;max-height:90vh;overflow:auto}
.modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}.modal-title{font-size:1.2em;color:#667eea}
.close-btn{background:none;border:none;font-size:1.5em;cursor:pointer;color:#888}.close-btn:hover{color:#333}
.footer{text-align:center;color:#888;padding:20px;font-size:0.85em}
.input-row{display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap}.input-row input{flex:1;padding:10px;border:1px solid #ddd;border-radius:6px;min-width:120px}
.token-display{background:#f8f9fa;padding:12px;border-radius:8px;font-family:monospace;font-size:0.85em;word-break:break-all;border:1px solid #e9ecef;margin-bottom:10px}
.token-item{padding:12px;border:1px solid #e9ecef;border-radius:8px;margin-bottom:10px;background:#fff}
.token-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.token-info{color:#666;font-size:0.85em}
@media(max-width:600px){.header nav{gap:10px}.header a{font-size:0.8em}.logout{right:10px;top:16px;padding:4px 10px}}
</style></head>
<body>
<div class="header">
<h1>🤖 ${CONFIG.name}</h1>
<nav>
<a onclick="showTab('stats')">📊 统计</a>
<a onclick="showTab('adapters')">🔌 适配器</a>
<a onclick="showTab('plugins')">🔧 插件</a>
<a onclick="showTab('messages')">💬 消息</a>
<a onclick="showTab('logs')">📝 日志</a>
<a onclick="showTab('database')">🗄️ 数据库</a>
<a onclick="showTab('tokens')">🔑 Token</a>
</nav>
<a class="logout" onclick="doLogout()">退出</a>
</div>
<div class="container">
<div class="tabs">
<div class="tab active" onclick="showTab('stats')">📊 统计</div>
<div class="tab" onclick="showTab('adapters')">🔌 适配器</div>
<div class="tab" onclick="showTab('plugins')">🔧 插件</div>
<div class="tab" onclick="showTab('messages')">💬 消息</div>
<div class="tab" onclick="showTab('logs')">📝 日志</div>
<div class="tab" onclick="showTab('database')">🗄️ 数据库</div>
<div class="tab" onclick="showTab('tokens')">🔑 Token</div>
</div>
<div id="tab-stats" class="tab-content active"><div class="card"><h2>系统统计</h2><div class="grid" id="statsGrid"></div></div></div>
<div id="tab-adapters" class="tab-content"><div class="card"><h2>适配器管理</h2><div id="adapterList"></div></div></div>
<div id="tab-plugins" class="tab-content"><div class="card"><h2>插件管理 <button class="btn btn-primary btn-sm" onclick="newPlugin()">+ 新建</button></h2><div id="pluginList"></div></div></div>
<div id="tab-messages" class="tab-content"><div class="card"><h2>消息记录 <button class="btn btn-danger btn-sm" onclick="clearMsgs()">清空</button></h2><div id="msgList"><div class="empty">暂无消息</div></div></div></div>
<div id="tab-logs" class="tab-content"><div class="card"><h2>系统日志</h2><pre id="logContent">加载中...</pre></div></div>
<div id="tab-database" class="tab-content"><div class="card"><h2>数据库操作</h2><div class="input-row"><input id="dbTable" placeholder="表名"><input id="dbKey" placeholder="键名"><button class="btn btn-primary" onclick="dbGet()">查询</button><button class="btn btn-success" onclick="dbSet()">设置</button></div><pre id="dbResult"></pre></div></div>
<div id="tab-tokens" class="tab-content"><div class="card"><h2>Token管理 <button class="btn btn-danger btn-sm" onclick="clearAllTokens()">清空所有</button></h2><div class="token-display" id="currentToken"></div><div id="tokenList"><div class="empty">加载中...</div></div></div></div>
</div>
<div class="modal" id="editorModal">
<div class="modal-content">
<div class="modal-header"><div class="modal-title">编辑插件</div><button class="close-btn" onclick="closeModal()">&times;</button></div>
<input id="pluginName" placeholder="插件名称" style="width:100%;padding:10px;margin-bottom:10px;border:1px solid #ddd;border-radius:6px">
<textarea id="pluginCode" class="editor" placeholder="插件代码"></textarea>
<div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end">
<button class="btn btn-primary" onclick="savePlugin()">保存</button>
<button class="btn" onclick="closeModal()" style="background:#888;color:#fff">取消</button>
</div>
</div>
</div>
<div class="footer">${CONFIG.name} v${CONFIG.version} | Termux优化版</div>
<script>
var token = localStorage.getItem('token');
if (!token) { window.location.href = '/'; }

function api(path, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    opts.headers['Authorization'] = 'Bearer ' + token;
    return fetch(path, opts).then(function(r) {
        if (r.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/';
            return;
        }
        return r.json();
    });
}

function showTab(n) {
    var tabs = document.querySelectorAll('.tab');
    var contents = document.querySelectorAll('.tab-content');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
    for (var i = 0; i < contents.length; i++) contents[i].classList.remove('active');
    event.target.classList.add('active');
    document.getElementById('tab-' + n).classList.add('active');
    if (n === 'stats') loadStats();
    if (n === 'adapters') loadAdapters();
    if (n === 'plugins') loadPlugins();
    if (n === 'messages') loadMsgs();
    if (n === 'logs') loadLogs();
    if (n === 'database') { document.getElementById('dbResult').textContent = ''; }
    if (n === 'tokens') loadTokens();
}

function loadStats() {
    api('/api/stats').then(function(s) {
        var html = '';
        html += '<div class="stat-card"><div class="stat-value">' + (s.totalMsgs || 0) + '</div><div class="stat-label">消息总数</div></div>';
        html += '<div class="stat-card"><div class="stat-value">' + (s.totalUsers || 0) + '</div><div class="stat-label">用户数量</div></div>';
        html += '<div class="stat-card"><div class="stat-value">' + (s.activePlugins || 0) + '/' + (s.totalPlugins || 0) + '</div><div class="stat-label">活跃插件</div></div>';
        html += '<div class="stat-card"><div class="stat-value">' + (s.activeAdapters || 0) + '/' + (s.totalAdapters || 0) + '</div><div class="stat-label">活跃适配器</div></div>';
        html += '<div class="stat-card"><div class="stat-value">' + (s.sessions || 0) + '</div><div class="stat-label">在线会话</div></div>';
        html += '<div class="stat-card"><div class="stat-value">' + (s.uptime || '-') + '</div><div class="stat-label">运行时间</div></div>';
        html += '<div class="stat-card"><div class="stat-value">' + (s.memory && s.memory.rss ? s.memory.rss : '-') + '</div><div class="stat-label">内存使用</div></div>';
        html += '<div class="stat-card"><div class="stat-value">' + (s.node ? s.node.replace('v', '') : '-') + '</div><div class="stat-label">Node版本</div></div>';
        document.getElementById('statsGrid').innerHTML = html;
    });
}

function loadAdapters() {
    api('/api/adapters').then(function(a) {
        var html = '<table><thead><tr><th>名称</th><th>类型</th><th>描述</th><th>状态</th><th>操作</th></tr></thead><tbody>';
        if (a.length === 0) {
            html += '<tr><td colspan="5" class="empty">暂无适配器</td></tr>';
        } else {
            for (var i = 0; i < a.length; i++) {
                var p = a[i];
                html += '<tr><td>' + p.name + '</td><td>' + p.type + '</td><td>' + p.desc + '</td>';
                html += '<td><span class="status-badge ' + (p.enabled ? 'status-on' : 'status-off') + '">' + (p.enabled ? '启用' : '禁用') + '</span></td>';
                html += '<td><button class="btn ' + (p.enabled ? 'btn-danger' : 'btn-success') + '" onclick="toggleAdapter(\'' + p.name + '\')">' + (p.enabled ? '禁用' : '启用') + '</button></td></tr>';
            }
        }
        html += '</tbody></table>';
        document.getElementById('adapterList').innerHTML = html;
    });
}

function loadPlugins() {
    api('/api/plugins').then(function(p) {
        var html = '<table><thead><tr><th>名称</th><th>描述</th><th>状态</th><th>操作</th></tr></thead><tbody>';
        if (p.length === 0) {
            html += '<tr><td colspan="4" class="empty">暂无插件</td></tr>';
        } else {
            for (var i = 0; i < p.length; i++) {
                var x = p[i];
                html += '<tr><td>' + x.name + '</td><td>' + x.desc + '</td>';
                html += '<td><span class="status-badge ' + (x.enabled ? 'status-on' : 'status-off') + '">' + (x.enabled ? '启用' : '禁用') + '</span></td>';
                html += '<td><button class="btn btn-primary btn-sm" onclick="editPlugin(\'' + x.name + '\')">编辑</button> ';
                html += '<button class="btn ' + (x.enabled ? 'btn-danger' : 'btn-success') + ' btn-sm" onclick="togglePlugin(\'' + x.name + '\')">' + (x.enabled ? '禁用' : '启用') + '</button> ';
                html += '<button class="btn btn-danger btn-sm" onclick="deletePlugin(\'' + x.name + '\')">删除</button></td></tr>';
            }
        }
        html += '</tbody></table>';
        document.getElementById('pluginList').innerHTML = html;
    });
}

function loadMsgs() {
    api('/api/messages').then(function(m) {
        if (m.length === 0) {
            document.getElementById('msgList').innerHTML = '<div class="empty">暂无消息</div>';
            return;
        }
        var html = '';
        for (var i = 0; i < m.length; i++) {
            var x = m[i];
            html += '<div class="msg-item"><div class="msg-time">' + x.time + '</div><div class="msg-content">' + (x.text || JSON.stringify(x)) + '</div></div>';
        }
        document.getElementById('msgList').innerHTML = html;
    });
}

function loadLogs() {
    api('/api/logs').then(function(l) {
        var text = l.length ? l.map(function(x) { return '[' + x.level + '] ' + x.msg; }).join('\n') : '暂无日志';
        document.getElementById('logContent').textContent = text;
    });
}

function loadTokens() {
    document.getElementById('currentToken').innerHTML = '<strong>当前Token:</strong><br>' + token;
    api('/api/tokens').then(function(t) {
        if (t.length === 0) {
            document.getElementById('tokenList').innerHTML = '<div class="empty">暂无会话</div>';
            return;
        }
        var html = '';
        for (var i = 0; i < t.length; i++) {
            var x = t[i];
            html += '<div class="token-item">';
            html += '<div class="token-header"><strong>' + x.token + '</strong>';
            html += '<button class="btn btn-danger btn-sm" onclick="deleteToken(\'' + x.fullToken + '\')">删除</button></div>';
            html += '<div class="token-info">创建时间: ' + x.created + ' | 最后活跃: ' + x.lastActive + ' | ' + x.expiresIn + '秒后过期</div>';
            html += '</div>';
        }
        document.getElementById('tokenList').innerHTML = html;
    });
}

function toggleAdapter(n) {
    api('/api/adapters/toggle/' + n, { method: 'POST' }).then(function() {
        loadAdapters();
        loadStats();
    });
}

function togglePlugin(n) {
    api('/api/plugins/toggle/' + n, { method: 'POST' }).then(function() {
        loadPlugins();
        loadStats();
    });
}

function clearMsgs() {
    if (!confirm('确定清空所有消息?')) return;
    api('/api/messages/clear', { method: 'POST' }).then(function() {
        loadMsgs();
        loadStats();
    });
}

function editPlugin(n) {
    api('/api/plugins/code/' + n).then(function(p) {
        document.getElementById('pluginName').value = n;
        document.getElementById('pluginCode').value = p.code || '';
        document.getElementById('editorModal').classList.add('show');
    });
}

function newPlugin() {
    document.getElementById('pluginName').value = '';
    document.getElementById('pluginCode').value = 'module.exports = async (msg, db) => {\n  // 插件逻辑\n  return null;\n};';
    document.getElementById('editorModal').classList.add('show');
}

function savePlugin() {
    var n = document.getElementById('pluginName').value;
    var c = document.getElementById('pluginCode').value;
    if (!n) { alert('请输入插件名称'); return; }
    api('/api/plugins/save/' + n, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: c
})
    }).then(function() {
        closeModal();
        loadPlugins();
        loadStats();
    });
}

function deletePlugin(n) {
    if (!confirm('确定删除插件 ' + n + '?')) return;
    api('/api/plugins/delete/' + n, { method: 'POST' }).then(function() {
        loadPlugins();
        loadStats();
    });
}

function deleteToken(t) {
    if (!confirm('确定删除此会话?')) return;
    api('/api/tokens/delete/' + t, { method: 'POST' }).then(function() {
        loadTokens();
        loadStats();
    });
}

function clearAllTokens() {
    if (!confirm('确定清空所有会话?这将使所有已登录用户退出。')) return;
    api('/api/tokens/clear', { method: 'POST' }).then(function() {
        loadTokens();
        loadStats();
    });
}

function closeModal() {
    document.getElementById('editorModal').classList.remove('show');
}

function doLogout() {
    api('/api/logout').then(function() {
        localStorage.removeItem('token');
        window.location.href = '/';
    });
}

function dbGet() {
    var t = document.getElementById('dbTable').value;
    var k = document.getElementById('dbKey').value;
    if (!t || !k) { alert('请输入表名和键名'); return; }
    api('/api/db/get/' + t + '/' + k).then(function(r) {
        document.getElementById('dbResult').textContent = JSON.stringify(r, null, 2);
    });
}

function dbSet() {
    var t = document.getElementById('dbTable').value;
    var k = document.getElementById('dbKey').value;
    if (!t || !k) { alert('请输入表名和键名'); return; }
    var v = prompt('请输入值:');
    if (v === null) return;
    api('/api/db/set/' + t + '/' + k, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: v })
    }).then(function() {
        alert('设置成功');
        dbGet();
    });
}

loadStats();
</script>
</body></html>`);
    }
}

function banner() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                                                          ║');
    console.log('║   ██████╗ ███╗   ██╗ ██████╗██████╗                     ║');
    console.log('║   ██╔══██╗████╗  ██║██╔════╝██╔══██╗                    ║');
    console.log('║   ██████╔╝██╔██╗ ██║██║     ██████╔╝   █████╗ ██████╗   ║');
    console.log('║   ██╔══██╗██║╚██╗██║██║     ██╔══██╗  ██╔══██╗██╔══██╗  ║');
    console.log('║   ██████╔╝██║ ╚████║╚██████╗██║  ██║  ███████║██████╔╝  ║');
    console.log('║   ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝╚═╝  ╚═╝  ██╔══██║██╔══██╗  ║');
    console.log('║                                       ██║  ██║██║  ██║  ║');
    console.log('║   ARM Linux Standalone Edition        ╚═╝  ╚═╝╚═╝  ╚═╝  ║');
    console.log('║   v' + CONFIG.version + ' - Termux优化版');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
}

async function main() {
    banner();
    logger.info('启动中...');
    const db = new Database();
    const server = new WebServer(db);
    server.start();
    process.on('SIGINT', () => { logger.info('关闭中...'); process.exit(0); });
}

main().catch(e => { logger.error('错误: ' + e.message); process.exit(1); });
