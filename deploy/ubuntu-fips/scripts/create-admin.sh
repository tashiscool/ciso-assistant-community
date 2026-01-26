#!/bin/bash
#
# CISO Assistant - Admin User Creation Script
#
# Creates or manages admin (superuser) accounts for CISO Assistant.
# Supports interactive creation and batch operations.
#
# Usage:
#   sudo ./create-admin.sh [options]
#
# Options:
#   --email EMAIL      Create admin with specified email
#   --list             List existing admin users
#   --reset EMAIL      Reset password for existing admin
#   --help, -h         Show help
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
        exit 1
    fi

    set -a
    source "${CONFIG_DIR}/env"
    set +a
}

run_django() {
    cd "$BACKEND_DIR"
    sudo -u "$APP_USER" -E "${VENV_DIR}/bin/python" manage.py "$@"
}

run_django_python() {
    cd "$BACKEND_DIR"
    sudo -u "$APP_USER" -E "${VENV_DIR}/bin/python" << EOF
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ciso_assistant.settings')
import django
django.setup()
$1
EOF
}

list_admins() {
    echo ""
    echo "========================================"
    echo "  Admin Users"
    echo "========================================"
    echo ""

    run_django_python '
from iam.models import User

admins = User.objects.filter(is_superuser=True)

if not admins.exists():
    print("  No admin users found")
else:
    print(f"  Found {admins.count()} admin user(s):\n")
    for admin in admins:
        status = "active" if admin.is_active else "inactive"
        last_login = admin.last_login.strftime("%Y-%m-%d %H:%M") if admin.last_login else "never"
        print(f"  - {admin.email}")
        print(f"    Status: {status}")
        print(f"    Last login: {last_login}")
        print()
'
}

