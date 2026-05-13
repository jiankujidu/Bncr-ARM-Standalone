#!/usr/bin/env node
/**
 * Bncr-ARM Standalone v2.0.0
 * 功能对齐Docker版本 - 支持二进制启动
 * 
 * 启动方式:
 *   1. Node.js: node bncr-arm.js
 *   2. 二进制: ./bncr-arm (打包后)
 * 
 * 构建二进制:
 *   npm install -g pkg
 *   pkg -t node18-linux-x64 -o bncr-arm .
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec, spawn } = require('child_process');
const os = require('os');

// ==================== 配置 ====================
const IS_BINARY = process.pkg !== undefined;
const EXEC_DIR = IS_BINARY ? path.dirname(process.execPath) : __dirname;
const WORK_DIR = process.env.BNCR_DATA || EXEC_DIR;

const CONFIG = {
    web: { port: parseInt(process.env.PORT || 9090) },
    admin: { username: 'admin', password: 'admin123' },
    version: '2.0.0',
    name: 'Bncr-ARM',
    isBinary: IS_BINARY,
    workDir: WORK_DIR
};

// 数据目录
const dirs = {
    BncrData: path.join(WORK_DIR, 'BncrData'),
    logs: path.join(WORK_DIR, 'BncrData', 'logs'),
    plugins: path.join(WORK_DIR, 'BncrData', 'plugins'),
    Adapter: path.join(WORK_DIR, 'BncrData', 'Adapter'),
    config: path.join(WORK_DIR, 'BncrData', 'config'),
    public: path.join(WORK_DIR, 'BncrData', 'public'),
    db: path.join(WORK_DIR, 'BncrData', 'db')
};

const utils = {
    now: () => new Date().toISOString(),
    today: () => new Date().toISOString().split('T')[0],
    ensureDir: (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); },
    uuid: () => crypto.randomUUID(),
    formatTime: (ms) => {
        const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
        if (d > 0) return `${d}天${h % 24}小时`;
        if (h > 0) return `${h}小时${m % 60}分`;
        if (m > 0) return `${m}分${s % 60}秒`;
        return `${s}秒`;
    },
    formatBytes: (b) => {
        if (b === 0) return '0 B';
        const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(b) / Math.log(k));
        return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
};

// 初始化目录
for (const [k, v] of Object.entries(dirs)) utils.ensureDir(v);

// ==================== 日志 ====================
class Logger {
    constructor() {
        this.logFile = path.join(dirs.logs, `bncr-${utils.today()}.log`);
        this.logs = [];
    }
    write(l, m, t = 'system') {
        const line = `[${utils.now()}] [${l.toUpperCase()}] [${t}]: ${m}`;
        console.log(line);
        this.logs.unshift({ time: utils.now(), level: l, type: t, msg: m });
        if (this.logs.length > 500) this.logs = this.logs.slice(0, 500);
        try { fs.appendFileSync(this.logFile, line + '\n'); } catch(e) {}
    }
    info(m, t) { this.write('info', m, t); }
    error(m, t) { this.write('error', m, t); }
    warn(m, t) { this.write('warn', m, t); }
    debug(m, t) { this.write('debug', m, t); }
    getLogs(n = 100) { return this.logs.slice(0, n); }
}
const logger = new Logger();

// ==================== 数据库 ====================
class Database {
    constructor() {
        this.dbFile = path.join(dirs.db, 'bncr.db.json');
        this.cfgFile = path.join(dirs.config, 'system.json');
        this.db = this.loadDb();
        this.cfg = this.loadCfg();
        this.startTime = Date.now();
        this.sessions = new Map();
        this.msgs = [];
        this.init();
    }
    loadDb() {
        try { return JSON.parse(fs.readFileSync(this.dbFile, 'utf8')); } catch { return { system: {}, users: {}, groups: {} }; }
    }
    loadCfg() {
        try { return JSON.parse(fs.readFileSync(this.cfgFile, 'utf8')); } catch { return this.defaultCfg(); }
    }
    defaultCfg() {
        return {
            adapters: {
                tgbot: { name: 'tgbot', enabled: false, type: 'telegram', desc: 'Telegram Bot' },
                HumanTG: { name: 'HumanTG', enabled: false, type: 'telegram', desc: 'Telegram用户' },
                qqbot: { name: 'qqbot', enabled: false, type: 'qq', desc: 'QQ Bot' },
                wxKeAImao: { name: 'wxKeAImao', enabled: false, type: 'wechat', desc: '微信可爱猫' },
                wxQianxun: { name: 'wxQianxun', enabled: false, type: 'wechat', desc: '微信千寻' },
                system: { name: 'system', enabled: true, type: 'system', desc: '系统适配器' }
            },
            plugins: {},
            settings: { logLevel: 'info', maxMsgs: 1000, autoSave: true }
        };
    }
    init() {
        const plugins = {
            'system.js': `/**
 * 系统插件
 * @name 系统插件
 * @rule ^get\\s+(\\S+)\\s+(\\S+)$
 * @rule ^set\\s+(\\S+)\\s+(\\S+)\\s+(.*)$
 * @rule ^重启$|^time$|^启动时间$|^机器码$|^bncr版本$
 * @version 1.0.0
 * @admin true
 * @author system
 */
