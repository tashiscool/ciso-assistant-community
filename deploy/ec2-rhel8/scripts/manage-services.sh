#!/bin/bash
#
# CISO Assistant - Service Management Script
#
# Manages CISO Assistant services (backend, frontend, worker, nginx).
# Provides status display, logs, and health checks.
#
# Usage:
#   sudo ./manage-services.sh [command] [service]
#
# Commands:
#   start      Start all services (or specific service)
#   stop       Stop all services (or specific service)
#   restart    Restart all services (or specific service)
#   status     Show service status (default)
#   logs       Show service logs
#   health     Run health checks
#   enable     Enable services to start on boot
#   disable    Disable services from starting on boot
#
# Services:
#   all        All services (default)
#   backend    CISO Assistant backend (Django/Gunicorn)
#   frontend   CISO Assistant frontend (SvelteKit)
#   worker     Background task worker (Huey/Celery)
#   nginx      Nginx reverse proxy
#

set -euo pipefail

# Configuration
SERVICES=(
    "nginx"
    "ciso-assistant-backend"
    "ciso-assistant-frontend"
    "ciso-assistant-worker"
)
LOG_DIR="/var/log/ciso-assistant"
CONFIG_DIR="/etc/ciso-assistant"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        exit 1
    fi
}

get_service_name() {
    local service="$1"
    case "$service" in
        backend)  echo "ciso-assistant-backend" ;;
        frontend) echo "ciso-assistant-frontend" ;;
        worker)   echo "ciso-assistant-worker" ;;
        nginx)    echo "nginx" ;;
        *)        echo "$service" ;;
    esac
}

get_services() {
    local target="${1:-all}"

    if [[ "$target" == "all" ]]; then
        echo "${SERVICES[@]}"
    else
        get_service_name "$target"
    fi
}

print_status_header() {
    echo ""
    echo "========================================"
    echo "  CISO Assistant Service Status"
    echo "========================================"
    echo ""
    printf "%-30s %-12s %-10s %s\n" "SERVICE" "STATUS" "ENABLED" "UPTIME"
    echo "--------------------------------------------------------------------------------"
}

get_uptime() {
    local service="$1"
    local uptime=$(systemctl show "$service" --property=ActiveEnterTimestamp --value 2>/dev/null)

    if [[ -z "$uptime" ]] || [[ "$uptime" == "n/a" ]]; then
        echo "-"
        return
    fi

    local start_epoch=$(date -d "$uptime" +%s 2>/dev/null || echo "0")
    local now_epoch=$(date +%s)
    local diff=$((now_epoch - start_epoch))

    if [[ $diff -lt 60 ]]; then
        echo "${diff}s"
    elif [[ $diff -lt 3600 ]]; then
        echo "$((diff / 60))m"
    elif [[ $diff -lt 86400 ]]; then
        echo "$((diff / 3600))h $((diff % 3600 / 60))m"
    else
        echo "$((diff / 86400))d $((diff % 86400 / 3600))h"
    fi
}

show_status() {
    local target="${1:-all}"

    print_status_header

    for service in $(get_services "$target"); do
        local status=""
        local enabled=""
        local uptime=""

        if systemctl is-active --quiet "$service" 2>/dev/null; then
            status="${GREEN}running${NC}"
            uptime=$(get_uptime "$service")
        elif systemctl is-failed --quiet "$service" 2>/dev/null; then
            status="${RED}failed${NC}"
            uptime="-"
        else
            status="${YELLOW}stopped${NC}"
            uptime="-"
        fi

        if systemctl is-enabled --quiet "$service" 2>/dev/null; then
            enabled="${GREEN}yes${NC}"
        else
            enabled="${YELLOW}no${NC}"
        fi

        printf "%-30s %-22b %-20b %s\n" "$service" "$status" "$enabled" "$uptime"
    done

    echo ""
}

start_services() {
    local target="${1:-all}"

    echo ""
    log_info "Starting services..."
    echo ""

    for service in $(get_services "$target"); do
        echo -n "  Starting $service... "
        if systemctl start "$service" 2>/dev/null; then
            echo -e "${GREEN}OK${NC}"
        else
            echo -e "${RED}FAILED${NC}"
        fi
    done

    echo ""
    show_status "$target"
}

