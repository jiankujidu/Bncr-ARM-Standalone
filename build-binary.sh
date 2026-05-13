#!/bin/bash
# Bncr-ARM 二进制构建脚本
# 使用方法: ./build-binary.sh [架构]
# 支持架构: x64, arm64, armv7l

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCH="${1:-x64}"
VERSION="2.0.0"
NODE_VERSION="18"

echo "=========================================="
echo "Bncr-ARM 二进制构建脚本"
echo "版本: v${VERSION}"
echo "目标架构: ${ARCH}"
echo "=========================================="

# 检查依赖
check_deps() {
    echo "[1/5] 检查依赖..."
    if ! command -v node &> /dev/null; then
        echo "错误: 未安装 Node.js"
        echo "请安装 Node.js >= 16"
        exit 1
    fi
    
    NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VER" -lt 16 ]; then
        echo "错误: Node.js 版本过低 (需要 >= 16)"
        exit 1
    fi
    
    echo "✓ Node.js 版本: $(node -v)"
}

# 安装 pkg
install_pkg() {
    echo "[2/5] 安装 pkg..."
    if ! command -v pkg &> /dev/null; then
        echo "正在安装 pkg..."
        npm install -g pkg
    fi
    echo "✓ pkg 已安装"
}

# 准备目录
prepare_dirs() {
    echo "[3/5] 准备目录..."
    cd "$SCRIPT_DIR"
    mkdir -p dist
    rm -rf dist/*
    echo "✓ 目录准备完成"
}

# 构建二进制
build_binary() {
    echo "[4/5] 构建二进制文件..."
    cd "$SCRIPT_DIR"
    
    # 根据架构选择目标
    case $ARCH in
        x64|amd64)
            TARGET="node${NODE_VERSION}-linux-x64"
            OUTPUT="bncr-arm-linux-x64"
            ;;
        arm64|aarch64)
            TARGET="node${NODE_VERSION}-linux-arm64"
            OUTPUT="bncr-arm-linux-arm64"
            ;;
        armv7l|arm)
            TARGET="node${NODE_VERSION}-linux-armv7"
            OUTPUT="bncr-arm-linux-armv7"
            ;;
        *)
            echo "错误: 不支持的架构: $ARCH"
            echo "支持的架构: x64, arm64, armv7l"
            exit 1
            ;;
    esac
    
    echo "目标平台: $TARGET"
    echo "输出文件: $OUTPUT"
    
    # 构建
    pkg -t "$TARGET" \
        --output "dist/$OUTPUT" \
        --options max_old_space_size=4096 \
        .
    
    # 添加执行权限
    chmod +x "dist/$OUTPUT"
    
    echo "✓ 构建完成: dist/$OUTPUT"
}

# 验证构建
verify_build() {
    echo "[5/5] 验证构建..."
    cd "$SCRIPT_DIR"
    
    OUTPUT_FILE=$(ls dist/bncr-arm-* 2>/dev/null | head -1)
    if [ -z "$OUTPUT_FILE" ]; then
        echo "错误: 未找到构建输出文件"
        exit 1
    fi
    
    FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
    echo "✓ 文件大小: $FILE_SIZE"
    
    # 检查文件类型
    if command -v file &> /dev/null; then
        FILE_TYPE=$(file "$OUTPUT_FILE")
        echo "✓ 文件类型: $FILE_TYPE"
    fi
    
    echo ""
    echo "=========================================="
    echo "构建成功!"
    echo "输出文件: $OUTPUT_FILE"
    echo "文件大小: $FILE_SIZE"
    echo "=========================================="
    echo ""
    echo "使用方法:"
    echo "  1. 复制到目标机器: scp $OUTPUT_FILE user@host:/path/"
    echo "  2. 运行: ./$OUTPUT_FILE"
    echo "  3. 访问: http://localhost:9090"
    echo ""
    echo "默认账号: admin / admin123"
}

# 主流程
main() {
    check_deps
    install_pkg
    prepare_dirs
    build_binary
    verify_build
}

main "$@"
