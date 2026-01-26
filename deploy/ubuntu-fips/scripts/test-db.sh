#!/bin/bash
#
# CISO Assistant - Database Connection Test Script
#
# Tests database connectivity including RDS IAM authentication.
# Provides detailed diagnostics for troubleshooting connection issues.
#
# Usage:
#   sudo ./test-db.sh [options]
#
# Options:
#   --verbose, -v    Show detailed output
#   --json           Output results as JSON
#   --help, -h       Show help
#

set -euo pipefail

# Configuration
APP_USER="ciso-assistant"
APP_DIR="/opt/ciso-assistant"
VENV_DIR="${APP_DIR}/venv"
CONFIG_DIR="/etc/ciso-assistant"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

VERBOSE=false
JSON_OUTPUT=false

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_debug() { [[ "$VERBOSE" == "true" ]] && echo -e "${BLUE}[DEBUG]${NC} $1" || true; }

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (for reading config)"
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

    log_debug "Loaded environment from ${CONFIG_DIR}/env"
}

check_env_variables() {
    echo ""
    echo "========================================"
    echo "  Environment Variables Check"
    echo "========================================"
    echo ""

    local all_ok=true

    # Required variables
    local required_vars=("DB_HOST" "POSTGRES_NAME" "POSTGRES_USER")

    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Missing required variable: $var"
            all_ok=false
        else
            log_info "$var = ${!var}"
        fi
    done

    # Database port
    echo ""
    log_info "DB_PORT = ${DB_PORT:-5432}"

    # IAM auth check
    if [[ "${RDS_IAM_AUTH:-False}" == "True" ]]; then
        log_info "RDS_IAM_AUTH = True (using IAM authentication)"
        log_info "AWS_REGION = ${AWS_REGION:-us-gov-west-1}"
    else
        log_info "RDS_IAM_AUTH = False (using password authentication)"
        if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
            log_error "POSTGRES_PASSWORD is required when not using IAM auth"
            all_ok=false
        else
            log_info "POSTGRES_PASSWORD = ********"
        fi
    fi

    echo ""
    if [[ "$all_ok" == "true" ]]; then
        log_info "All required environment variables are set"
        return 0
    else
        log_error "Some required environment variables are missing"
        return 1
    fi
}

check_network_connectivity() {
    echo ""
    echo "========================================"
    echo "  Network Connectivity Check"
    echo "========================================"
    echo ""

    local host="${DB_HOST:-}"
    local port="${DB_PORT:-5432}"

    if [[ -z "$host" ]]; then
        log_error "DB_HOST is not set"
        return 1
    fi

    # DNS resolution
    log_info "Checking DNS resolution for $host..."
    if host "$host" &>/dev/null; then
        local ip=$(host "$host" | grep "has address" | head -1 | awk '{print $NF}')
        log_info "DNS resolved: $host -> $ip"
    else
        log_error "DNS resolution failed for $host"
        log_warn "Check that the RDS endpoint is correct"
        return 1
    fi

    # TCP connectivity
    log_info "Checking TCP connectivity to $host:$port..."
    if timeout 5 bash -c "cat < /dev/null > /dev/tcp/$host/$port" 2>/dev/null; then
        log_info "TCP connection successful"
    else
        log_error "Cannot connect to $host:$port"
        log_warn "Check:"
        log_warn "  - RDS security group allows inbound from this EC2"
        log_warn "  - RDS is in the same VPC or VPC peering is configured"
        log_warn "  - Network ACLs allow the connection"
        return 1
    fi

    return 0
}

