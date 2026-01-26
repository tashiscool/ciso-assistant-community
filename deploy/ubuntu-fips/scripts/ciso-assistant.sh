#!/bin/bash
#
# CISO Assistant - Main Management Script (Ubuntu FIPS)
#
# Central entry point for CISO Assistant management on Ubuntu with FIPS.
#
# Usage:
#   sudo ciso-assistant [command]
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
    echo "  Ubuntu FIPS Edition"
    echo ""
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        echo -e "${RED}Error: Run as root${NC}"
        echo "Try: sudo $0 $*"
        exit 1
    fi
}

get_fips_status() {
    if [[ -f /proc/sys/crypto/fips_enabled ]] && [[ "$(cat /proc/sys/crypto/fips_enabled)" == "1" ]]; then
        echo -e "${GREEN}ENABLED${NC}"
    else
        echo -e "${YELLOW}DISABLED${NC}"
    fi
}

show_quick_status() {
    echo "Quick Status:"
    echo "-------------"

    # FIPS status
    echo -e "  FIPS Mode: $(get_fips_status)"

    # Services
    local running=0
    for svc in nginx ciso-assistant-backend ciso-assistant-frontend ciso-assistant-worker; do
        systemctl is-active --quiet "$svc" 2>/dev/null && ((running++)) || true
    done

    if [[ $running -eq 4 ]]; then
        echo -e "  Services: ${GREEN}${running}/4 running${NC}"
    elif [[ $running -gt 0 ]]; then
        echo -e "  Services: ${YELLOW}${running}/4 running${NC}"
    else
        echo -e "  Services: ${RED}${running}/4 running${NC}"
    fi

    # URL
    if [[ -f "${CONFIG_DIR}/env" ]]; then
        local url=$(grep "^CISO_ASSISTANT_URL=" "${CONFIG_DIR}/env" 2>/dev/null | cut -d'=' -f2 | tr -d '"')
        echo "  URL: ${url:-not configured}"
    fi
    echo ""
}

run_script() {
    local script="$1"
    shift
    if [[ -x "${SCRIPT_DIR}/${script}" ]]; then
        "${SCRIPT_DIR}/${script}" "$@"
    else
        echo -e "${RED}Script not found: ${script}${NC}"
        exit 1
    fi
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
    echo "  ${BLUE}6)${NC} Setup SSL certificate (Let's Encrypt)"
    echo "  ${BLUE}7)${NC} Test database connection"
    echo "  ${BLUE}8)${NC} Run migrations"
    echo "  ${BLUE}9)${NC} Manage admin users"
    echo ""
    echo "  ${CYAN}10)${NC} Check FIPS compliance"
    echo "  ${YELLOW}11)${NC} Edit configuration"
    echo "  ${YELLOW}12)${NC} Update application"
    echo "  ${YELLOW}13)${NC} Run health checks"
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
        10) run_script "check-fips.sh" ;;
        11)
            ${EDITOR:-vi} "${CONFIG_DIR}/env"
            read -p "Restart services? (y/n) [y]: " restart
            [[ "${restart:-y}" =~ ^[Yy] ]] && run_script "manage-services.sh" restart
            ;;
        12)
            [[ -x "${APP_DIR}/update.sh" ]] && "${APP_DIR}/update.sh" || echo "Update script not found"
            ;;
        13) run_script "manage-services.sh" health ;;
        0)  exit 0 ;;
        *)  echo -e "${RED}Invalid choice${NC}"; exit 1 ;;
    esac
}

show_help() {
    show_banner
    echo "Usage: $(basename "$0") [command] [options]"
    echo ""
    echo "Commands:"
    echo "  status            Show service status"
    echo "  start             Start all services"
    echo "  stop              Stop all services"
    echo "  restart           Restart all services"
    echo "  logs [service]    View logs"
    echo "  follow [service]  Follow logs real-time"
    echo ""
    echo "  ssl               Setup SSL certificates"
    echo "  db                Test database connection"
    echo "  migrate           Run migrations"
    echo "  admin             Manage admin users"
    echo ""
    echo "  fips              Check FIPS compliance"
    echo "  config            Edit configuration"
    echo "  update            Update application"
    echo "  health            Run health checks"
    echo ""
    echo "  help              Show this help"
    echo ""
}

# Main
check_root

case "${1:-}" in
    status)   run_script "manage-services.sh" status "${@:2}" ;;
    start)    run_script "manage-services.sh" start "${@:2}" ;;
    stop)     run_script "manage-services.sh" stop "${@:2}" ;;
    restart)  run_script "manage-services.sh" restart "${@:2}" ;;
    logs)     run_script "manage-services.sh" logs "${@:2}" ;;
    follow)   run_script "manage-services.sh" follow "${@:2}" ;;
    ssl)      run_script "setup-ssl.sh" "${@:2}" ;;
    db)       run_script "test-db.sh" "${@:2}" ;;
    migrate)  run_script "run-migrations.sh" "${@:2}" ;;
    admin)    run_script "create-admin.sh" "${@:2}" ;;
    fips)     run_script "check-fips.sh" "${@:2}" ;;
    config)
        ${EDITOR:-vi} "${CONFIG_DIR}/env"
        read -p "Restart services? (y/n) [y]: " restart
        [[ "${restart:-y}" =~ ^[Yy] ]] && run_script "manage-services.sh" restart
        ;;
    update)
        [[ -x "${APP_DIR}/update.sh" ]] && "${APP_DIR}/update.sh" || echo "Update script not found"
        ;;
    health)   run_script "manage-services.sh" health ;;
    help|--help|-h) show_help ;;
    "")       interactive_menu ;;
    *)        echo -e "${RED}Unknown: $1${NC}"; show_help; exit 1 ;;
esac
