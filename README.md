# Bncr-ARM Standalone v3.0.0

> 单文件运行的 Bncr 聊天机器人框架，Termux 优化版

## ✨ 特点

- ✅ **单文件运行** - 仅需 `bncr-arm.js` 一个文件
- ✅ **零依赖** - 仅需 Node.js，无需 npm install
- ✅ **Termux 优化** - 专为 Android Termux 环境设计
- ✅ **Web 管理** - 完整的可视化后台管理
- ✅ **插件系统** - 在线编辑、启用/禁用插件
- ✅ **多平台适配器** - Telegram、QQ、微信等
- ✅ **数据持久化** - JSON 数据库存储

## 🚀 快速开始

### Termux 安装（推荐）

```bash
# 1. 安装 Node.js
pkg update
pkg install nodejs-lts

# 2. 下载 Bncr-ARM
mkdir -p ~/bncr && cd ~/bncr
curl -O https://raw.githubusercontent.com/jiankujidu/Bncr-ARM-Standalone/main/bncr-arm.js

# 3. 运行
node bncr-arm.js
```

### 后台运行

```bash
# 使用 nohup
nohup node bncr-arm.js > bncr.log 2>&1 &

# 使用 pm2
npm install -g pm2
pm2 start bncr-arm.js --name bncr
pm2 save
```

## 🔐 访问管理面板

- **地址**: http://localhost:9090
- **账号**: `admin`
- **密码**: `admin123`

### 局域网访问

```bash
# 查看手机 IP
ifconfig

# 然后在电脑浏览器访问
http://<手机IP>:9090
```

## 📱 详细 Termux 教程

查看 [TERMUX_GUIDE.md](TERMUX_GUIDE.md) 获取完整的 Termux 安装教程，包括：

- 完整安装步骤
- 后台运行方法
- 内网穿透配置
- 数据备份
- 常见问题解决

## 🎮 功能介绍

### 1. 系统统计
- 消息总数
- 用户数量
- 活跃插件/适配器
- 运行时间
- 内存使用

### 2. 适配器管理
支持平台：
- Telegram Bot
- QQ Bot
- 微信 Bot
- 系统适配器

### 3. 插件系统
- 在线编辑插件代码
- 启用/禁用插件
- 新建插件
- 删除插件

### 4. 数据库操作
- get 表 键 - 查询数据
- set 表 键 值 - 设置数据

### 5. 消息记录
- 查看消息历史
- 清空消息

### 6. 系统日志
- 实时查看日志

## 🔧 内置插件

### system 插件
- `ping` - 测试连通
- `time` - 当前时间
- `版本` - 版本信息
- `get 表 键` - 查询数据
- `set 表 键 值` - 设置数据

### echo 插件
- `echo 内容` - 回声

### help 插件
- `帮助` - 显示菜单

## 📁 目录结构

```
~/bncr/
├── bncr-arm.js          # 主程序
└── BncrData/            # 数据目录（自动创建）
    ├── config/
    │   └── system.json  # 系统配置
    ├── db/
    │   └── data.json    # 数据库
    ├── logs/
    │   └── YYYY-MM-DD.log
    └── plugins/
        ├── system.js    # 系统插件
        ├── echo.js      # 回声插件
        └── help.js      # 帮助插件
```

## ⚙️ 环境变量

```bash
# 修改端口
PORT=8080 node bncr-arm.js

# 修改数据目录
BNCR_DATA=/sdcard/bncr-data node bncr-arm.js
```

## 🔋 性能优化

```bash
# 限制内存使用
node --max-old-space-size=256 bncr-arm.js
```

## 🐛 常见问题

### 1. 端口被占用
```bash
# 更换端口
PORT=8080 node bncr-arm.js
```

### 2. 权限不足
```bash
chmod +x bncr-arm.js
```

### 3. 无法访问 Web
```bash
# 检查服务是否运行
curl http://localhost:9090/api/status
```

## 📡 API 接口

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/status` | GET | 系统状态 |
| `/api/stats` | GET | 统计数据 |
| `/api/plugins` | GET | 插件列表 |
| `/api/adapters` | GET | 适配器列表 |
| `/api/messages` | GET | 消息列表 |
| `/api/logs` | GET | 系统日志 |

## 🔗 相关链接

- GitHub: https://github.com/jiankujidu/Bncr-ARM-Standalone
- Bncr 官方: https://anmours.github.io/Bncr
- Termux: https://termux.dev

## 📄 许可证

MIT License

---

**在 Termux 上享受你的 Bncr 机器人吧！** 🤖
