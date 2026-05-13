# Bncr-ARM Standalone v2.0.0

功能对齐Docker版本的ARM Linux聊天机器人框架，支持**二进制启动**。

## ✨ 特点

- ✅ **单文件运行** - 支持Node.js和二进制两种方式
- ✅ **二进制打包** - 使用pkg打包成独立可执行文件
- ✅ **Web管理** - 完整的登录认证 + 管理面板
- ✅ **插件系统** - 在线编辑、启用/禁用插件
- ✅ **适配器系统** - 多平台适配器管理
- ✅ **数据库操作** - get/set接口
- ✅ **零依赖** - 仅需Node.js >= 16

## 🚀 快速开始

### 方式1: Node.js启动

```bash
node bncr-arm.js
```

### 方式2: 二进制启动 (推荐)

```bash
# 1. 下载预编译二进制
wget https://github.com/yourname/bncr-arm/releases/download/v2.0.0/bncr-arm-linux-x64
chmod +x bncr-arm-linux-x64

# 2. 运行
./bncr-arm-linux-x64

# 3. 访问
# http://localhost:9090
```

## 🔐 登录

- **账号**: `admin`
- **密码**: `admin123`

## 📦 构建二进制

### 自动构建

```bash
chmod +x build-binary.sh
./build-binary.sh [架构]

# 支持架构:
./build-binary.sh x64      # x86_64
./build-binary.sh arm64    # ARM64
./build-binary.sh armv7    # ARMv7
```

### 手动构建

```bash
# 1. 安装pkg
npm install -g pkg

# 2. 构建
pkg -t node18-linux-x64 -o bncr-arm .

# 3. 运行
./bncr-arm
```

## 📁 目录结构

```
Bncr-ARM-Standalone/
├── bncr-arm.js              # 主程序
├── package.json             # 包配置
├── build-binary.sh          # 构建脚本
├── README.md                # 说明文档
└── BncrData/                # 数据目录(自动创建)
    ├── config/
    │   └── system.json      # 系统配置
    ├── db/
    │   └── bncr.db.json     # 数据库
    ├── logs/
    │   └── bncr-YYYY-MM-DD.log
    ├── plugins/
    │   ├── system.js        # 系统插件
    │   ├── group.js         # 群管理插件
    │   ├── echo.js          # 回声插件
    │   └── npm.js           # NPM插件
    └── public/              # 静态文件
```

## 🎮 管理功能

### 1. 系统统计
- 消息总数
- 用户数量
- 活跃插件/适配器
- 运行时间
- 内存使用
- Node版本

### 2. 适配器管理
| 适配器 | 类型 | 描述 |
|--------|------|------|
| tgbot | telegram | Telegram Bot |
| HumanTG | telegram | Telegram用户 |
| qqbot | qq | QQ Bot |
| wxKeAImao | wechat | 微信可爱猫 |
| wxQianxun | wechat | 微信千寻 |
| system | system | 系统适配器 |

### 3. 插件管理
- 在线编辑插件代码
- 启用/禁用插件
- 新建插件
- 删除插件

### 4. 消息记录
- 查看消息
- 清空消息

### 5. 系统日志
- 实时日志查看

### 6. 数据库操作
- get 表 键
- set 表 键 值

## 📡 API接口

### 公开接口
| 端点 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 登录页面 |
| `/login` | POST | 登录获取Token |
| `/api/status` | GET | 系统状态 |

### 需要认证
| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin` | GET | 管理面板 |
| `/api/stats` | GET | 统计数据 |
| `/api/plugins` | GET | 插件列表 |
| `/api/plugins/code/:name` | GET | 获取插件代码 |
| `/api/plugins/save/:name` | POST | 保存插件 |
| `/api/plugins/toggle/:name` | POST | 切换插件状态 |
| `/api/plugins/delete/:name` | POST | 删除插件 |
| `/api/adapters` | GET | 适配器列表 |
| `/api/adapters/toggle/:name` | POST | 切换适配器状态 |
| `/api/messages` | GET | 消息列表 |
| `/api/messages/clear` | POST | 清空消息 |
| `/api/logs` | GET | 系统日志 |
| `/api/db/get/:table/:key` | GET | 数据库查询 |
| `/api/db/set/:table/:key` | POST | 数据库设置 |
| `/api/logout` | GET | 退出登录 |

## 🔌 内置插件

### 系统插件
```javascript
/**
 * 系统插件
 * @name 系统插件
 * @rule ^get\s+(\S+)\s+(\S+)$
 * @rule ^set\s+(\S+)\s+(\S+)\s+(.*)$
 * @rule ^重启$|^time$|^启动时间$|^机器码$|^bncr版本$
 * @version 1.0.0
 * @admin true
 * @author system
 */
```

**命令:**
- `get 表 键` - 查询数据
- `set 表 键 值` - 设置数据
- `重启` - 重启系统
- `time` - 当前时间
- `启动时间` - 系统启动时间
- `机器码` - 显示机器码
- `bncr版本` - 显示版本

### 群管理插件
**命令:**
- `群id` - 显示群ID
- `我的id` - 显示用户ID
- `监听该群` - 监听群消息
- `屏蔽该群` - 屏蔽群消息
- `不回复该群` - 不自动回复
- `回复该群` - 自动回复

### 回声插件
**命令:**
- `echo 内容` - 返回内容

### NPM插件
**命令:**
- `npm i 包名` - 安装NPM包

## ⚙️ 配置

编辑 `BncrData/config/system.json`:

```json
{
  "adapters": {
    "tgbot": { "enabled": false, "type": "telegram" },
    "qqbot": { "enabled": false, "type": "qq" }
  },
  "plugins": {
    "system": { "enabled": true }
  },
  "settings": {
    "logLevel": "info",
    "maxMsgs": 1000
  }
}
```

## 🔧 系统要求

- Node.js >= 16.0.0 (Node.js方式)
- Linux系统（ARM/x64均可）
- 内存 >= 64MB

## 📋 常用命令

```bash
# Node.js方式
node bncr-arm.js
PORT=8080 node bncr-arm.js

# 二进制方式
./bncr-arm-linux-x64
PORT=8080 ./bncr-arm-linux-x64

# 后台运行
nohup ./bncr-arm-linux-x64 &

# 查看日志
tail -f BncrData/logs/bncr-*.log
```

## 🐛 故障排除

### 端口被占用
```bash
PORT=8080 ./bncr-arm-linux-x64
```

### 权限不足
```bash
chmod +x bncr-arm-linux-x64
```

### 数据目录权限
```bash
chmod -R 755 BncrData/
```

## 📝 更新日志

### v2.0.0 (2024-01-15)
- 支持二进制打包
- 完整Web管理界面
- 插件在线编辑
- 适配器管理
- 数据库操作

### v1.0.0 (2024-01-15)
- 初始版本
- 基础Web界面

## 📄 许可证

MIT License

---

**解压即用，一键启动！** 🎉