check_iam_credentials() {
    if [[ "${RDS_IAM_AUTH:-False}" != "True" ]]; then
        return 0
    fi

    echo ""
    echo "========================================"
    echo "  IAM Credentials Check"
    echo "========================================"
    echo ""

    # Check if we can get instance metadata
    log_info "Checking EC2 instance metadata..."
    if curl -s --max-time 2 http://169.254.169.254/latest/meta-data/iam/security-credentials/ &>/dev/null; then
        local role=$(curl -s --max-time 2 http://169.254.169.254/latest/meta-data/iam/security-credentials/)
        log_info "IAM role attached: $role"

        # Get credentials info
        local creds=$(curl -s --max-time 2 "http://169.254.169.254/latest/meta-data/iam/security-credentials/$role")
        local expiration=$(echo "$creds" | grep -o '"Expiration" : "[^"]*"' | cut -d'"' -f4)
        log_info "Credentials expiration: $expiration"
    else
        log_warn "Cannot access instance metadata"
        log_warn "This EC2 instance may not have an IAM role attached"
    fi

    # Check if boto3 can get credentials
    log_info "Checking boto3 credentials..."
    sudo -u "$APP_USER" "${VENV_DIR}/bin/python" << 'PYCHECK'
import boto3
try:
    session = boto3.Session()
    creds = session.get_credentials()
    if creds:
        print(f"  Access Key ID: {creds.access_key[:8]}...")
        print(f"  Method: {creds.method}")
    else:
        print("  ERROR: No credentials found")
        exit(1)
except Exception as e:
    print(f"  ERROR: {e}")
    exit(1)
PYCHECK

    return $?
}

test_rds_iam_token() {
    if [[ "${RDS_IAM_AUTH:-False}" != "True" ]]; then
        return 0
    fi

    echo ""
    echo "========================================"
    echo "  RDS IAM Token Generation"
    echo "========================================"
    echo ""

    log_info "Generating IAM authentication token..."

    sudo -u "$APP_USER" "${VENV_DIR}/bin/python" << PYTOKEN
import boto3
import os

host = os.environ.get('DB_HOST', '')
port = int(os.environ.get('DB_PORT', 5432))
user = os.environ.get('POSTGRES_USER', '')
region = os.environ.get('AWS_REGION', 'us-gov-west-1')

try:
    client = boto3.client('rds', region_name=region)
    token = client.generate_db_auth_token(
        DBHostname=host,
        Port=port,
        DBUsername=user,
        Region=region
    )
    print(f"  Token generated successfully")
    print(f"  Token length: {len(token)} characters")
    print(f"  Token preview: {token[:50]}...")
except Exception as e:
    print(f"  ERROR: {e}")
    exit(1)
PYTOKEN

    return $?
}

test_django_connection() {
    echo ""
    echo "========================================"
    echo "  Django Database Connection Test"
    echo "========================================"
    echo ""

    cd "${APP_DIR}/app/backend"

    log_info "Testing Django database connection..."

    if [[ "${RDS_IAM_AUTH:-False}" == "True" ]]; then
        # Use the custom management command
        if sudo -u "$APP_USER" "${VENV_DIR}/bin/python" manage.py test_rds_iam ${JSON_OUTPUT:+--json}; then
            log_info "Django database connection successful!"
            return 0
        else
            log_error "Django database connection failed"
            return 1
        fi
    else
        # Standard Django check
        if sudo -u "$APP_USER" "${VENV_DIR}/bin/python" manage.py check --database default; then
            log_info "Django database connection successful!"

            # Try a simple query
            log_info "Running test query..."
            sudo -u "$APP_USER" "${VENV_DIR}/bin/python" << 'PYQUERY'
import django
django.setup()
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute("SELECT version();")
    version = cursor.fetchone()[0]
    print(f"  PostgreSQL version: {version}")
    cursor.execute("SELECT current_database();")
    db = cursor.fetchone()[0]
    print(f"  Connected to database: {db}")
PYQUERY
            return 0
        else
            log_error "Django database connection failed"
            return 1
        fi
    fi
}

run_full_test() {
    local exit_code=0

    check_env_variables || exit_code=1

    if [[ $exit_code -eq 0 ]]; then
        check_network_connectivity || exit_code=1
    fi

    if [[ $exit_code -eq 0 ]] && [[ "${RDS_IAM_AUTH:-False}" == "True" ]]; then
        check_iam_credentials || exit_code=1
        test_rds_iam_token || exit_code=1
    fi

    if [[ $exit_code -eq 0 ]]; then
        test_django_connection || exit_code=1
    fi

    echo ""
    echo "========================================"
    if [[ $exit_code -eq 0 ]]; then
        echo -e "  ${GREEN}All tests passed!${NC}"
    else
        echo -e "  ${RED}Some tests failed${NC}"
    fi
    echo "========================================"
    echo ""

    return $exit_code
}

show_help() {
    echo "CISO Assistant Database Connection Test"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --verbose, -v    Show detailed debug output"
    echo "  --json           Output results as JSON (for IAM test)"
    echo "  --env-only       Only check environment variables"
    echo "  --network-only   Only check network connectivity"
    echo "  --help, -h       Show this help"
    echo ""
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        --env-only)
            check_root
            load_env
            check_env_variables
            exit $?
            ;;
        --network-only)
            check_root
            load_env
            check_network_connectivity
            exit $?
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main
check_root
load_env
run_full_test
