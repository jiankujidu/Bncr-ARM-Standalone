#!/bin/bash

# Bncr-ARM Standalone 一键运行脚本
# 自动检查环境并启动

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                          ║${NC}"
echo -e "${BLUE}║   Bncr-ARM Standalone - 一键运行脚本                    ║${NC}"
echo -e "${BLUE}║   单文件版聊天机器人框架                                  ║${NC}"
echo -e "${BLUE}║                                                          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# 检查Node.js
check_node() {
    echo -e "${YELLOW}[检查]${NC} 检查Node.js环境..."
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}[错误]${NC} 未安装Node.js"
        echo ""
        echo "请安装Node.js 16+:"
        echo "  Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
        echo "  CentOS/RHEL:   curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash - && sudo yum install -y nodejs"
        echo "  其他系统:      https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)
    
    echo -e "${GREEN}[通过]${NC} Node.js版本: $NODE_VERSION"
    
    if [ "$NODE_MAJOR" -lt "16" ]; then
        echo -e "${RED}[错误]${NC} Node.js版本过低，需要>=16.0.0"
        exit 1
    fi
}

# 检查文件
check_files() {
    echo -e "${YELLOW}[检查]${NC} 检查项目文件..."
    
    if [ ! -f "bncr-arm.js" ]; then
        echo -e "${RED}[错误]${NC} 未找到 bncr-arm.js"
        exit 1
    fi
    
    echo -e "${GREEN}[通过]${NC} 项目文件完整"
}

# 显示菜单
show_menu() {
    echo ""
    echo "请选择运行模式:"
    echo ""
    echo "  1) 前台运行 (推荐，可看到日志)"
    echo "  2) 后台运行 (daemon模式)"
    echo "  3) 指定端口运行"
    echo "  4) 查看日志"
    echo "  5) 停止服务"
    echo "  0) 退出"
    echo ""
}

# 前台运行
run_foreground() {
    echo -e "${GREEN}[启动]${NC} 前台运行模式..."
    echo -e "${YELLOW}[提示]${NC} 按 Ctrl+C 停止"
    echo ""
    node bncr-arm.js
}

# 后台运行
run_daemon() {
    echo -e "${GREEN}[启动]${NC} 后台运行模式..."
    
    # 检查是否已在运行
    if pgrep -f "bncr-arm.js" > /dev/null; then
        echo -e "${YELLOW}[警告]${NC} Bncr-ARM已在运行"
        return
    fi
    
    nohup node bncr-arm.js > /dev/null 2>&1 &
    sleep 1
    
    if pgrep -f "bncr-arm.js" > /dev/null; then
        PID=$(pgrep -f "bncr-arm.js" | head -1)
        echo -e "${GREEN}[成功]${NC} Bncr-ARM已启动"
        echo -e "${BLUE}[信息]${NC} PID: $PID"
        echo -e "${BLUE}[信息]${NC} 访问: http://localhost:9090"
        echo -e "${BLUE}[信息]${NC} 日志: tail -f logs/bncr-$(date +%Y-%m-%d).log"
    else
        echo -e "${RED}[失败]${NC} 启动失败"
    fi
}

# 指定端口运行
run_custom_port() {
    echo ""
    read -p "请输入端口号 (默认9090): " port
    port=${port:-9090}
    
    echo -e "${GREEN}[启动]${NC} 使用端口 $port..."
    PORT=$port node bncr-arm.js
}

# 查看日志
view_logs() {
    LOG_FILE="logs/bncr-$(date +%Y-%m-%d).log"
    
    if [ -f "$LOG_FILE" ]; then
        echo -e "${GREEN}[日志]${NC} 显示日志 (按Ctrl+C退出)..."
        tail -f "$LOG_FILE"
    else
        echo -e "${YELLOW}[提示]${NC} 暂无日志文件"
    fi
}

# 停止服务
stop_service() {
    echo -e "${YELLOW}[停止]${NC} 正在停止Bncr-ARM..."
    
    if pgrep -f "bncr-arm.js" > /dev/null; then
        pkill -f "bncr-arm.js"
        sleep 1
        echo -e "${GREEN}[成功]${NC} Bncr-ARM已停止"
    else
        echo -e "${YELLOW}[提示]${NC} Bncr-ARM未在运行"
    fi
}

# 显示状态
show_status() {
    echo ""
    if pgrep -f "bncr-arm.js" > /dev/null; then
        PID=$(pgrep -f "bncr-arm.js" | head -1)
        echo -e "${GREEN}●${NC} Bncr-ARM 运行中"
        echo "  PID: $PID"
        echo "  访问: http://localhost:9090"
    else
        echo -e "${RED}●${NC} Bncr-ARM 未运行"
    fi
    echo ""
}

# 主程序
main() {
    check_node
    check_files
    
    while true; do
        show_status
        show_menu
        read -p "请选择 [0-5]: " choice
        
        case $choice in
            1) run_foreground ;;&
            2) run_daemon ;;&
            3) run_custom_port ;;&
            4) view_logs ;;&
            5) stop_service ;;&
            0) echo -e "${GREEN}再见!${NC}"; exit 0 ;;&
            *) echo -e "${RED}无效选项${NC}" ;;&
        esac
        
        echo ""
        read -p "按回车键继续..."
    done
}

# 如果带参数运行
if [ "$1" == "daemon" ]; then
    check_node
    check_files
    run_daemon
elif [ "$1" == "stop" ]; then
    stop_service
elif [ "$1" == "status" ]; then
    show_status
else
    main
fi