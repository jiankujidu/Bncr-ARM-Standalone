#!/bin/bash
# Bncr-ARM 安装脚本
# 支持: Linux x64, Linux ARM64

set -e

REPO="jiankujidu/Bncr-ARM-Standalone"
INSTALL_DIR="${BNCR_INSTALL:-$HOME/.bncr-arm}"
BIN_DIR="$INSTALL_DIR/bin"
DATA_DIR="$INSTALL_DIR/data"

# 检测架构
ARCH=$(uname -m)
OS=$(uname -s | tr '[:upper:]' '[:lower:]')

case "$ARCH" in
    x86_64|amd64)
        TARGET="linux-x64"
        BINARY="bncr-arm-linux"
        ;;
    aarch64|arm64)
        TARGET="linux-arm64"
        BINARY="bncr-arm-arm64"
        ;;
    armv7l|armhf)
        TARGET="linux-armv7"
        BINARY="bncr-arm-armv7"
        ;;
    *)
        echo "❌ 不支持的架构: $ARCH"
        echo "请使用源码运行: node bncr-arm.js"
        exit 1
        ;;
esac

echo "🤖 Bncr-ARM 安装程序"
echo "===================="
echo ""
echo "系统: $OS"
echo "架构: $ARCH"
echo "目标: $TARGET"
echo ""

# 创建目录
echo "📁 创建目录..."
mkdir -p "$BIN_DIR" "$DATA_DIR"

# 下载最新版本
echo "⬇️ 下载最新版本..."
LATEST_URL="https://github.com/$REPO/releases/latest/download/$BINARY"

if command -v curl &> /dev/null; then
    curl -fsSL -o "$BIN_DIR/bncr-arm" "$LATEST_URL" || {
        echo "⚠️ 下载失败，尝试备用地址..."
        curl -fsSL -o "$BIN_DIR/bncr-arm" "https://raw.githubusercontent.com/$REPO/main/dist/$BINARY"
    }
elif command -v wget &> /dev/null; then
    wget -q -O "$BIN_DIR/bncr-arm" "$LATEST_URL" || {
        echo "⚠️ 下载失败，尝试备用地址..."
        wget -q -O "$BIN_DIR/bncr-arm" "https://raw.githubusercontent.com/$REPO/main/dist/$BINARY"
    }
else
    echo "❌ 需要 curl 或 wget"
    exit 1
fi

# 添加执行权限
chmod +x "$BIN_DIR/bncr-arm"

# 创建启动脚本
cat > "$BIN_DIR/bncr-arm.sh" << 'SCRIPT'
#!/bin/bash
INSTALL_DIR="${BNCR_INSTALL:-$HOME/.bncr-arm}"
BIN_DIR="$INSTALL_DIR/bin"
DATA_DIR="$INSTALL_DIR/data"
export BNCR_DATA="$DATA_DIR"
cd "$INSTALL_DIR"
"$BIN_DIR/bncr-arm" "$@"
SCRIPT

chmod +x "$BIN_DIR/bncr-arm.sh"

# 创建 systemd 服务
cat > "$INSTALL_DIR/bncr-arm.service" << 'SERVICE'
[Unit]
Description=Bncr-ARM Chatbot Framework
After=network.target

[Service]
Type=simple
User=%I
Environment="BNCR_DATA=%h/.bncr-arm/data"
ExecStart=%h/.bncr-arm/bin/bncr-arm
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

# 创建环境变量文件
cat > "$INSTALL_DIR/.env" << 'ENV'
# Bncr-ARM 配置
PORT=9090
BNCR_DATA=$HOME/.bncr-arm/data
ENV

echo ""
echo "✅ 安装完成!"
echo ""
echo "📍 安装目录: $INSTALL_DIR"
echo "📊 数据目录: $DATA_DIR"
echo ""
echo "🚀 启动方式:"
echo ""
echo "  1. 直接运行:"
echo "     $BIN_DIR/bncr-arm"
echo ""
echo "  2. 使用脚本:"
echo "     $BIN_DIR/bncr-arm.sh"
echo ""
echo "  3. 系统服务 (systemd):"
echo "     sudo cp $INSTALL_DIR/bncr-arm.service /etc/systemd/system/"
echo "     sudo systemctl daemon-reload"
echo "     sudo systemctl enable --now bncr-arm"
echo ""
echo "🌐 访问地址: http://localhost:9090"
echo "👤 默认账号: admin / admin123"
echo ""
echo "💡 添加到 PATH:"
echo "     echo 'export PATH=\"\$HOME/.bncr-arm/bin:\$PATH\"' >> ~/.bashrc"
echo "     source ~/.bashrc"
echo ""