module.exports = async (msg) => {
    const text = msg.text;
    const getMatch = text.match(/^get\\s+(\\S+)\\s+(\\S+)$/);
    if (getMatch) {
        const val = db.get(getMatch[1], getMatch[2]);
        return val || '未找到';
    }
    const setMatch = text.match(/^set\\s+(\\S+)\\s+(\\S+)\\s+(.*)$/);
    if (setMatch) {
        db.set(setMatch[1], setMatch[2], setMatch[3]);
        return '设置成功';
    }
    if (text === '重启') return '重启中...';
    if (text === 'time') return new Date().toLocaleString();
    if (text === '启动时间') return new Date(db.startTime).toLocaleString();
    if (text === '机器码') return 'ARM-' + process.arch;
    if (text === 'bncr版本') return 'v${CONFIG.version}';
    return null;
};`,
            'group.js': `/**
 * 群管理
 * @rule ^监听该群$|^屏蔽该群$|^不回复该群$|^回复该群$|^群id$|^我的id$
 * @version 1.0.0
 * @admin true
 */
module.exports = async (msg) => {
    const t = msg.text, gid = msg.groupId, uid = msg.userId;
    if (t === '群id') return '群ID: ' + gid;
    if (t === '我的id') return '用户ID: ' + uid;
    if (t === '监听该群') { db.set('groups', gid, { listen: true }); return '已监听'; }
    if (t === '屏蔽该群') { db.set('groups', gid, { block: true }); return '已屏蔽'; }
    if (t === '不回复该群') { db.set('groups', gid, { noReply: true }); return '不回复'; }
    if (t === '回复该群') { db.set('groups', gid, { noReply: false }); return '回复'; }
    return null;
};`,
            'echo.js': `/**
 * 回声
 * @rule ^echo\\s+(.+)$
 * @version 1.0.0
 */
module.exports = async (msg) => {
    const m = msg.text.match(/^echo\\s+(.+)$/);
    return m ? m[1] : null;
};`,
            'npm.js': `/**
 * NPM安装
 * @rule ^npm\\s+i\\s+(.+)$
 * @version 1.0.0
 * @admin true
 */
