# Bncr-ARM Termux 完整安装教程

> 在 Android 手机上运行 Bncr 聊天机器人框架

## 📱 准备工作

### 1. 安装 Termux

从 F-Droid 下载 Termux（推荐，Google Play 版本已停止维护）：

```
https://f-droid.org/packages/com.termux/
```

或者使用镜像源：

```bash
# 清华镜像
https://mirrors.tuna.tsinghua.edu.cn/fdroid/repo/
```

### 2. 更新 Termux

打开 Termux，执行：

```bash
# 更新软件包
pkg update && pkg upgrade -y

# 安装必要工具
pkg install -y git curl wget nano

# 安装 Node.js
pkg install -y nodejs-lts

# 验证安装
node -v
npm -v
```

## 🚀 安装 Bncr-ARM

### 方式一：直接下载（推荐）

```bash
# 创建工作目录
mkdir -p ~/bncr && cd ~/bncr

# 下载 Bncr-ARM
curl -L -o bncr-arm.js https://raw.githubusercontent.com/jiankujidu/Bncr-ARM-Standalone/main/bncr-arm.js

# 或者使用 wget
wget https://raw.githubusercontent.com/jiankujidu/Bncr-ARM-Standalone/main/bncr-arm.js

# 设置权限
chmod +x bncr-arm.js

# 运行
node bncr-arm.js
```

### 方式二：Git 克隆

```bash
# 安装 git
pkg install -y git

# 克隆仓库
cd ~
git clone https://github.com/jiankujidu/Bncr-ARM-Standalone.git

# 进入目录
cd Bncr-ARM-Standalone

# 运行
node bncr-arm.js
```

## 🔧 后台运行

### 使用 nohup

```bash
# 后台运行
nohup node bncr-arm.js > bncr.log 2>&1 &

# 查看进程
ps aux | grep bncr

# 停止进程
kill <PID>
```

### 使用 pm2（推荐）

```bash
# 安装 pm2
npm install -g pm2

# 启动
pm2 start bncr-arm.js --name bncr

# 查看状态
pm2 status

# 查看日志
pm2 logs bncr

# 停止
pm2 stop bncr

# 重启
pm2 restart bncr

# 开机自启
pm2 startup
pm2 save
```

### 使用 screen

```bash
# 安装 screen
pkg install -y screen

# 创建会话
screen -S bncr

# 运行
node bncr-arm.js

# 分离会话 (Ctrl+A, 然后按 D)

# 重新连接
screen -r bncr

# 列出会话
screen -ls

# 终止会话
screen -X -S bncr quit
```

## 🌐 访问管理面板

### 本地访问

在 Termux 中打开浏览器：

```bash
# 安装 termux-api（可选）
pkg install -y termux-api

# 在浏览器中打开
termux-open-url http://localhost:9090
```

### 局域网访问

```bash
# 查看手机 IP
ifconfig

# 或使用
ip addr show wlan0
```

然后在电脑浏览器访问：

```
http://<手机IP>:9090
```

**注意**：需要在同一 WiFi 网络下。

### 公网访问（内网穿透）

#### 使用 ngrok

```bash
# 安装 ngrok
pkg install -y unstable-repo
pkg install -y ngrok

# 或者手动下载
cd ~
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm64.tgz
tar xvzf ngrok-v3-stable-linux-arm64.tgz
chmod +x ngrok
mv ngrok $PREFIX/bin/

# 注册并获取 token：https://dashboard.ngrok.com/get-started/your-authtoken
ngrok config add-authtoken YOUR_TOKEN

# 启动隧道
ngrok http 9090
```

#### 使用 frp

```bash
# 下载 frp
cd ~
wget https://github.com/fatedier/frp/releases/download/v0.52.3/frp_0.52.3_linux_arm64.tar.gz
tar xzvf frp_0.52.3_linux_arm64.tar.gz
cd frp_0.52.3_linux_arm64

# 配置 frpc.toml
cat > frpc.toml << 'EOF'
serverAddr = "your-frp-server.com"
serverPort = 7000
auth.token = "your-token"

[[proxies]]
name = "bncr"
type = "http"
localPort = 9090
customDomains = ["bncr.your-domain.com"]
EOF

# 启动
./frpc -c frpc.toml
```

## ⚙️ 配置文件

### 系统配置

```bash
# 编辑配置
nano ~/bncr/BncrData/config/system.json
```

示例配置：

```json
{
  "adapters": {
    "tgbot": {
      "enabled": true,
      "type": "telegram",
      "desc": "Telegram Bot",
      "config": {
        "token": "YOUR_BOT_TOKEN"
      }
    }
  },
  "settings": {
    "logLevel": "info",
    "maxMsgs": 5000,
    "webTitle": "我的Bncr机器人"
  }
}
```

### 环境变量

```bash
# 设置端口
export PORT=8080

# 设置数据目录
export BNCR_DATA=/sdcard/bncr-data

# 运行
node bncr-arm.js
```

## 📂 数据备份

### 备份到手机存储

```bash
# 创建备份目录
mkdir -p /sdcard/bncr-backup

# 备份数据
cp -r ~/bncr/BncrData /sdcard/bncr-backup/

# 或者压缩备份
cd ~
tar czvf /sdcard/bncr-backup/bncr-$(date +%Y%m%d).tar.gz bncr/BncrData
```

