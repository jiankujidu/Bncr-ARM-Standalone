#!/bin/bash

# Bncr-ARM Standalone 启动脚本

cd "$(dirname "$0")"

echo "=========================================="
echo "  Bncr-ARM Standalone"
echo "  单文件版聊天机器人框架"
echo "=========================================="
echo ""

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "错误: 未安装Node.js"
    echo "请安装Node.js 16+: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt "16" ]; then
    echo "错误: Node.js版本过低，需要>=16.0.0"
    exit 1
fi

echo "Node.js版本: $(node -v)"
echo ""

# 运行
if [ "$1" == "daemon" ]; then
    echo "后台模式启动..."
    nohup node bncr-arm.js > /dev/null 2>&1 &
    echo "PID: $!"
    echo "查看日志: tail -f logs/bncr-$(date +%Y-%m-%d).log"
else
    echo "正在启动Bncr-ARM..."
    echo "按Ctrl+C停止"
    echo ""
    node bncr-arm.js
fi