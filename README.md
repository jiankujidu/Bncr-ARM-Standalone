# Bncr-ARM Standalone

ARM Linux 单文件聊天机器人框架

## 特性

- ✅ **单文件运行** - 一个文件包含所有功能
- ✅ **零依赖** - 纯 Node.js，无需额外安装
- ✅ **内置数据库** - JSON 文件存储，无需外部数据库
- ✅ **完整 Web 界面** - 响应式管理面板
- ✅ **插件系统** - 支持热加载插件
- ✅ **多平台** - Linux x64/ARM64, Windows, macOS

## 快速开始

### 方式一：源码运行（推荐）

```bash
# 下载
curl -O https://raw.githubusercontent.com/jiankujidu/Bncr-ARM-Standalone/main/bncr-arm.js

# 运行
node bncr-arm.js

# 访问 http://localhost:9090
# 账号: admin / admin123
```

### 方式二：自动安装脚本

```bash
curl -fsSL https://raw.githubusercontent.com/jiankujidu/Bncr-ARM-Standalone/main/install.sh | bash
```

### 方式三：下载预编译二进制

从 [Releases](https://github.com/jiankujidu/Bncr-ARM-Standalone/releases) 下载对应平台的二进制文件：

| 平台 | 文件 |
|------|------|
| Linux x64 | `bncr-arm-linux` |
| Linux ARM64 | `bncr-arm-arm64` |
| Windows | `bncr-arm-win.exe` |
| macOS x64 | `bncr-arm-macos` |
| macOS ARM64 | `bncr-arm-macos-arm64` |

```bash
chmod +x bncr-arm-linux
./bncr-arm-linux
```

## 打包成可执行文件

如果你想自己打包成独立可执行文件：

```bash
# 安装 pkg
npm install -g pkg

# 打包 Linux x64
pkg -t node18-linux-x64 -o bncr-arm-linux .

# 打包 Linux ARM64
pkg -t node18-linux-arm64 -o bncr-arm-arm64 .

# 打包 Windows
pkg -t node18-win-x64 -o bncr-arm-win.exe .

# 打包 macOS
pkg -t node18-macos-x64 -o bncr-arm-macos .
```

## 目录结构

```
BncrData/
├── config/
│   └── system.json      # 系统配置
├── db/                  # JSON 数据库
├── logs/                # 日志文件
└── plugins/             # 插件目录
    ├── system.js
    ├── echo.js
    └── help.js
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | `9090` |
| `BNCR_DATA` | 数据目录 | `./BncrData` |

```bash
PORT=8080 BNCR_DATA=/opt/bncr node bncr-arm.js
```

## 插件开发

在 `BncrData/plugins/` 目录创建 `.js` 文件：

```javascript
// my-plugin.js
module.exports = async (msg, db) => {
    // msg: { text, user, group, adapter }
    // db: { get(table, key), set(table, key, value) }
    
    if (msg.text === '你好') {
        return '你好！我是 Bncr-ARM';
    }
    
    // 查询数据
    if (msg.text === '查询') {
        const val = db.get('users', msg.user);
        return val ? `找到: ${val}` : '未找到';
    }
    
    // 存储数据
    if (msg.text.startsWith('存储 ')) {
        const val = msg.text.slice(3);
        db.set('users', msg.user, val);
        return '已存储';
    }
    
    return null; // 返回 null 表示不处理
};
```

## 系统命令

| 命令 | 说明 |
|------|------|
| `ping` | 测试响应 |
| `time` | 当前时间 |
| `版本` | 版本信息 |
| `帮助` | 显示帮助 |
| `get 表名 键名` | 查询数据 |
| `set 表名 键名 值` | 设置数据 |
| `echo 内容` | 回声测试 |

## Web 管理界面

访问 `http://localhost:9090` 进入管理面板：

- **📊 统计** - 系统运行状态
- **🔌 适配器** - 启用/禁用适配器
- **🔧 插件** - 管理插件
- **💬 消息** - 查看消息记录
- **📝 日志** - 系统日志
- **🗄️ 数据库** - 数据操作
- **🔑 Token** - 会话管理

## 系统服务 (systemd)

```bash
# 复制服务文件
sudo cp ~/.bncr-arm/bncr-arm.service /etc/systemd/system/

# 启用并启动
sudo systemctl daemon-reload
sudo systemctl enable --now bncr-arm

# 查看状态
sudo systemctl status bncr-arm

# 查看日志
sudo journalctl -u bncr-arm -f
```

## 更新

```bash
# 停止服务
sudo systemctl stop bncr-arm

# 重新下载/构建
# ...

# 启动服务
sudo systemctl start bncr-arm
```

## 技术栈

- **后端**: Node.js (原生 http 模块)
- **数据库**: JSON 文件存储
- **前端**: 原生 HTML/CSS/JavaScript
- **打包**: pkg

## 许可证

MIT License

## 作者

jiankujidu