module.exports = async (msg) => {
    const m = msg.text.match(/^npm\\s+i\\s+(.+)$/);
    if (!m) return null;
    const pkg = m[1].trim();
    return '安装 ' + pkg + '... (请手动执行: npm i ' + pkg + ')';
};`
        };
        
        for (const [file, code] of Object.entries(plugins)) {
            const f = path.join(dirs.plugins, file);
            if (!fs.existsSync(f)) {
                fs.writeFileSync(f, code);
                const name = file.replace('.js', '');
                this.cfg.plugins[name] = { name, enabled: name === 'system', desc: name + '插件', version: '1.0.0', author: 'system' };
            }
        }
        this.save();
    }
    save() {
        try { 
            fs.writeFileSync(this.dbFile, JSON.stringify(this.db, null, 2)); 
            fs.writeFileSync(this.cfgFile, JSON.stringify(this.cfg, null, 2)); 
        } catch(e) {}
    }
    newSession() { const t = utils.uuid(); this.sessions.set(t, { created: Date.now(), last: Date.now() }); return t; }
    check(t) { const s = this.sessions.get(t); if (!s) return false; if (Date.now() - s.last > 3600000) { this.sessions.delete(t); return false; } s.last = Date.now(); return true; }
    get(table, key) { return this.db[table]?.[key]; }
    set(table, key, val) { if (!this.db[table]) this.db[table] = {}; this.db[table][key] = val; this.save(); }
    addMsg(m) { const msg = { ...m, id: Date.now(), time: utils.now() }; this.msgs.unshift(msg); if (this.msgs.length > this.cfg.settings.maxMsgs) this.msgs = this.msgs.slice(0, this.cfg.settings.maxMsgs); return msg; }
    getMsgs(n = 50) { return this.msgs.slice(0, n); }
    clearMsgs() { this.msgs = []; }
    getPlugins() {
        const ps = [];
        for (const [n, c] of Object.entries(this.cfg.plugins)) ps.push({ ...c, exists: fs.existsSync(path.join(dirs.plugins, n + '.js')) });
        try { for (const f of fs.readdirSync(dirs.plugins)) if (f.endsWith('.js') && !this.cfg.plugins[f.replace('.js', '')]) ps.push({ name: f.replace('.js', ''), enabled: false, desc: '未注册', version: '1.0.0', author: 'unknown', exists: true }); } catch(e) {}
        return ps;
    }
    togglePlugin(n) { if (!this.cfg.plugins[n]) this.cfg.plugins[n] = { enabled: false }; this.cfg.plugins[n].enabled = !this.cfg.plugins[n].enabled; this.save(); return this.cfg.plugins[n]; }
    savePlugin(n, code, meta) { fs.writeFileSync(path.join(dirs.plugins, n + '.js'), code); this.cfg.plugins[n] = { ...this.cfg.plugins[n], ...meta, enabled: this.cfg.plugins[n]?.enabled || false }; this.save(); }
    deletePlugin(n) { try { fs.unlinkSync(path.join(dirs.plugins, n + '.js')); } catch(e) {} delete this.cfg.plugins[n]; this.save(); }
    getPluginCode(n) { try { return fs.readFileSync(path.join(dirs.plugins, n + '.js'), 'utf8'); } catch(e) { return ''; } }
    getAdapters() { return Object.entries(this.cfg.adapters).map(([k, v]) => ({ ...v, name: k })); }
    toggleAdapter(n) { const a = this.cfg.adapters[n]; if (a) { a.enabled = !a.enabled; this.save(); } return a; }
    getStats() {
        const mem = process.memoryUsage();
        return {
            totalMsgs: this.msgs.length,
            totalUsers: Object.keys(this.db.users || {}).length,
            activePlugins: Object.values(this.cfg.plugins).filter(p => p.enabled).length,
            totalPlugins: Object.keys(this.cfg.plugins).length,
            activeAdapters: Object.values(this.cfg.adapters).filter(a => a.enabled).length,
            totalAdapters: Object.keys(this.cfg.adapters).length,
            uptime: utils.formatTime(Date.now() - this.startTime),
            sessions: this.sessions.size,
            node: process.version,
            platform: process.platform,
            arch: process.arch,
            memory: { rss: utils.formatBytes(mem.rss), heap: utils.formatBytes(mem.heapUsed), external: utils.formatBytes(mem.external) },
            cpu: os.loadavg(),
            hostname: os.hostname()
        };
    }
}

// ==================== Web服务器 ====================
class WebServer {
    constructor(db) {
        this.db = db;
        this.port = CONFIG.web.port;
    }
    start() {
        http.createServer((req, res) => this.handle(req, res)).listen(this.port, () => {
            logger.info(`Web管理: http://localhost:${this.port}`);
        });
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
        
        if (url === '/' || url === '/login') {
            if (method === 'POST' && url === '/login') return this.doLogin(req, res);
            return this.serveLogin(res);
        }
        if (url === '/api/status') return this.json(res, 200, { status: 'running', version: CONFIG.version, name: CONFIG.name, binary: CONFIG.isBinary });
        
        if (url.startsWith('/public/')) {
            const file = path.join(dirs.public, url.replace('/public/', ''));
            if (fs.existsSync(file)) {
                const ext = path.extname(file);
                const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' }[ext] || 'application/octet-stream';
                res.writeHead(200, { 'Content-Type': mime });
                res.end(fs.readFileSync(file));
            } else { res.writeHead(404); res.end('Not Found'); }
            return;
        }
        
        const token = req.headers.authorization?.replace('Bearer ', '');
        const authed = token && this.db.check(token);
        if (!authed) {
            if (url.startsWith('/api/')) return this.json(res, 401, { error: '未授权' });
            return this.serveLogin(res);
        }
        
        if (url === '/api/stats') return this.json(res, 200, this.db.getStats());
        if (url === '/api/messages') return this.json(res, 200, this.db.getMsgs());
        if (url === '/api/messages/clear' && method === 'POST') { this.db.clearMsgs(); return this.json(res, 200, { ok: true }); }
        if (url === '/api/plugins') return this.json(res, 200, this.db.getPlugins());
        if (url === '/api/adapters') return this.json(res, 200, this.db.getAdapters());
        if (url === '/api/logs') return this.json(res, 200, logger.getLogs());
        if (url === '/api/logout') { this.db.sessions.delete(token); return this.json(res, 200, { ok: true }); }
        
        if (url.startsWith('/api/plugins/toggle/') && method === 'POST') {
            const name = url.split('/').pop();
            const p = this.db.togglePlugin(name);
            return this.json(res, 200, { ok: !!p, plugin: p });
        }
        if (url.startsWith('/api/plugins/code/') && method === 'GET') {
            const name = url.split('/').pop();
            return this.json(res, 200, { name, code: this.db.getPluginCode(name) });
        }
        if (url.startsWith('/api/plugins/save/') && method === 'POST') {
            const name = url.split('/').pop();
            const { code, meta } = req.body;
            this.db.savePlugin(name, code, meta);
            return this.json(res, 200, { ok: true });
        }
        if (url.startsWith('/api/plugins/delete/') && method === 'POST') {
            const name = url.split('/').pop();
            this.db.deletePlugin(name);
            return this.json(res, 200, { ok: true });
        }
        if (url.startsWith('/api/adapters/toggle/') && method === 'POST') {
            const name = url.split('/').pop();
            const a = this.db.toggleAdapter(name);
            return this.json(res, 200, { ok: !!a, adapter: a });
        }
        if (url.startsWith('/api/db/get/') && method === 'GET') {
            const parts = url.split('/');
            const table = parts[4], key = parts[5];
            return this.json(res, 200, { value: this.db.get(table, key) });
        }
        if (url.startsWith('/api/db/set/') && method === 'POST') {
            const parts = url.split('/');
            const table = parts[4], key = parts[5];
            const { value } = req.body;
            this.db.set(table, key, value);
            return this.json(res, 200, { ok: true });
        }
        
        if (url === '/admin' || url === '/dashboard') return this.serveAdmin(res);
        
        this.json(res, 404, { error: 'Not Found' });
    }
    doLogin(req, res) {
        const { username, password } = req.body || {};
        if (username === CONFIG.admin.username && password === CONFIG.admin.password) {
            const token = this.db.newSession();
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
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.login-box{background:#fff;border-radius:16px;padding:40px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.3)}
h1{text-align:center;color:#667eea;margin-bottom:8px;font-size:1.8em}.subtitle{text-align:center;color:#888;margin-bottom:30px;font-size:0.95em}
.input-group{margin-bottom:20px}label{display:block;margin-bottom:8px;color:#555;font-weight:500}input{width:100%;padding:12px 16px;border:2px solid #e0e0e0;border-radius:8px;font-size:1em;transition:border-color 0.3s}input:focus{outline:none;border-color:#667eea}
button{width:100%;padding:14px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;border:none;border-radius:8px;font-size:1em;font-weight:600;cursor:pointer;transition:transform 0.2s,box-shadow 0.2s}button:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(102,126,234,0.4)}
.error{color:#e74c3c;text-align:center;margin-top:16px;font-size:0.9em;display:none}
.version{text-align:center;color:#aaa;margin-top:24px;font-size:0.85em}</style></head>
<body><div class="login-box"><h1>🤖 ${CONFIG.name}</h1><p class="subtitle">ARM Linux 聊天机器人框架</p>
<form id="loginForm"><div class="input-group"><label>用户名</label><input type="text" id="username" placeholder="admin" required></div>
<div class="input-group"><label>密码</label><input type="password" id="password" placeholder="admin123" required></div>
<button type="submit">登录</button><p class="error" id="error"></p></form>
<p class="version">v${CONFIG.version}</p></div>
<script>document.getElementById('loginForm').onsubmit=async(e)=>{e.preventDefault();const u=document.getElementById('username').value,p=document.getElementById('password').value,err=document.getElementById('error');try{const r=await fetch('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});const d=await r.json();if(d.ok){localStorage.setItem('token',d.token);location.href='/admin'}else{err.textContent=d.error||'登录失败';err.style.display='block'}}catch(e){err.textContent='网络错误';err.style.display='block'}}</script>
</body></html>`);
    }
    serveAdmin(res) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${CONFIG.name} 管理面板</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f7fa;min-height:100vh}
.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:20px 40px;box-shadow:0 4px 6px rgba(0,0,0,0.1);position:relative}
.header h1{font-size:1.5em;display:flex;align-items:center;gap:10px}.header nav{margin-top:10px;display:flex;gap:20px}.header a{color:#fff;text-decoration:none;opacity:0.8;transition:opacity 0.3s}.header a:hover{opacity:1}
.container{max-width:1200px;margin:0 auto;padding:30px 20px}
.card{background:#fff;border-radius:12px;padding:24px;margin-bottom:24px;box-shadow:0 2px 8px rgba(0,0,0,0.08)}
.card h2{color:#667eea;margin-bottom:20px;font-size:1.3em;display:flex;align-items:center;gap:8px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px}
.stat-card{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:20px;border-radius:10px}
.stat-value{font-size:2em;font-weight:bold}.stat-label{margin-top:8px;opacity:0.9;font-size:0.9em}
table{width:100%;border-collapse:collapse;font-size:0.9em}th,td{padding:12px;text-align:left;border-bottom:1px solid #eee}
th{color:#667eea;font-weight:600;background:#f8f9fa}tr:hover{background:#f8f9fa}
.status-badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:0.85em;font-weight:500}
.status-on{background:#d4edda;color:#155724}.status-off{background:#f8d7da;color:#721c24}
.btn{padding:6px 14px;border:none;border-radius:6px;cursor:pointer;font-size:0.85em;transition:all 0.3s}
.btn-primary{background:#667eea;color:#fff}.btn-primary:hover{background:#5a6fd6}
.btn-danger{background:#e74c3c;color:#fff}.btn-danger:hover{background:#c0392b}
.btn-success{background:#27ae60;color:#fff}.btn-success:hover{background:#219a52}
.logout{position:absolute;right:40px;top:28px;color:#fff;text-decoration:none;opacity:0.8;background:rgba(255,255,255,0.2);padding:8px 16px;border-radius:8px}.logout:hover{opacity:1;background:rgba(255,255,255,0.3)}
pre{background:#f8f9fa;padding:16px;border-radius:8px;overflow-x:auto;font-size:0.85em;border:1px solid #e9ecef;max-height:400px}
.msg-item{padding:12px;border-bottom:1px solid #eee}.msg-item:last-child{border-bottom:none}
.msg-time{color:#888;font-size:0.8em}.msg-content{margin-top:4px;font-size:0.9em}
.empty{color:#888;text-align:center;padding:40px}
.editor{width:100%;min-height:300px;font-family:monospace;font-size:13px;padding:12px;border:1px solid #ddd;border-radius:8px;resize:vertical}
.tabs{display:flex;border-bottom:2px solid #eee;margin-bottom:20px}.tab{padding:10px 20px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px}.tab.active{border-bottom-color:#667eea;color:#667eea;font-weight:600}.tab:hover{color:#667eea}
.tab-content{display:none}.tab-content.active{display:block}
.modal{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:none;align-items:center;justify-content:center;z-index:1000}.modal.show{display:flex}
.modal-content{background:#fff;padding:24px;border-radius:12px;max-width:800px;width:90%;max-height:80vh;overflow:auto}
.modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}.modal-title{font-size:1.2em;color:#667eea}
.close-btn{background:none;border:none;font-size:1.5em;cursor:pointer;color:#888}.close-btn:hover{color:#333}
.footer{text-align:center;color:#888;padding:20px;font-size:0.85em}</style></head>
<body>
<div class="header"><h1>🤖 ${CONFIG.name}</h1><nav><a href="#stats" onclick="showTab('stats')">📊 统计</a><a href="#adapters" onclick="showTab('adapters')">🔌 适配器</a><a href="#plugins" onclick="showTab('plugins')">🔧 插件</a><a href="#messages" onclick="showTab('messages')">💬 消息</a><a href="#logs" onclick="showTab('logs')">📝 日志</a><a href="#database" onclick="showTab('database')">🗄️ 数据库</a></nav><a href="/" class="logout" onclick="logout()">退出</a></div>
<div class="container">
<div class="tabs"><div class="tab active" onclick="showTab('stats')">📊 统计</div><div class="tab" onclick="showTab('adapters')">🔌 适配器</div><div class="tab" onclick="showTab('plugins')">🔧 插件</div><div class="tab" onclick="showTab('messages')">💬 消息</div><div class="tab" onclick="showTab('logs')">📝 日志</div><div class="tab" onclick="showTab('database')">🗄️ 数据库</div></div>
<div id="tab-stats" class="tab-content active"><div class="card"><h2>系统统计</h2><div class="grid" id="statsGrid"></div></div></div>
<div id="tab-adapters" class="tab-content"><div class="card"><h2>适配器管理</h2><table><thead><tr><th>名称</th><th>类型</th><th>描述</th><th>状态</th><th>操作</th></tr></thead><tbody id="adapterList"></tbody></table></div></div>
<div id="tab-plugins" class="tab-content"><div class="card"><h2>插件管理 <button class="btn btn-primary" onclick="newPlugin()">+ 新建</button></h2><table><thead><tr><th>名称</th><th>描述</th><th>版本</th><th>作者</th><th>状态</th><th>操作</th></tr></thead><tbody id="pluginList"></tbody></table></div></div>
<div id="tab-messages" class="tab-content"><div class="card"><h2>消息记录 <button class="btn btn-danger" onclick="clearMsgs()">清空</button></h2><div id="msgList"><div class="empty">暂无消息</div></div></div></div>
<div id="tab-logs" class="tab-content"><div class="card"><h2>系统日志</h2><pre id="logContent">加载中...</pre></div></div>
<div id="tab-database" class="tab-content"><div class="card"><h2>数据库操作</h2><div style="display:flex;gap:10px;margin-bottom:20px"><input id="dbTable" placeholder="表名" style="flex:1;padding:10px;border:1px solid #ddd;border-radius:6px"><input id="dbKey" placeholder="键名" style="flex:1;padding:10px;border:1px solid #ddd;border-radius:6px"><button class="btn btn-primary" onclick="dbGet()">查询</button><button class="btn btn-success" onclick="dbSet()">设置</button></div><pre id="dbResult"></pre></div></div>
</div>
<div class="modal" id="editorModal"><div class="modal-content"><div class="modal-header"><div class="modal-title">编辑插件</div><button class="close-btn" onclick="closeModal()">&times;</button></div><input id="pluginName" placeholder="插件名称" style="width:100%;padding:10px;margin-bottom:10px;border:1px solid #ddd;border-radius:6px"><textarea id="pluginCode" class="editor" placeholder="插件代码"></textarea><div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end"><button class="btn btn-primary" onclick="savePlugin()">保存</button><button class="btn" onclick="closeModal()">取消</button></div></div></div>
<div class="footer">${CONFIG.name} v${CONFIG.version} | ARM Linux优化版</div>
<script>
const token=localStorage.getItem('token');if(!token)location.href='/';
async function api(path,opts={}){const r=await fetch(path,{...opts,headers:{...opts.headers,'Authorization':'Bearer '+token}});if(r.status===401){localStorage.removeItem('token');location.href='/';return}return r.json()}
function showTab(n){document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));event.target.classList.add('active');document.getElementById('tab-'+n).classList.add('active');if(n==='stats')loadStats();if(n==='adapters')loadAdapters();if(n==='plugins')loadPlugins();if(n==='messages')loadMsgs();if(n==='logs')loadLogs()}
async function loadStats(){const s=await api('/api/stats');document.getElementById('statsGrid').innerHTML=\`<div class="stat-card"><div class="stat-value">\${s.totalMsgs||0}</div><div class="stat-label">消息总数</div></div><div class="stat-card"><div class="stat-value">\${s.totalUsers||0}</div><div class="stat-label">用户数量</div></div><div class="stat-card"><div class="stat-value">\${s.activePlugins||0}/\${s.totalPlugins||0}</div><div class="stat-label">活跃插件</div></div><div class="stat-card"><div class="stat-value">\${s.activeAdapters||0}/\${s.totalAdapters||0}</div><div class="stat-label">活跃适配器</div></div><div class="stat-card"><div class="stat-value">\${s.sessions||0}</div><div class="stat-label">在线会话</div></div><div class="stat-card"><div class="stat-value">\${s.uptime||'-'}</div><div class="stat-label">运行时间</div></div><div class="stat-card"><div class="stat-value">\${s.memory?.rss||'-'}</div><div class="stat-label">内存使用</div></div><div class="stat-card"><div class="stat-value">\${s.node||'-'}</div><div class="stat-label">Node版本</div></div>\`;}
async function loadAdapters(){const a=await api('/api/adapters');document.getElementById('adapterList').innerHTML=a.map(p=>\`<tr><td>\${p.name}</td><td>\${p.type}</td><td>\${p.desc}</td><td><span class="status-badge \${p.enabled?'status-on':'status-off'}">\${p.enabled?'启用':'禁用'}</span></td><td><button class="btn \${p.enabled?'btn-danger':'btn-success'}" onclick="toggleAdapter('\${p.name}')">\${p.enabled?'禁用':'启用'}</button></td></tr>\`).join('')||'<tr><td colspan="5" class="empty">暂无适配器</td></tr>'}
async function loadPlugins(){const p=await api('/api/plugins');document.getElementById('pluginList').innerHTML=p.map(p=>\`<tr><td>\${p.name}</td><td>\${p.desc}</td><td>\${p.version}</td><td>\${p.author}</td><td><span class="status-badge \${p.enabled?'status-on':'status-off'}">\${p.enabled?'启用':'禁用'}</span></td><td><button class="btn btn-primary btn-sm" onclick="editPlugin('\${p.name}')">编辑</button> <button class="btn \${p.enabled?'btn-danger':'btn-success'} btn-sm" onclick="togglePlugin('\${p.name}')">\${p.enabled?'禁用':'启用'}</button> <button class="btn btn-danger btn-sm" onclick="deletePlugin('\${p.name}')">删除</button></td></tr>\`).join('')||'<tr><td colspan="6" class="empty">暂无插件</td></tr>'}
async function loadMsgs(){const m=await api('/api/messages');document.getElementById('msgList').innerHTML=m.length?m.map(m=>\`<div class="msg-item"><div class="msg-time">\${m.time}</div><div class="msg-content">\${m.content||m.text||JSON.stringify(m)}</div></div>\`).join(''):'<div class="empty">暂无消息</div>'}
async function loadLogs(){const l=await api('/api/logs');document.getElementById('logContent').textContent=l.map(x=>\`[\${x.level.toUpperCase()}] [\${x.type}] \${x.msg}\`).join('\\n')||'暂无日志'}
async function toggleAdapter(n){await api('/api/adapters/toggle/'+n,{method:'POST'});loadAdapters();loadStats()}
async function togglePlugin(n){await api('/api/plugins/toggle/'+n,{method:'POST'});loadPlugins();loadStats()}
async function clearMsgs(){if(confirm('确定清空所有消息?')){await api('/api/messages/clear',{method:'POST'});loadMsgs();loadStats()}}
async function editPlugin(n){const p=await api('/api/plugins/code/'+n);document.getElementById('pluginName').value=n;document.getElementById('pluginCode').value=p.code||'';document.getElementById('editorModal').classList.add('show')}
function newPlugin(){document.getElementById('pluginName').value='';document.getElementById('pluginCode').value='/**\\n * 新插件\\n * @name 新插件\\n * @version 1.0.0\\n */\\nmodule.exports = async (msg) => {\\n  // 插件逻辑\\n  return null;\\n};';document.getElementById('editorModal').classList.add('show')}
async function savePlugin(){const n=document.getElementById('pluginName').value,c=document.getElementById('pluginCode').value;if(!n){alert('请输入插件名称');return}await api('/api/plugins/save/'+n,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:c,meta:{name:n,desc:'自定义插件',version:'1.0.0',author:'user'}})});closeModal();loadPlugins();loadStats()}
async function deletePlugin(n){if(!confirm('确定删除插件 '+n+'?'))return;await api('/api/plugins/delete/'+n,{method:'POST'});loadPlugins();loadStats()}
function closeModal(){document.getElementById('editorModal').classList.remove('show')}
async function logout(){await api('/api/logout');localStorage.removeItem('token');location.href='/'}
async function dbGet(){const t=document.getElementById('dbTable').value,k=document.getElementById('dbKey').value;if(!t||!k){alert('请输入表名和键名');return}const r=await api(\`/api/db/get/\${t}/\${k}\`);document.getElementById('dbResult').textContent=JSON.stringify(r,null,2)}
async function dbSet(){const t=document.getElementById('dbTable').value,k=document.getElementById('dbKey').value;if(!t||!k){alert('请输入表名和键名');return}const v=prompt('请输入值:');if(v===null)return;await api(\`/api/db/set/\${t}/\${k}\`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({value:v})});alert('设置成功');dbGet()}
loadStats();
</script>
</body></html>`);
    }
}

// ==================== 主程序 ====================
function banner() {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   ██████╗ ███╗   ██╗ ██████╗██████╗                     ║
║   ██╔══██╗████╗  ██║██╔════╝██╔══██╗                    ║
║   ██████╔╝██╔██╗ ██║██║     ██████╔╝   █████╗ ██████╗ ███╗   ███╗
║   ██╔══██╗██║╚██╗██║██║     ██╔══██╗  ██╔══██╗██╔══██╗████╗ ████║
║   ██████╔╝██║ ╚████║╚██████╗██║  ██║  ███████║██████╔╝██╔████╔██║
║   ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝╚═╝  ╚═╝  ██╔══██║██╔══██╗██║╚██╔╝██║
║                                       ██║  ██║██║  ██║██║ ╚═╝ ██║
║   ARM Linux Standalone Edition        ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝
║   v${CONFIG.version} - ${IS_BINARY ? 'Binary Mode' : 'Node.js Mode'}
╚══════════════════════════════════════════════════════════╝
`);
}

async function main() {
    banner();
    logger.info('启动中...');
    if (IS_BINARY) {
        logger.info('运行模式: 二进制文件');
        logger.info('工作目录: ' + WORK_DIR);
    } else {
        logger.info('运行模式: Node.js');
    }
    
    const db = new Database();
    const server = new WebServer(db);
    server.start();
    
    logger.info('启动完成!');
    logger.info(`Web管理: http://localhost:${CONFIG.web.port}`);
    logger.info(`默认账号: ${CONFIG.admin.username} / ${CONFIG.admin.password}`);
    
    process.on('SIGINT', () => {
        logger.info('关闭中...');
        process.exit(0);
    });
}

main().catch(e => {
    logger.error('错误: ' + e.message);
    process.exit(1);
});