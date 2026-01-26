#!/bin/bash
#
# CISO Assistant - Main Management Script
#
# Central entry point for all CISO Assistant management tasks.
# Provides a unified interface to all helper scripts.
#
# Usage:
#   sudo ciso-assistant [command]
#
# Commands:
#   status       Show service status and health
#   start        Start all services
#   stop         Stop all services
#   restart      Restart all services
#   logs         View service logs
#   ssl          Manage SSL certificates
#   db           Test database connection
#   migrate      Run database migrations
#   admin        Manage admin users
#   update       Update CISO Assistant
#   config       Edit configuration
#   help         Show this help
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="/opt/ciso-assistant"
CONFIG_DIR="/etc/ciso-assistant"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

show_banner() {
    echo ""
    echo -e "${CYAN}"
    echo "   ____ ___ ____   ___      _            _     _              _   "
    echo "  / ___|_ _/ ___| / _ \    / \   ___ ___(_)___| |_ __ _ _ __ | |_ "
    echo " | |    | |\___ \| | | |  / _ \ / __/ __| / __| __/ _\` | '_ \| __|"
    echo " | |___ | | ___) | |_| | / ___ \\\\__ \\__ \\ \\__ \\ || (_| | | | | |_ "
    echo "  \____|___|____/ \___/ /_/   \_\\___/___/_|___/\\__\\__,_|_| |_|\\__|"
    echo -e "${NC}"
    echo "  Management Console"
    echo ""
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        echo -e "${RED}Error: This script must be run as root${NC}"
        echo "Try: sudo $0 $*"
        exit 1
    fi
}

run_script() {
    local script="$1"
    shift
    if [[ -x "${SCRIPT_DIR}/${script}" ]]; then
        "${SCRIPT_DIR}/${script}" "$@"
    else
        echo -e "${RED}Error: Script not found: ${script}${NC}"
        exit 1
    fi
}

show_quick_status() {
    echo "Quick Status:"
    echo "-------------"

    # Service status
    local running=0
    local total=4
    for svc in nginx ciso-assistant-backend ciso-assistant-frontend ciso-assistant-worker; do
        systemctl is-active --quiet "$svc" 2>/dev/null && ((running++)) || true
    done

    if [[ $running -eq $total ]]; then
        echo -e "  Services: ${GREEN}${running}/${total} running${NC}"
    elif [[ $running -gt 0 ]]; then
        echo -e "  Services: ${YELLOW}${running}/${total} running${NC}"
    else
        echo -e "  Services: ${RED}${running}/${total} running${NC}"
    fi

    # URL
    if [[ -f "${CONFIG_DIR}/env" ]]; then
        local url=$(grep "^CISO_ASSISTANT_URL=" "${CONFIG_DIR}/env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'")
        echo "  URL: ${url:-not configured}"
    fi

    echo ""
}