create_admin_interactive() {
    echo ""
    echo "========================================"
    echo "  Create Admin User"
    echo "========================================"
    echo ""

    # Get default email from config
    local default_email="${CISO_ASSISTANT_SUPERUSER_EMAIL:-admin@example.gov}"

    read -p "Email address [$default_email]: " email
    email="${email:-$default_email}"

    # Validate email format
    if [[ ! "$email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
        log_error "Invalid email format: $email"
        exit 1
    fi

    # Check if user already exists
    local exists=$(run_django_python "
from iam.models import User
print('yes' if User.objects.filter(email='$email').exists() else 'no')
" 2>/dev/null)

    if [[ "$exists" == "yes" ]]; then
        log_warn "User with email $email already exists"
        read -p "Reset their password instead? (y/n) [n]: " reset
        if [[ "$reset" =~ ^[Yy] ]]; then
            reset_password "$email"
            return
        else
            exit 0
        fi
    fi

    echo ""
    log_info "Creating admin user: $email"
    echo ""

    # Use Django's createsuperuser command
    run_django createsuperuser --email "$email"

    echo ""
    log_info "Admin user created successfully!"
    log_info "You can now log in at: ${CISO_ASSISTANT_URL:-https://localhost}"
}

create_admin_noninteractive() {
    local email="$1"

    echo ""
    echo "========================================"
    echo "  Create Admin User"
    echo "========================================"
    echo ""

    # Validate email format
    if [[ ! "$email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
        log_error "Invalid email format: $email"
        exit 1
    fi

    # Check if user already exists
    local exists=$(run_django_python "
from iam.models import User
print('yes' if User.objects.filter(email='$email').exists() else 'no')
" 2>/dev/null)

    if [[ "$exists" == "yes" ]]; then
        log_error "User with email $email already exists"
        log_info "Use --reset to reset their password"
        exit 1
    fi

    log_info "Creating admin user: $email"
    echo ""
    echo "Please enter the password for the new admin user:"
    run_django createsuperuser --email "$email"

    echo ""
    log_info "Admin user created successfully!"
}

reset_password() {
    local email="$1"

    echo ""
    echo "========================================"
    echo "  Reset Admin Password"
    echo "========================================"
    echo ""

    # Check if user exists
    local exists=$(run_django_python "
from iam.models import User
print('yes' if User.objects.filter(email='$email').exists() else 'no')
" 2>/dev/null)

    if [[ "$exists" != "yes" ]]; then
        log_error "User with email $email not found"
        exit 1
    fi

    log_info "Resetting password for: $email"
    echo ""

    # Get new password
    while true; do
        read -sp "Enter new password: " password1
        echo ""
        read -sp "Confirm password: " password2
        echo ""

        if [[ "$password1" != "$password2" ]]; then
            log_error "Passwords do not match. Try again."
            continue
        fi

        if [[ ${#password1} -lt 8 ]]; then
            log_error "Password must be at least 8 characters. Try again."
            continue
        fi

        break
    done

    # Reset password using Django
    run_django_python "
from iam.models import User
user = User.objects.get(email='$email')
user.set_password('$password1')
user.save()
print('Password reset successfully')
"

    echo ""
    log_info "Password reset completed for: $email"
}

deactivate_admin() {
    local email="$1"

    echo ""
    log_info "Deactivating admin user: $email"

    run_django_python "
from iam.models import User
try:
    user = User.objects.get(email='$email')
    user.is_active = False
    user.save()
    print(f'User {email} has been deactivated')
except User.DoesNotExist:
    print(f'ERROR: User {email} not found')
    exit(1)
"
}

activate_admin() {
    local email="$1"

    echo ""
    log_info "Activating admin user: $email"

    run_django_python "
from iam.models import User
try:
    user = User.objects.get(email='$email')
    user.is_active = True
    user.save()
    print(f'User {email} has been activated')
except User.DoesNotExist:
    print(f'ERROR: User {email} not found')
    exit(1)
"
}

interactive_mode() {
    echo ""
    echo "========================================"
    echo "  Admin User Management"
    echo "========================================"
    echo ""
    echo "Select an option:"
    echo ""
    echo "  1) Create new admin user"
    echo "  2) List admin users"
    echo "  3) Reset admin password"
    echo "  4) Deactivate admin user"
    echo "  5) Activate admin user"
    echo "  6) Exit"
    echo ""
    read -p "Enter choice [1]: " choice
    choice="${choice:-1}"

    case "$choice" in
        1) create_admin_interactive ;;
        2) list_admins ;;
        3)
            read -p "Enter admin email: " email
            reset_password "$email"
            ;;
        4)
            read -p "Enter admin email to deactivate: " email
            deactivate_admin "$email"
            ;;
        5)
            read -p "Enter admin email to activate: " email
            activate_admin "$email"
            ;;
        6) exit 0 ;;
        *)
            log_error "Invalid choice"
            exit 1
            ;;
    esac
}

show_help() {
    echo "CISO Assistant Admin User Management"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --create [EMAIL]     Create admin user (interactive if no email)"
    echo "  --list               List all admin users"
    echo "  --reset EMAIL        Reset password for admin"
    echo "  --deactivate EMAIL   Deactivate admin user"
    echo "  --activate EMAIL     Activate admin user"
    echo "  --help, -h           Show this help"
    echo ""
    echo "Without options, runs in interactive mode."
}

# Main
check_root
load_env

case "${1:-}" in
    --create)
        if [[ -n "${2:-}" ]]; then
            create_admin_noninteractive "$2"
        else
            create_admin_interactive
        fi
        ;;
    --list)
        list_admins
        ;;
    --reset)
        if [[ -z "${2:-}" ]]; then
            log_error "Email required for --reset"
            exit 1
        fi
        reset_password "$2"
        ;;
    --deactivate)
        if [[ -z "${2:-}" ]]; then
            log_error "Email required for --deactivate"
            exit 1
        fi
        deactivate_admin "$2"
        ;;
    --activate)
        if [[ -z "${2:-}" ]]; then
            log_error "Email required for --activate"
            exit 1
        fi
        activate_admin "$2"
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
