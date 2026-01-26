#!/bin/bash
#
# CISO Assistant - Database Migration Script
#
# Runs Django database migrations and related setup tasks.
# Handles both initial setup and subsequent updates.
#
# Usage:
#   sudo ./run-migrations.sh [options]
#
# Options:
#   --check          Check migration status only (don't apply)
#   --fake           Mark migrations as applied without running them
#   --plan           Show migration plan without applying
#   --static         Also collect static files
#   --full           Run migrations + static + check (recommended)
#   --help, -h       Show help
#

set -euo pipefail

# Configuration
APP_USER="ciso-assistant"
APP_DIR="/opt/ciso-assistant"
VENV_DIR="${APP_DIR}/venv"
CONFIG_DIR="/etc/ciso-assistant"
BACKEND_DIR="${APP_DIR}/app/backend"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

load_env() {
    if [[ ! -f "${CONFIG_DIR}/env" ]]; then
        log_error "Configuration file not found: ${CONFIG_DIR}/env"
        log_error "Run the deployment script or create ${CONFIG_DIR}/env first"
        exit 1
    fi

    set -a
    source "${CONFIG_DIR}/env"
    set +a
}

activate_venv() {
    if [[ ! -f "${VENV_DIR}/bin/activate" ]]; then
        log_error "Virtual environment not found: ${VENV_DIR}"
        log_error "Run the deployment script first"
        exit 1
    fi
    source "${VENV_DIR}/bin/activate"
}

run_as_app_user() {
    sudo -u "$APP_USER" -E "${VENV_DIR}/bin/python" "$@"
}

check_migration_status() {
    echo ""
    echo "========================================"
    echo "  Migration Status"
    echo "========================================"
    echo ""

    cd "$BACKEND_DIR"

    log_info "Checking pending migrations..."
    echo ""

    # Show migration status
    run_as_app_user manage.py showmigrations --list 2>/dev/null | head -100

    echo ""

    # Count pending migrations
    local pending=$(run_as_app_user manage.py showmigrations --plan 2>/dev/null | grep -c "\\[ \\]" || echo "0")

    if [[ "$pending" -gt 0 ]]; then
        log_warn "$pending pending migration(s) found"
        return 1
    else
        log_info "All migrations have been applied"
        return 0
    fi
}

show_migration_plan() {
    echo ""
    echo "========================================"
    echo "  Migration Plan"
    echo "========================================"
    echo ""

    cd "$BACKEND_DIR"

    log_info "Pending migrations to be applied:"
    echo ""

    run_as_app_user manage.py showmigrations --plan 2>/dev/null | grep "\\[ \\]" || echo "  (no pending migrations)"

    echo ""
}

run_migrations() {
    local fake="${1:-false}"

    echo ""
    echo "========================================"
    echo "  Running Migrations"
    echo "========================================"
    echo ""

    cd "$BACKEND_DIR"

    if [[ "$fake" == "true" ]]; then
        log_warn "Running with --fake flag (marking as applied without executing)"
        run_as_app_user manage.py migrate --fake --noinput
    else
        log_info "Applying database migrations..."
        run_as_app_user manage.py migrate --noinput
    fi

    log_info "Migrations completed successfully!"
}

collect_static() {
    echo ""
    echo "========================================"
    echo "  Collecting Static Files"
    echo "========================================"
    echo ""

    cd "$BACKEND_DIR"

    log_info "Collecting static files..."
    run_as_app_user manage.py collectstatic --noinput

    log_info "Static files collected successfully!"
}

run_system_checks() {
    echo ""
    echo "========================================"
    echo "  System Checks"
    echo "========================================"
    echo ""

    cd "$BACKEND_DIR"

    log_info "Running Django system checks..."
    if run_as_app_user manage.py check --deploy 2>&1 | head -50; then
        log_info "System checks passed"
    else
        log_warn "Some system checks reported warnings (see above)"
    fi
}

create_cache_table() {
    echo ""
    log_info "Creating cache table if needed..."
    cd "$BACKEND_DIR"
    run_as_app_user manage.py createcachetable 2>/dev/null || true
}

run_full_setup() {
    echo ""
    echo "========================================"
    echo "  Full Database Setup"
    echo "========================================"
    echo ""

    # Test database connection first
    log_info "Testing database connection..."
    cd "$BACKEND_DIR"
    if ! run_as_app_user manage.py check --database default 2>/dev/null; then
        log_error "Database connection failed!"
        log_error "Run ./test-db.sh to diagnose the issue"
        exit 1
    fi
    log_info "Database connection OK"

    # Run migrations
    run_migrations

    # Create cache table
    create_cache_table

    # Collect static files
    collect_static

    # Run system checks
    run_system_checks

    echo ""
    echo "========================================"
    echo -e "  ${GREEN}Setup Complete!${NC}"
    echo "========================================"
    echo ""
    echo "Next steps:"
    echo "  - Create admin user: sudo ./create-admin.sh"
    echo "  - Start services: sudo ./manage-services.sh start"
    echo ""
}

interactive_mode() {
    echo ""
    echo "========================================"
    echo "  Database Migration Tool"
    echo "========================================"
    echo ""
    echo "Select an option:"
    echo ""
    echo "  1) Run full setup (Recommended)"
    echo "  2) Check migration status"
    echo "  3) Show migration plan"
    echo "  4) Run migrations only"
    echo "  5) Collect static files only"
    echo "  6) Run system checks"
    echo "  7) Exit"
    echo ""
    read -p "Enter choice [1]: " choice
    choice="${choice:-1}"

    case "$choice" in
        1) run_full_setup ;;
        2) check_migration_status ;;
        3) show_migration_plan ;;
        4) run_migrations ;;
        5) collect_static ;;
        6) run_system_checks ;;
        7) exit 0 ;;
        *)
            log_error "Invalid choice"
            exit 1
            ;;
    esac
}

show_help() {
    echo "CISO Assistant Database Migration Tool"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --check          Check migration status only"
    echo "  --plan           Show migration plan"
    echo "  --migrate        Run migrations"
    echo "  --fake           Mark migrations as applied (use with caution)"
    echo "  --static         Collect static files"
    echo "  --full           Full setup: migrate + static + checks (Recommended)"
    echo "  --help, -h       Show this help"
    echo ""
    echo "Without options, runs in interactive mode."
}

# Main
check_root
load_env
activate_venv

case "${1:-}" in
    --check)
        check_migration_status
        ;;
    --plan)
        show_migration_plan
        ;;
    --migrate)
        run_migrations
        ;;
    --fake)
        run_migrations true
        ;;
    --static)
        collect_static
        ;;
    --full)
        run_full_setup
        ;;
    --help|-h)
        show_help
        ;;
    "")
        interactive_mode
        ;;
    *)
        log_error "Unknown option: $1"
        show_help
        exit 1
        ;;
esac