stop_services() {
    local target="${1:-all}"

    echo ""
    log_info "Stopping services..."
    echo ""

    # Stop in reverse order
    local services=($(get_services "$target"))
    for ((i=${#services[@]}-1; i>=0; i--)); do
        local service="${services[i]}"
        echo -n "  Stopping $service... "
        if systemctl stop "$service" 2>/dev/null; then
            echo -e "${GREEN}OK${NC}"
        else
            echo -e "${YELLOW}SKIPPED${NC}"
        fi
    done

    echo ""
}

restart_services() {
    local target="${1:-all}"

    echo ""
    log_info "Restarting services..."
    echo ""

    for service in $(get_services "$target"); do
        echo -n "  Restarting $service... "
        if systemctl restart "$service" 2>/dev/null; then
            echo -e "${GREEN}OK${NC}"
        else
            echo -e "${RED}FAILED${NC}"
        fi
    done

    echo ""
    show_status "$target"
}

enable_services() {
    local target="${1:-all}"

    echo ""
    log_info "Enabling services to start on boot..."
    echo ""

    for service in $(get_services "$target"); do
        echo -n "  Enabling $service... "
        if systemctl enable "$service" 2>/dev/null; then
            echo -e "${GREEN}OK${NC}"
        else
            echo -e "${RED}FAILED${NC}"
        fi
    done

    echo ""
}

disable_services() {
    local target="${1:-all}"

    echo ""
    log_info "Disabling services from starting on boot..."
    echo ""

    for service in $(get_services "$target"); do
        echo -n "  Disabling $service... "
        if systemctl disable "$service" 2>/dev/null; then
            echo -e "${GREEN}OK${NC}"
        else
            echo -e "${YELLOW}SKIPPED${NC}"
        fi
    done

    echo ""
}

show_logs() {
    local target="${1:-all}"
    local lines="${2:-50}"

    echo ""
    echo "========================================"
    echo "  Service Logs (last $lines lines)"
    echo "========================================"

    for service in $(get_services "$target"); do
        echo ""
        echo -e "${CYAN}=== $service ===${NC}"
        echo ""
        journalctl -u "$service" -n "$lines" --no-pager 2>/dev/null || \
            echo "  No logs available"
    done

    echo ""
    echo "Tip: Use 'journalctl -u SERVICE -f' to follow logs in real-time"
    echo ""
}

follow_logs() {
    local target="${1:-all}"

    log_info "Following logs (Ctrl+C to stop)..."
    echo ""

    if [[ "$target" == "all" ]]; then
        journalctl -u "ciso-assistant-*" -u nginx -f
    else
        local service=$(get_service_name "$target")
        journalctl -u "$service" -f
    fi
}

run_health_checks() {
    echo ""
    echo "========================================"
    echo "  Health Checks"
    echo "========================================"
    echo ""

    local all_healthy=true

    # Check services are running
    echo "Service Status:"
    for service in "${SERVICES[@]}"; do
        echo -n "  $service: "
        if systemctl is-active --quiet "$service" 2>/dev/null; then
            echo -e "${GREEN}running${NC}"
        else
            echo -e "${RED}not running${NC}"
            all_healthy=false
        fi
    done

    echo ""

    # Check nginx config
    echo "Nginx Configuration:"
    echo -n "  Config test: "
    if nginx -t 2>/dev/null; then
        echo -e "${GREEN}valid${NC}"
    else
        echo -e "${RED}invalid${NC}"
        all_healthy=false
    fi

    echo ""

    # Check HTTP endpoints
    echo "HTTP Endpoints:"

    # Backend health
    echo -n "  Backend (localhost:8000): "
    if curl -s --max-time 5 http://localhost:8000/api/ >/dev/null 2>&1; then
        echo -e "${GREEN}responding${NC}"
    else
        echo -e "${YELLOW}not responding${NC}"
    fi

    # Frontend health
    echo -n "  Frontend (localhost:3000): "
    if curl -s --max-time 5 http://localhost:3000/ >/dev/null 2>&1; then
        echo -e "${GREEN}responding${NC}"
    else
        echo -e "${YELLOW}not responding${NC}"
    fi

    # Nginx health endpoint
    echo -n "  Nginx health (/health): "
    if curl -s --max-time 5 http://localhost/health 2>/dev/null | grep -q "healthy"; then
        echo -e "${GREEN}healthy${NC}"
    else
        echo -e "${YELLOW}not responding${NC}"
    fi

    echo ""

    # Check disk space
    echo "Disk Space:"
    df -h / | tail -1 | awk '{
        used = $5
        gsub(/%/, "", used)
        if (used > 90) {
            printf "  Root filesystem: \033[0;31m%s used (CRITICAL)\033[0m\n", $5
        } else if (used > 80) {
            printf "  Root filesystem: \033[1;33m%s used (WARNING)\033[0m\n", $5
        } else {
            printf "  Root filesystem: \033[0;32m%s used\033[0m\n", $5
        }
    }'

    if [[ -d "$LOG_DIR" ]]; then
        local log_size=$(du -sh "$LOG_DIR" 2>/dev/null | cut -f1)
        echo "  Log directory: $log_size"
    fi

    echo ""

    # Check memory
    echo "Memory:"
    free -h | awk '/^Mem:/ {
        total = $2
        used = $3
        printf "  Used: %s / %s\n", used, total
    }'

    echo ""

    # Summary
    echo "========================================"
    if [[ "$all_healthy" == "true" ]]; then
        echo -e "  ${GREEN}All health checks passed${NC}"
    else
        echo -e "  ${YELLOW}Some health checks failed${NC}"
    fi
    echo "========================================"
    echo ""
}

interactive_mode() {
    echo ""
    echo "========================================"
    echo "  Service Management"
    echo "========================================"
    echo ""

    show_status all

    echo "Select an action:"
    echo ""
    echo "  1) Start all services"
    echo "  2) Stop all services"
    echo "  3) Restart all services"
    echo "  4) View logs"
    echo "  5) Follow logs (real-time)"
    echo "  6) Run health checks"
    echo "  7) Manage specific service"
    echo "  8) Exit"
    echo ""
    read -p "Enter choice [1]: " choice
    choice="${choice:-1}"

    case "$choice" in
        1) start_services all ;;
        2) stop_services all ;;
        3) restart_services all ;;
        4) show_logs all ;;
        5) follow_logs all ;;
        6) run_health_checks ;;
        7)
            echo ""
            echo "Select service:"
            echo "  1) backend"
            echo "  2) frontend"
            echo "  3) worker"
            echo "  4) nginx"
            read -p "Enter choice: " svc_choice
            case "$svc_choice" in
                1) service="backend" ;;
                2) service="frontend" ;;
                3) service="worker" ;;
                4) service="nginx" ;;
                *) log_error "Invalid choice"; exit 1 ;;
            esac
            echo ""
            echo "Action for $service:"
            echo "  1) Start"
            echo "  2) Stop"
            echo "  3) Restart"
            echo "  4) View logs"
            read -p "Enter choice: " action
            case "$action" in
                1) start_services "$service" ;;
                2) stop_services "$service" ;;
                3) restart_services "$service" ;;
                4) show_logs "$service" ;;
                *) log_error "Invalid choice"; exit 1 ;;
            esac
            ;;
        8) exit 0 ;;
        *)
            log_error "Invalid choice"
            exit 1
            ;;
    esac
}