interactive_menu() {
    show_banner
    show_quick_status

    echo "Select an option:"
    echo ""
    echo "  ${GREEN}1)${NC} Show service status"
    echo "  ${GREEN}2)${NC} Start all services"
    echo "  ${GREEN}3)${NC} Stop all services"
    echo "  ${GREEN}4)${NC} Restart all services"
    echo "  ${GREEN}5)${NC} View logs"
    echo ""
    echo "  ${BLUE}6)${NC} Setup SSL certificate"
    echo "  ${BLUE}7)${NC} Test database connection"
    echo "  ${BLUE}8)${NC} Run migrations"
    echo "  ${BLUE}9)${NC} Manage admin users"
    echo ""
    echo "  ${YELLOW}10)${NC} Edit configuration"
    echo "  ${YELLOW}11)${NC} Update application"
    echo "  ${YELLOW}12)${NC} Run health checks"
    echo ""
    echo "  ${RED}0)${NC} Exit"
    echo ""
    read -p "Enter choice: " choice

    case "$choice" in
        1)  run_script "manage-services.sh" status ;;
        2)  run_script "manage-services.sh" start ;;
        3)  run_script "manage-services.sh" stop ;;
        4)  run_script "manage-services.sh" restart ;;
        5)  run_script "manage-services.sh" logs ;;
        6)  run_script "setup-ssl.sh" ;;
        7)  run_script "test-db.sh" ;;
        8)  run_script "run-migrations.sh" ;;
        9)  run_script "create-admin.sh" ;;
        10)
            echo ""
            echo "Opening configuration file..."
            ${EDITOR:-vi} "${CONFIG_DIR}/env"
            echo ""
            read -p "Restart services to apply changes? (y/n) [y]: " restart
            if [[ "${restart:-y}" =~ ^[Yy] ]]; then
                run_script "manage-services.sh" restart
            fi
            ;;
        11)
            if [[ -x "${APP_DIR}/update.sh" ]]; then
                "${APP_DIR}/update.sh"
            else
                echo -e "${RED}Update script not found${NC}"
            fi
            ;;
        12) run_script "manage-services.sh" health ;;
        0)  exit 0 ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            exit 1
            ;;
    esac
}

show_help() {
    show_banner

    echo "Usage: $(basename "$0") [command] [options]"
    echo ""
    echo "Commands:"
    echo "  status              Show service status"
    echo "  start               Start all services"
    echo "  stop                Stop all services"
    echo "  restart             Restart all services"
    echo "  logs [service]      View logs (all, backend, frontend, worker, nginx)"
    echo "  follow [service]    Follow logs in real-time"
    echo ""
    echo "  ssl                 Setup SSL certificates"
    echo "  db                  Test database connection"
    echo "  migrate             Run database migrations"
    echo "  admin               Manage admin users"
    echo ""
    echo "  config              Edit configuration file"
    echo "  update              Update CISO Assistant"
    echo "  health              Run health checks"
    echo ""
    echo "  help                Show this help"
    echo ""
    echo "Without arguments, runs in interactive mode."
    echo ""
    echo "Examples:"
    echo "  sudo $(basename "$0") status        # Show service status"
    echo "  sudo $(basename "$0") restart       # Restart all services"
    echo "  sudo $(basename "$0") logs backend  # View backend logs"
    echo "  sudo $(basename "$0") admin         # Manage admin users"
    echo ""
}

# Main
check_root

case "${1:-}" in
    status)
        run_script "manage-services.sh" status "${@:2}"
        ;;
    start)
        run_script "manage-services.sh" start "${@:2}"
        ;;
    stop)
        run_script "manage-services.sh" stop "${@:2}"
        ;;
    restart)
        run_script "manage-services.sh" restart "${@:2}"
        ;;
    logs)
        run_script "manage-services.sh" logs "${@:2}"
        ;;
    follow)
        run_script "manage-services.sh" follow "${@:2}"
        ;;
    ssl)
        run_script "setup-ssl.sh" "${@:2}"
        ;;
    db|database)
        run_script "test-db.sh" "${@:2}"
        ;;
    migrate|migrations)
        run_script "run-migrations.sh" "${@:2}"
        ;;
    admin)
        run_script "create-admin.sh" "${@:2}"
        ;;
    config)
        ${EDITOR:-vi} "${CONFIG_DIR}/env"
        echo ""
        read -p "Restart services to apply changes? (y/n) [y]: " restart
        if [[ "${restart:-y}" =~ ^[Yy] ]]; then
            run_script "manage-services.sh" restart
        fi
        ;;
    update)
        if [[ -x "${APP_DIR}/update.sh" ]]; then
            "${APP_DIR}/update.sh"
        else
            echo -e "${RED}Update script not found at ${APP_DIR}/update.sh${NC}"
            exit 1
        fi
        ;;
    health)
        run_script "manage-services.sh" health
        ;;
    help|--help|-h)
        show_help
        ;;
    "")
        interactive_menu
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