### 自动备份脚本

```bash
cat > ~/bncr/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/sdcard/bncr-backup"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
cd ~
tar czvf "$BACKUP_DIR/bncr-$DATE.tar.gz" bncr/BncrData

# 保留最近10个备份
ls -t "$BACKUP_DIR"/bncr-*.tar.gz | tail -n +11 | xargs rm -f

echo "备份完成: $BACKUP_DIR/bncr-$DATE.tar.gz"
EOF

chmod +x ~/bncr/backup.sh

# 添加到定时任务（需要安装 cronie）
pkg install -y cronie
(crontab -l 2>/dev/null; echo "0 0 * * * ~/bncr/backup.sh") | crontab -
```

## 🔋 性能优化

### 降低内存使用

```bash
# 使用 --max-old-space-size 限制内存
node --max-old-space-size=256 bncr-arm.js
```

### 关闭日志

编辑 `BncrData/config/system.json`：

```json
{
  "settings": {
    "logLevel": "error"
  }
}
```

### 使用 SWAP

```bash
# 创建 1GB SWAP
fallocate -l 1G ~/.swapfile
chmod 600 ~/.swapfile
mkswap ~/.swapfile
swapon ~/.swapfile

# 添加到 fstab
echo "$HOME/.swapfile none swap sw 0 0" >> $PREFIX/etc/fstab

# 查看 SWAP
free -h
```

## 🐛 常见问题

### 1. 端口被占用

```bash
# 查找占用端口的进程
netstat -tulpn | grep 9090

# 或者使用 fuser
pkg install -y psmisc
fuser -k 9090/tcp

# 更换端口运行
PORT=8080 node bncr-arm.js
```

### 2. 权限不足

```bash
# 修复权限
chmod -R 755 ~/bncr

# 如果数据目录在 /sdcard，可能需要存储权限
termux-setup-storage
```

### 3. Node.js 版本过低

```bash
# 更新 Node.js
pkg uninstall nodejs
pkg install -y nodejs-lts

# 或者使用 nvm
pkg install -y nvm
source $PREFIX/etc/profile.d/nvm.sh
nvm install 18
nvm use 18
```

### 4. 无法访问 Web 面板

```bash
# 检查服务是否运行
curl http://localhost:9090/api/status

# 检查防火墙（Termux 通常不需要）
# 确保手机没有限制 Termux 的网络
```

### 5. 中文显示乱码

```bash
# 设置 UTF-8
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# 安装 locale
pkg install -y locales
```

### 6. 电池优化

Android 可能会杀死后台应用，建议：

1. **关闭电池优化**：设置 → 应用 → Termux → 电池 → 无限制
2. **锁定后台**：最近任务 → Termux → 锁定
3. **忽略省电模式**：设置 → 电池 → 省电模式 → 不限制 Termux

## 📱 一键安装脚本

```bash
cat > ~/install-bncr.sh << 'EOF'
#!/bin/bash
set -e

echo "🤖 Bncr-ARM Termux 安装脚本"
echo "=============================="

# 更新软件包
echo "📦 更新软件包..."
pkg update -y

# 安装依赖
echo "🔧 安装依赖..."
pkg install -y nodejs-lts git curl wget

# 创建工作目录
echo "📁 创建工作目录..."
mkdir -p ~/bncr && cd ~/bncr

# 下载 Bncr-ARM
echo "⬇️ 下载 Bncr-ARM..."
if [ -f "bncr-arm.js" ]; then
    echo "⚠️ 文件已存在，跳过下载"
else
    curl -L -o bncr-arm.js https://raw.githubusercontent.com/jiankujidu/Bncr-ARM-Standalone/main/bncr-arm.js
    chmod +x bncr-arm.js
fi

# 安装 pm2
echo "🚀 安装 pm2..."
npm install -g pm2

# 创建启动脚本
cat > start.sh << 'INNEREOF'
#!/bin/bash
cd ~/bncr
node bncr-arm.js
INNEREOF
chmod +x start.sh

# 使用 pm2 启动
echo "▶️ 启动 Bncr-ARM..."
pm2 start bncr-arm.js --name bncr
pm2 save

echo ""
echo "✅ 安装完成！"
echo "=============================="
echo "管理面板: http://localhost:9090"
echo "默认账号: admin / admin123"
echo ""
echo "常用命令:"
echo "  pm2 status    - 查看状态"
echo "  pm2 logs bncr - 查看日志"
echo "  pm2 stop bncr - 停止服务"
echo "  pm2 restart bncr - 重启服务"
EOF

chmod +x ~/install-bncr.sh
bash ~/install-bncr.sh
```

## 🔗 相关链接

- GitHub: https://github.com/jiankujidu/Bncr-ARM-Standalone
- Bncr 官方: https://anmours.github.io/Bncr
- Termux Wiki: https://wiki.termux.com

## 💡 提示

1. **保持 Termux 运行**：使用 `screen` 或 `pm2` 保持后台运行
2. **定期备份**：数据存储在 `~/bncr/BncrData/`
3. **安全注意**：默认密码是 admin123，请及时修改
4. **网络权限**：确保 Termux 有网络访问权限

---

**在 Termux 上享受你的 Bncr 机器人吧！** 🤖