show_help() {
    echo "CISO Assistant Service Management"
    echo ""
    echo "Usage: $0 [command] [service]"
    echo ""
    echo "Commands:"
    echo "  start [service]    Start services"
    echo "  stop [service]     Stop services"
    echo "  restart [service]  Restart services"
    echo "  status [service]   Show status (default)"
    echo "  logs [service]     Show recent logs"
    echo "  follow [service]   Follow logs in real-time"
    echo "  health             Run health checks"
    echo "  enable [service]   Enable auto-start on boot"
    echo "  disable [service]  Disable auto-start"
    echo ""
    echo "Services:"
    echo "  all       All services (default)"
    echo "  backend   Django/Gunicorn backend"
    echo "  frontend  SvelteKit frontend"
    echo "  worker    Huey/Celery worker"
    echo "  nginx     Nginx reverse proxy"
    echo ""
    echo "Examples:"
    echo "  $0 status              # Show all service status"
    echo "  $0 restart backend     # Restart only backend"
    echo "  $0 logs worker         # View worker logs"
    echo "  $0 follow              # Follow all logs"
    echo ""
    echo "Without arguments, runs in interactive mode."
}

# Main
check_root

case "${1:-}" in
    start)
        start_services "${2:-all}"
        ;;
    stop)
        stop_services "${2:-all}"
        ;;
    restart)
        restart_services "${2:-all}"
        ;;
    status)
        show_status "${2:-all}"
        ;;
    logs)
        show_logs "${2:-all}" "${3:-50}"
        ;;
    follow)
        follow_logs "${2:-all}"
        ;;
    health)
        run_health_checks
        ;;
    enable)
        enable_services "${2:-all}"
        ;;
    disable)
        disable_services "${2:-all}"
        ;;
    --help|-h)
        show_help
        ;;
    "")
        interactive_mode
        ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
