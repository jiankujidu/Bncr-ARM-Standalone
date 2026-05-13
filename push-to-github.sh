#!/bin/bash
# Bncr-ARM Standalone GitHub 上传脚本
# 使用方法: ./push-to-github.sh YOUR_GITHUB_USERNAME

set -e

USERNAME="${1:-}"
REPO_NAME="Bncr-ARM-Standalone"

if [ -z "$USERNAME" ]; then
    echo "错误: 请提供GitHub用户名"
    echo "用法: ./push-to-github.sh YOUR_GITHUB_USERNAME"
    exit 1
fi

echo "=========================================="
echo "Bncr-ARM Standalone GitHub 上传"
echo "=========================================="
echo ""
echo "仓库: $REPO_NAME"
echo "用户: $USERNAME"
echo ""

# 检查git remote
if git remote | grep -q origin; then
    echo "移除旧的remote..."
    git remote remove origin
fi

# 添加GitHub remote
echo "添加GitHub remote..."
git remote add origin "https://github.com/$USERNAME/$REPO_NAME.git"

# 重命名分支
echo "重命名分支为main..."
git branch -m main

echo ""
echo "=========================================="
echo "准备推送到GitHub"
echo "=========================================="
echo ""
echo "请确保:"
echo "1. 已在GitHub创建仓库: https://github.com/new"
echo "   仓库名: $REPO_NAME"
echo "   不要初始化README"
echo ""
echo "2. 已生成Personal Access Token:"
echo "   https://github.com/settings/tokens"
echo "   权限: repo (完整权限)"
echo ""
echo "按Enter继续推送..."
read

echo "推送到GitHub..."
git push -u origin main

echo ""
echo "=========================================="
echo "推送完成!"
echo "=========================================="
echo ""
echo "仓库地址: https://github.com/$USERNAME/$REPO_NAME"
echo ""
echo "GitHub Release构建二进制:"
echo "1. 访问: https://github.com/$USERNAME/$REPO_NAME/releases/new"
echo "2. 创建新Release (如: v2.0.0)"
echo "3. 上传二进制文件: dist/bncr-arm-linux-*"
echo ""
