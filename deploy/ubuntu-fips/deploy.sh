#!/bin/bash
#
# CISO Assistant - Ubuntu FIPS Deployment Script
#
# This script deploys CISO Assistant on Ubuntu 20.04/22.04 with FIPS-validated
# cryptography for federal/government compliance requirements.
#
# Supports:
# - Ubuntu Pro with FIPS packages (FIPS 140-2/140-3 validated)
# - AWS GovCloud deployment
# - RDS PostgreSQL with IAM authentication
# - S3 for file storage
# - ElastiCache Redis or AWS SQS for task queue
#
# Prerequisites:
# - Ubuntu 20.04 LTS or 22.04 LTS
# - Ubuntu Pro subscription (for FIPS packages)
# - EC2 instance with IAM role (for AWS deployments)
#
# Usage:
#   sudo ./deploy.sh [options]
#
# Options:
#   --non-interactive    Run without prompts
#   --skip-fips         Skip FIPS enablement (testing only)
#   --skip-config       Use existing configuration
#   --help              Show help
#

set -euo pipefail

# Configuration
APP_USER="ciso-assistant"
APP_DIR="/opt/ciso-assistant"
CONFIG_DIR="/etc/ciso-assistant"
LOG_DIR="/var/log/ciso-assistant"
VENV_DIR="${APP_DIR}/venv"
NODE_VERSION="20"
PYTHON_VERSION="3.11"

# Flags
INTERACTIVE=true
SKIP_FIPS=false
SKIP_CONFIG=false

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

check_ubuntu() {
    if [[ ! -f /etc/os-release ]]; then
        log_error "Cannot determine OS version"
        exit 1
    fi

    source /etc/os-release

    if [[ "$ID" != "ubuntu" ]]; then
        log_error "This script requires Ubuntu. Detected: $ID"
        exit 1
    fi

    case "$VERSION_ID" in
        "20.04"|"22.04"|"24.04")
            log_info "Detected Ubuntu $VERSION_ID LTS"
            ;;
        *)
            log_warn "Ubuntu $VERSION_ID may not be fully supported. Recommended: 20.04 or 22.04 LTS"
            ;;
    esac
}

prompt_value() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    local is_secret="${4:-false}"
    local value

    if [[ "$INTERACTIVE" != "true" ]]; then
        eval "$var_name=\"$default\""
        return
    fi

    if [[ "$is_secret" == "true" ]]; then
        read -sp "$prompt [$default]: " value
        echo ""
    else
        read -p "$prompt [$default]: " value
    fi

    value="${value:-$default}"
    eval "$var_name=\"$value\""
}

prompt_yes_no() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"

    if [[ "$INTERACTIVE" != "true" ]]; then
        case "$default" in
            [Yy]* ) eval "$var_name=true" ;;
            [Nn]* ) eval "$var_name=false" ;;
        esac
        return
    fi

    while true; do
        read -p "$prompt (y/n) [$default]: " response
        response="${response:-$default}"
        case "$response" in
            [Yy]* ) eval "$var_name=true"; return ;;
            [Nn]* ) eval "$var_name=false"; return ;;
            * ) echo "Please answer y or n." ;;
        esac
    done
}

prompt_choice() {
    local prompt="$1"
    local options="$2"
    local default="$3"
    local var_name="$4"

    if [[ "$INTERACTIVE" != "true" ]]; then
        eval "$var_name=\"$default\""
        return
    fi

    echo "$prompt"
    echo "$options"
    read -p "Enter choice [$default]: " choice
    choice="${choice:-$default}"
    eval "$var_name=\"$choice\""
}

# =============================================================================
# FIPS Configuration
# =============================================================================

check_fips_status() {
    log_info "Checking FIPS status..."

    if [[ -f /proc/sys/crypto/fips_enabled ]]; then
        local fips_enabled=$(cat /proc/sys/crypto/fips_enabled)
        if [[ "$fips_enabled" == "1" ]]; then
            log_info "FIPS mode is ENABLED"
            return 0
        fi
    fi

    log_warn "FIPS mode is NOT enabled"
    return 1
}

check_ubuntu_pro() {
    log_info "Checking Ubuntu Pro status..."

    if command -v pro &> /dev/null; then
        if pro status --format json 2>/dev/null | grep -q '"attached": true'; then
            log_info "Ubuntu Pro subscription is active"
            return 0
        fi
    fi

    log_warn "Ubuntu Pro subscription not detected"
    return 1
}

enable_fips() {
    if [[ "$SKIP_FIPS" == "true" ]]; then
        log_warn "Skipping FIPS enablement (--skip-fips flag)"
        return 0
    fi

    echo ""
    echo "========================================"
    echo "  FIPS Cryptography Setup"
    echo "========================================"
    echo ""

    # Check if already enabled
    if check_fips_status; then
        log_info "FIPS is already enabled. Skipping..."
        return 0
    fi

    # Check Ubuntu Pro
    if ! check_ubuntu_pro; then
        echo ""
        log_warn "Ubuntu Pro subscription required for FIPS packages"
        echo ""
        echo "To attach Ubuntu Pro:"
        echo "  1. Get a token from https://ubuntu.com/pro"
        echo "  2. Run: sudo pro attach <token>"
        echo ""
        echo "For AWS GovCloud, Ubuntu Pro may be included with certain AMIs."
        echo ""

        if [[ "$INTERACTIVE" == "true" ]]; then
            prompt_yes_no "Do you have an Ubuntu Pro token to attach now?" "n" do_attach

            if [[ "$do_attach" == "true" ]]; then
                read -p "Enter Ubuntu Pro token: " pro_token
                pro attach "$pro_token" || {
                    log_error "Failed to attach Ubuntu Pro"
                    exit 1
                }
            else
                prompt_yes_no "Continue without FIPS? (NOT recommended for production)" "n" skip_fips
                if [[ "$skip_fips" == "true" ]]; then
                    SKIP_FIPS=true
                    log_warn "Continuing without FIPS - NOT COMPLIANT"
                    return 0
                else
                    log_error "Ubuntu Pro required for FIPS. Exiting."
                    exit 1
                fi
            fi
        else
            log_error "Ubuntu Pro required for FIPS in non-interactive mode"
            exit 1
        fi
    fi

    # Enable FIPS
    log_info "Enabling FIPS packages..."

    pro enable fips-updates --assume-yes || {
        # Try fips if fips-updates fails
        pro enable fips --assume-yes || {
            log_error "Failed to enable FIPS"
            exit 1
        }
    }

    log_info "FIPS packages enabled"
    log_warn "A REBOOT is required to activate FIPS mode"

    if [[ "$INTERACTIVE" == "true" ]]; then
        echo ""
        prompt_yes_no "Reboot now to activate FIPS?" "y" do_reboot

        if [[ "$do_reboot" == "true" ]]; then
            log_info "Rebooting in 5 seconds..."
            log_info "After reboot, run this script again to continue deployment"
            sleep 5
            reboot
        else
            log_warn "Remember to reboot before production use!"
        fi
    fi
}

verify_fips_crypto() {
    log_info "Verifying FIPS cryptographic modules..."

    # Check OpenSSL FIPS
    if openssl version 2>&1 | grep -qi fips; then
        log_info "OpenSSL FIPS: OK"
    else
        log_warn "OpenSSL may not be using FIPS module"
    fi

    # Check kernel FIPS
    if [[ -f /proc/sys/crypto/fips_enabled ]] && [[ "$(cat /proc/sys/crypto/fips_enabled)" == "1" ]]; then
        log_info "Kernel FIPS: ENABLED"
    else
        log_warn "Kernel FIPS: NOT ENABLED"
    fi

    # List FIPS-validated algorithms
    if [[ "$INTERACTIVE" == "true" ]]; then
        echo ""
        echo "Available FIPS algorithms:"
        cat /proc/crypto | grep -E "^name" | head -20
        echo "..."
    fi
}

# =============================================================================
# System Setup
# =============================================================================

install_system_packages() {
    log_info "Installing system packages..."

    # Update package lists
    apt-get update

    # Install base packages
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
        git \
        build-essential \
        libssl-dev \
        libffi-dev \
        zlib1g-dev \
        libbz2-dev \
        libreadline-dev \
        libsqlite3-dev \
        libpq-dev \
        libxml2-dev \
        libxslt1-dev \
        libxmlsec1-dev \
        libxmlsec1-openssl \
        pkg-config \
        nginx \
        curl \
        wget \
        unzip \
        jq \
        ca-certificates \
        gnupg \
        lsb-release \
        software-properties-common \
        ufw

    log_info "System packages installed"
}

install_python() {
    log_info "Installing Python ${PYTHON_VERSION}..."

    # Add deadsnakes PPA for newer Python versions
    add-apt-repository -y ppa:deadsnakes/ppa
    apt-get update

    # Install Python
    apt-get install -y \
        "python${PYTHON_VERSION}" \
        "python${PYTHON_VERSION}-venv" \
        "python${PYTHON_VERSION}-dev" \
        "python${PYTHON_VERSION}-distutils"

    # Set as default python3
    update-alternatives --install /usr/bin/python3 python3 "/usr/bin/python${PYTHON_VERSION}" 1

    # Install pip
    curl -sS https://bootstrap.pypa.io/get-pip.py | "python${PYTHON_VERSION}"

    log_info "Python $(python3 --version) installed"
}

install_nodejs() {
    log_info "Installing Node.js ${NODE_VERSION}..."

    # Add NodeSource repository
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -

    # Install Node.js
    apt-get install -y nodejs

    log_info "Node.js $(node --version) installed"
}

create_app_user() {
    log_info "Creating application user..."

    if id "$APP_USER" &>/dev/null; then
        log_info "User $APP_USER already exists"
    else
        useradd -r -m -d "$APP_DIR" -s /bin/bash "$APP_USER"
        log_info "User $APP_USER created"
    fi
}

create_directories() {
    log_info "Creating directories..."

    mkdir -p "$APP_DIR"
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$LOG_DIR"
    mkdir -p "${APP_DIR}/venv"
    mkdir -p "${APP_DIR}/scripts"

    chown -R "$APP_USER:$APP_USER" "$APP_DIR"
    chown -R "$APP_USER:$APP_USER" "$LOG_DIR"
    chmod 750 "$CONFIG_DIR"

    log_info "Directories created"
}

clone_repository() {
    log_info "Cloning CISO Assistant repository..."

    if [[ -d "${APP_DIR}/app/.git" ]]; then
        log_info "Repository already exists. Pulling latest..."
        cd "${APP_DIR}/app"
        sudo -u "$APP_USER" git pull origin main || true
    else
        sudo -u "$APP_USER" git clone https://github.com/tashiscool/ciso-assistant-community.git "${APP_DIR}/app"
    fi

    log_info "Repository cloned"
}

setup_backend() {
    log_info "Setting up backend..."

    cd "${APP_DIR}/app/backend"

    # Create virtual environment with system site-packages for FIPS OpenSSL
    "python${PYTHON_VERSION}" -m venv "${VENV_DIR}" --system-site-packages

    # Activate and install dependencies
    source "${VENV_DIR}/bin/activate"
    pip install --upgrade pip
    pip install poetry

    # Configure poetry
    poetry config virtualenvs.create false

    # Install dependencies
    poetry install --no-dev

    # Install production dependencies
    pip install gunicorn psycopg2-binary

    # Configure cryptography to use system OpenSSL (FIPS)
    pip install --force-reinstall --no-binary :all: cryptography 2>/dev/null || \
        log_warn "Could not rebuild cryptography - using pre-built package"

    chown -R "$APP_USER:$APP_USER" "$VENV_DIR"

    log_info "Backend setup complete"
}

setup_frontend() {
    log_info "Setting up frontend..."

    cd "${APP_DIR}/app/frontend"

    # Install dependencies and build
    sudo -u "$APP_USER" npm ci
    sudo -u "$APP_USER" npm run build

    log_info "Frontend setup complete"
}

# =============================================================================
# Interactive Configuration
# =============================================================================

interactive_config() {
    log_info "Starting interactive configuration..."
    echo ""
    echo "========================================"
    echo "  CISO Assistant Configuration Wizard"
    echo "========================================"
    echo ""
    echo "This wizard will configure CISO Assistant for your environment."
    echo "Press Enter to accept default values in brackets."
    echo ""

    local default_secret_key=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")

    # Basic Settings
    echo ""
    echo -e "${YELLOW}=== Basic Settings ===${NC}"
    echo ""

    prompt_value "Application URL (e.g., https://ciso.example.gov)" "https://localhost" CONFIG_URL
    prompt_value "Allowed hosts (comma-separated)" "localhost,127.0.0.1" CONFIG_ALLOWED_HOSTS
    prompt_value "Admin email address" "admin@example.gov" CONFIG_ADMIN_EMAIL
    prompt_value "Django secret key" "$default_secret_key" CONFIG_SECRET_KEY true

    # AWS Region
    echo ""
    echo -e "${YELLOW}=== AWS Configuration ===${NC}"
    echo ""

    prompt_choice "Select AWS region:" "  1) us-gov-west-1 (GovCloud West)
  2) us-gov-east-1 (GovCloud East)
  3) us-east-1 (N. Virginia)
  4) us-west-2 (Oregon)
  5) Other" "1" region_choice

    case "$region_choice" in
        1) CONFIG_AWS_REGION="us-gov-west-1" ;;
        2) CONFIG_AWS_REGION="us-gov-east-1" ;;
        3) CONFIG_AWS_REGION="us-east-1" ;;
        4) CONFIG_AWS_REGION="us-west-2" ;;
        5) prompt_value "Enter AWS region" "us-east-1" CONFIG_AWS_REGION ;;
        *) CONFIG_AWS_REGION="us-gov-west-1" ;;
    esac

    # Database
    echo ""
    echo -e "${YELLOW}=== Database Configuration (RDS PostgreSQL) ===${NC}"
    echo ""

    prompt_value "RDS endpoint" "" CONFIG_DB_HOST
    prompt_value "Database name" "ciso_assistant" CONFIG_DB_NAME
    prompt_value "Database user" "ciso_app" CONFIG_DB_USER
    prompt_value "Database port" "5432" CONFIG_DB_PORT

    prompt_yes_no "Use IAM authentication for RDS?" "y" CONFIG_USE_IAM_AUTH

    if [[ "$CONFIG_USE_IAM_AUTH" != "true" ]]; then
        prompt_value "Database password" "" CONFIG_DB_PASSWORD true
    fi

    # S3 Storage
    echo ""
    echo -e "${YELLOW}=== S3 Storage Configuration ===${NC}"
    echo ""

    prompt_yes_no "Use S3 for file storage?" "y" CONFIG_USE_S3

    if [[ "$CONFIG_USE_S3" == "true" ]]; then
        prompt_value "S3 bucket name" "ciso-assistant-files" CONFIG_S3_BUCKET

        prompt_choice "S3 authentication:" "  1) IAM role (recommended)
  2) Static credentials" "1" s3_auth_choice

        case "$s3_auth_choice" in
            1) CONFIG_S3_AUTH_MODE="iam" ;;
            2)
                CONFIG_S3_AUTH_MODE="credentials"
                prompt_value "AWS Access Key ID" "" CONFIG_AWS_ACCESS_KEY
                prompt_value "AWS Secret Access Key" "" CONFIG_AWS_SECRET_KEY true
                ;;
            *) CONFIG_S3_AUTH_MODE="iam" ;;
        esac
    fi

    # Task Queue
    echo ""
    echo -e "${YELLOW}=== Task Queue Configuration ===${NC}"
    echo ""

    prompt_choice "Select task queue backend:" "  1) Huey with SQLite (simple)
  2) Huey with Redis/ElastiCache (recommended)
  3) Celery with AWS SQS (serverless)" "1" queue_choice

    case "$queue_choice" in
        1)
            CONFIG_TASK_BACKEND="huey"
            CONFIG_USE_REDIS="false"
            CONFIG_USE_SQS="false"
            ;;
        2)
            CONFIG_TASK_BACKEND="huey"
            CONFIG_USE_REDIS="true"
            CONFIG_USE_SQS="false"
            prompt_value "ElastiCache endpoint" "" CONFIG_REDIS_HOST
            prompt_value "Redis port" "6379" CONFIG_REDIS_PORT
            prompt_yes_no "Enable Redis SSL?" "y" CONFIG_REDIS_SSL
            prompt_value "Number of workers" "4" CONFIG_WORKERS
            ;;
        3)
            CONFIG_TASK_BACKEND="celery"
            CONFIG_USE_REDIS="false"
            CONFIG_USE_SQS="true"
            prompt_value "SQS queue name" "ciso-assistant-tasks" CONFIG_SQS_QUEUE
            prompt_value "Number of workers" "4" CONFIG_WORKERS

            prompt_yes_no "Also use Redis for caching?" "n" CONFIG_USE_REDIS
            if [[ "$CONFIG_USE_REDIS" == "true" ]]; then
                prompt_value "ElastiCache endpoint" "" CONFIG_REDIS_HOST
                prompt_value "Redis port" "6379" CONFIG_REDIS_PORT
                prompt_yes_no "Enable Redis SSL?" "y" CONFIG_REDIS_SSL
            fi
            ;;
        *)
            CONFIG_TASK_BACKEND="huey"
            CONFIG_USE_REDIS="false"
            CONFIG_USE_SQS="false"
            ;;
    esac

    # Logging
    echo ""
    echo -e "${YELLOW}=== Logging Configuration ===${NC}"
    echo ""

    prompt_choice "Log level:" "  1) INFO
  2) DEBUG
  3) WARNING
  4) ERROR" "1" log_choice

    case "$log_choice" in
        1) CONFIG_LOG_LEVEL="INFO" ;;
        2) CONFIG_LOG_LEVEL="DEBUG" ;;
        3) CONFIG_LOG_LEVEL="WARNING" ;;
        4) CONFIG_LOG_LEVEL="ERROR" ;;
        *) CONFIG_LOG_LEVEL="INFO" ;;
    esac

    CONFIG_LOG_FORMAT="json"
}

write_env_file() {
    log_info "Writing configuration..."

    cat > "${CONFIG_DIR}/env" << EOF
# CISO Assistant Configuration
# Generated on $(date)
# Ubuntu FIPS Deployment

# Django Settings
DJANGO_SECRET_KEY=${CONFIG_SECRET_KEY}
DJANGO_DEBUG=False
ALLOWED_HOSTS=${CONFIG_ALLOWED_HOSTS}

# Application URL
CISO_ASSISTANT_URL=${CONFIG_URL}

# Database (RDS PostgreSQL)
POSTGRES_NAME=${CONFIG_DB_NAME}
POSTGRES_USER=${CONFIG_DB_USER}
DB_HOST=${CONFIG_DB_HOST}
DB_PORT=${CONFIG_DB_PORT}
EOF

    if [[ "$CONFIG_USE_IAM_AUTH" == "true" ]]; then
        cat >> "${CONFIG_DIR}/env" << EOF
RDS_IAM_AUTH=True
DB_SSL_MODE=require
EOF
    else
        cat >> "${CONFIG_DIR}/env" << EOF
POSTGRES_PASSWORD=${CONFIG_DB_PASSWORD}
RDS_IAM_AUTH=False
DB_SSL_MODE=prefer
EOF
    fi

    cat >> "${CONFIG_DIR}/env" << EOF

# AWS
AWS_REGION=${CONFIG_AWS_REGION}
EOF

    if [[ "$CONFIG_USE_S3" == "true" ]]; then
        cat >> "${CONFIG_DIR}/env" << EOF

# S3 Storage
USE_S3=True
AWS_AUTH_MODE=${CONFIG_S3_AUTH_MODE}
AWS_STORAGE_BUCKET_NAME=${CONFIG_S3_BUCKET}
EOF
        if [[ "$CONFIG_S3_AUTH_MODE" == "credentials" ]]; then
            cat >> "${CONFIG_DIR}/env" << EOF
AWS_ACCESS_KEY_ID=${CONFIG_AWS_ACCESS_KEY}
AWS_SECRET_ACCESS_KEY=${CONFIG_AWS_SECRET_KEY}
EOF
        fi
    else
        cat >> "${CONFIG_DIR}/env" << EOF

# S3 Storage (disabled)
USE_S3=False
EOF
    fi

    cat >> "${CONFIG_DIR}/env" << EOF

# Task Queue
TASK_QUEUE_BACKEND=${CONFIG_TASK_BACKEND}
EOF

    if [[ "$CONFIG_USE_REDIS" == "true" ]]; then
        cat >> "${CONFIG_DIR}/env" << EOF

# Redis/ElastiCache
USE_REDIS=True
REDIS_HOST=${CONFIG_REDIS_HOST}
REDIS_PORT=${CONFIG_REDIS_PORT}
REDIS_SSL=${CONFIG_REDIS_SSL^}
EOF
        [[ -n "${CONFIG_WORKERS:-}" ]] && echo "HUEY_WORKERS=${CONFIG_WORKERS}" >> "${CONFIG_DIR}/env"
    fi

    if [[ "$CONFIG_USE_SQS" == "true" ]]; then
        cat >> "${CONFIG_DIR}/env" << EOF

# AWS SQS
USE_SQS=True
SQS_QUEUE_NAME=${CONFIG_SQS_QUEUE}
AWS_SQS_REGION=${CONFIG_AWS_REGION}
EOF
        [[ -n "${CONFIG_WORKERS:-}" ]] && echo "CELERY_WORKERS=${CONFIG_WORKERS}" >> "${CONFIG_DIR}/env"
    fi

    cat >> "${CONFIG_DIR}/env" << EOF

# Admin
CISO_ASSISTANT_SUPERUSER_EMAIL=${CONFIG_ADMIN_EMAIL}

# Logging
LOG_LEVEL=${CONFIG_LOG_LEVEL}
LOG_FORMAT=${CONFIG_LOG_FORMAT}

# Connection Pool
CONN_MAX_AGE=840

# FIPS Mode
FIPS_MODE=True
EOF

    chmod 640 "${CONFIG_DIR}/env"
    chown root:$APP_USER "${CONFIG_DIR}/env"

    log_info "Configuration saved to ${CONFIG_DIR}/env"
}

create_default_env_file() {
    local default_secret_key=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")

    cat > "${CONFIG_DIR}/env" << EOF
# CISO Assistant Configuration
# Generated on $(date)
# EDIT THIS FILE WITH YOUR VALUES

# Django Settings
DJANGO_SECRET_KEY=${default_secret_key}
DJANGO_DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1

# Application URL
CISO_ASSISTANT_URL=https://localhost

# Database (CHANGE THESE)
POSTGRES_NAME=ciso_assistant
POSTGRES_USER=ciso_app
DB_HOST=YOUR_RDS_ENDPOINT
DB_PORT=5432
RDS_IAM_AUTH=True
DB_SSL_MODE=require

# AWS
AWS_REGION=us-gov-west-1

# S3 Storage (CHANGE BUCKET NAME)
USE_S3=True
AWS_AUTH_MODE=iam
AWS_STORAGE_BUCKET_NAME=YOUR_BUCKET_NAME

# Task Queue
TASK_QUEUE_BACKEND=huey

# Admin (CHANGE THIS)
CISO_ASSISTANT_SUPERUSER_EMAIL=admin@example.gov

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json

# Connection Pool
CONN_MAX_AGE=840

# FIPS Mode
FIPS_MODE=True
EOF

    chmod 640 "${CONFIG_DIR}/env"
    chown root:$APP_USER "${CONFIG_DIR}/env"

    log_warn "Default configuration created. EDIT ${CONFIG_DIR}/env with your values!"
}

create_env_file() {
    log_info "Setting up configuration..."

    if [[ "$SKIP_CONFIG" == "true" ]]; then
        if [[ -f "${CONFIG_DIR}/env" ]]; then
            log_info "Using existing configuration"
            return
        fi
        create_default_env_file
        return
    fi

    if [[ -f "${CONFIG_DIR}/env" ]]; then
        log_warn "Configuration exists at ${CONFIG_DIR}/env"
        prompt_yes_no "Reconfigure?" "n" do_reconfig
        if [[ "$do_reconfig" != "true" ]]; then
            return
        fi
        cp "${CONFIG_DIR}/env" "${CONFIG_DIR}/env.backup.$(date +%Y%m%d_%H%M%S)"
    fi

    if [[ "$INTERACTIVE" != "true" ]]; then
        create_default_env_file
        return
    fi

    interactive_config
    write_env_file
}

# =============================================================================
# Systemd Services
# =============================================================================

create_systemd_services() {
    log_info "Creating systemd services..."

    # Backend service
    cat > /etc/systemd/system/ciso-assistant-backend.service << EOF
[Unit]
Description=CISO Assistant Backend (Django/Gunicorn)
After=network.target

[Service]
Type=notify
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}/app/backend
EnvironmentFile=${CONFIG_DIR}/env
ExecStart=${VENV_DIR}/bin/gunicorn \\
    --bind 127.0.0.1:8000 \\
    --workers 4 \\
    --worker-class gthread \\
    --threads 2 \\
    --timeout 120 \\
    --keep-alive 5 \\
    --max-requests 1000 \\
    --max-requests-jitter 50 \\
    --access-logfile ${LOG_DIR}/gunicorn-access.log \\
    --error-logfile ${LOG_DIR}/gunicorn-error.log \\
    --capture-output \\
    ciso_assistant.wsgi:application
ExecReload=/bin/kill -s HUP \$MAINPID
Restart=always
RestartSec=5
KillMode=mixed
TimeoutStopSec=30
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

    # Frontend service
    cat > /etc/systemd/system/ciso-assistant-frontend.service << EOF
[Unit]
Description=CISO Assistant Frontend (SvelteKit)
After=network.target ciso-assistant-backend.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}/app/frontend
EnvironmentFile=${CONFIG_DIR}/env
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOST=127.0.0.1
ExecStart=/usr/bin/node build
Restart=always
RestartSec=5
StandardOutput=append:${LOG_DIR}/frontend.log
StandardError=append:${LOG_DIR}/frontend-error.log

[Install]
WantedBy=multi-user.target
EOF

    # Worker script
    cat > "${APP_DIR}/run-worker.sh" << 'WORKER_SCRIPT'
#!/bin/bash
set -euo pipefail

APP_DIR="/opt/ciso-assistant"
VENV_DIR="${APP_DIR}/venv"

cd "${APP_DIR}/app/backend"
source "${VENV_DIR}/bin/activate"

BACKEND="${TASK_QUEUE_BACKEND:-huey}"
WORKERS="${HUEY_WORKERS:-${CELERY_WORKERS:-4}}"
QUEUE="${SQS_QUEUE_NAME:-ciso-assistant-tasks}"

if [ "$BACKEND" = "celery" ]; then
    echo "Starting Celery worker..."
    if [ "${USE_SQS:-False}" = "True" ]; then
        exec celery -A ciso_assistant worker -l info -Q "$QUEUE" -c "$WORKERS"
    else
        exec celery -A ciso_assistant worker -l info -c "$WORKERS"
    fi
else
    echo "Starting Huey worker..."
    exec python manage.py run_huey
fi
WORKER_SCRIPT

    chmod +x "${APP_DIR}/run-worker.sh"
    chown "${APP_USER}:${APP_USER}" "${APP_DIR}/run-worker.sh"

    # Worker service
    cat > /etc/systemd/system/ciso-assistant-worker.service << EOF
[Unit]
Description=CISO Assistant Worker (Huey/Celery)
After=network.target ciso-assistant-backend.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}/app/backend
EnvironmentFile=${CONFIG_DIR}/env
ExecStart=${APP_DIR}/run-worker.sh
Restart=always
RestartSec=5
StandardOutput=append:${LOG_DIR}/worker.log
StandardError=append:${LOG_DIR}/worker-error.log

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload

    log_info "Systemd services created"
}

# =============================================================================
# Nginx Configuration
# =============================================================================

configure_nginx() {
    log_info "Configuring Nginx..."

    # Create site configuration
    cat > /etc/nginx/sites-available/ciso-assistant << 'EOF'
# CISO Assistant Nginx Configuration

upstream backend {
    server 127.0.0.1:8000;
    keepalive 32;
}

upstream frontend {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name _;

    # SSL Configuration
    ssl_certificate /etc/ssl/certs/server.crt;
    ssl_certificate_key /etc/ssl/private/server.key;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    # FIPS-compliant SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Logging
    access_log /var/log/nginx/ciso-assistant-access.log;
    error_log /var/log/nginx/ciso-assistant-error.log;

    client_max_body_size 100M;

    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

    # Enable site
    ln -sf /etc/nginx/sites-available/ciso-assistant /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default

    # Generate self-signed cert if none exists
    if [[ ! -f /etc/ssl/certs/server.crt ]]; then
        log_info "Generating temporary self-signed certificate..."
        openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
            -keyout /etc/ssl/private/server.key \
            -out /etc/ssl/certs/server.crt \
            -subj "/CN=localhost/O=CISO Assistant/C=US" 2>/dev/null
        chmod 600 /etc/ssl/private/server.key
    fi

    nginx -t

    log_info "Nginx configured"
}

# =============================================================================
# Firewall Configuration
# =============================================================================

configure_firewall() {
    log_info "Configuring firewall..."

    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing

    ufw allow ssh
    ufw allow 80/tcp
    ufw allow 443/tcp

    ufw --force enable

    log_info "Firewall configured"
}

# =============================================================================
# Helper Scripts
# =============================================================================

install_helper_scripts() {
    log_info "Installing helper scripts..."

    local scripts_dir="${APP_DIR}/scripts"
    local repo_scripts="${APP_DIR}/app/deploy/ubuntu-fips/scripts"

    if [[ -d "$repo_scripts" ]]; then
        cp -r "$repo_scripts"/* "$scripts_dir/"
    else
        # Download from GitHub
        local base_url="https://raw.githubusercontent.com/tashiscool/ciso-assistant-community/main/deploy/ubuntu-fips/scripts"
        local scripts=("ciso-assistant.sh" "setup-ssl.sh" "test-db.sh" "run-migrations.sh" "create-admin.sh" "manage-services.sh" "check-fips.sh")

        for script in "${scripts[@]}"; do
            curl -sL "${base_url}/${script}" -o "${scripts_dir}/${script}" 2>/dev/null || true
        done
    fi

    chmod +x "${scripts_dir}"/*.sh 2>/dev/null || true
    chown -R root:root "$scripts_dir"

    ln -sf "${scripts_dir}/ciso-assistant.sh" /usr/local/bin/ciso-assistant

    log_info "Helper scripts installed"
}

create_update_script() {
    log_info "Creating update script..."

    cat > "${APP_DIR}/update.sh" << 'EOF'
#!/bin/bash
set -euo pipefail

APP_DIR="/opt/ciso-assistant"
VENV_DIR="${APP_DIR}/venv"
CONFIG_DIR="/etc/ciso-assistant"

echo "Stopping services..."
systemctl stop ciso-assistant-frontend ciso-assistant-worker ciso-assistant-backend

echo "Pulling latest code..."
cd "${APP_DIR}/app"
git pull origin main

echo "Updating backend..."
source "${VENV_DIR}/bin/activate"
cd "${APP_DIR}/app/backend"
poetry install --no-dev

echo "Running migrations..."
set -a && source "${CONFIG_DIR}/env" && set +a
python manage.py migrate --noinput
python manage.py collectstatic --noinput

echo "Updating frontend..."
cd "${APP_DIR}/app/frontend"
npm ci
npm run build

echo "Starting services..."
systemctl start ciso-assistant-backend ciso-assistant-frontend ciso-assistant-worker

echo "Update complete!"
EOF

    chmod +x "${APP_DIR}/update.sh"
    chown "$APP_USER:$APP_USER" "${APP_DIR}/update.sh"
}

# =============================================================================
# Post-Installation
# =============================================================================

enable_services() {
    log_info "Enabling and starting services..."

    systemctl enable nginx ciso-assistant-backend ciso-assistant-frontend ciso-assistant-worker
    systemctl start nginx ciso-assistant-backend ciso-assistant-frontend ciso-assistant-worker

    log_info "Services started"
}

interactive_post_install() {
    echo ""
    echo "========================================"
    echo "  Post-Installation Setup"
    echo "========================================"

    # SSL
    echo ""
    echo -e "${YELLOW}=== SSL Certificates ===${NC}"
    prompt_choice "SSL certificate setup:" "  1) Use Let's Encrypt (Recommended)
  2) Generate self-signed (testing only)
  3) Configure manually later" "1" ssl_choice

    case "$ssl_choice" in
        1)
            if command -v certbot &>/dev/null || apt-get install -y certbot python3-certbot-nginx; then
                local domain=$(grep "^CISO_ASSISTANT_URL=" "${CONFIG_DIR}/env" 2>/dev/null | cut -d'=' -f2 | sed 's|https://||' | cut -d'/' -f1)
                [[ "$domain" == "localhost" ]] && read -p "Enter domain: " domain
                certbot --nginx -d "$domain" --non-interactive --agree-tos --register-unsafely-without-email || \
                    log_warn "Certbot failed - configure SSL manually"
            fi
            ;;
        2)
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout /etc/ssl/private/server.key \
                -out /etc/ssl/certs/server.crt \
                -subj "/CN=localhost/O=CISO Assistant/C=US"
            chmod 600 /etc/ssl/private/server.key
            log_warn "Self-signed certificate created - replace for production!"
            ;;
    esac

    # Database
    echo ""
    echo -e "${YELLOW}=== Database Setup ===${NC}"
    prompt_yes_no "Test database connection?" "y" do_test_db

    if [[ "$do_test_db" == "true" ]]; then
        source "${VENV_DIR}/bin/activate"
        cd "${APP_DIR}/app/backend"
        set -a && source "${CONFIG_DIR}/env" && set +a

        if sudo -u "$APP_USER" -E "${VENV_DIR}/bin/python" manage.py check --database default 2>/dev/null; then
            log_info "Database connection OK"

            prompt_yes_no "Run migrations?" "y" do_migrate
            if [[ "$do_migrate" == "true" ]]; then
                sudo -u "$APP_USER" -E "${VENV_DIR}/bin/python" manage.py migrate --noinput
                sudo -u "$APP_USER" -E "${VENV_DIR}/bin/python" manage.py collectstatic --noinput
                log_info "Migrations complete"
            fi
        else
            log_error "Database connection failed - check configuration"
        fi
    fi

    # Admin user
    echo ""
    echo -e "${YELLOW}=== Admin User ===${NC}"
    prompt_yes_no "Create admin user?" "y" do_admin

    if [[ "$do_admin" == "true" ]]; then
        source "${VENV_DIR}/bin/activate"
        cd "${APP_DIR}/app/backend"
        set -a && source "${CONFIG_DIR}/env" && set +a
        sudo -u "$APP_USER" -E "${VENV_DIR}/bin/python" manage.py createsuperuser
    fi

    # Start services
    echo ""
    echo -e "${YELLOW}=== Start Services ===${NC}"
    prompt_yes_no "Start all services?" "y" do_start

    if [[ "$do_start" == "true" ]]; then
        enable_services

        echo ""
        echo "Service Status:"
        for svc in nginx ciso-assistant-backend ciso-assistant-frontend ciso-assistant-worker; do
            if systemctl is-active --quiet "$svc"; then
                echo -e "  $svc: ${GREEN}running${NC}"
            else
                echo -e "  $svc: ${RED}stopped${NC}"
            fi
        done
    fi
}

print_summary() {
    echo ""
    echo "========================================"
    echo "  CISO Assistant Deployment Complete!"
    echo "========================================"
    echo ""

    # FIPS status
    if [[ -f /proc/sys/crypto/fips_enabled ]] && [[ "$(cat /proc/sys/crypto/fips_enabled)" == "1" ]]; then
        echo -e "FIPS Mode: ${GREEN}ENABLED${NC}"
    else
        echo -e "FIPS Mode: ${YELLOW}NOT ENABLED (reboot required)${NC}"
    fi
    echo ""

    echo "Configuration: ${CONFIG_DIR}/env"
    echo "Application:   ${APP_DIR}"
    echo "Logs:          ${LOG_DIR}"
    echo ""
    echo "Management Console:"
    echo -e "  ${GREEN}sudo ciso-assistant${NC}  - Interactive menu"
    echo ""
    echo "Quick Commands:"
    echo "  sudo ciso-assistant status"
    echo "  sudo ciso-assistant restart"
    echo "  sudo ciso-assistant ssl"
    echo "  sudo ciso-assistant health"
    echo ""
    echo "Access: ${CONFIG_URL:-https://localhost}"
    echo ""
}

show_welcome() {
    [[ "$INTERACTIVE" == "true" ]] && clear
    echo ""
    echo "========================================"
    echo "  CISO Assistant - Ubuntu FIPS"
    echo "  Deployment Script"
    echo "========================================"
    echo ""
    echo "This script deploys CISO Assistant with:"
    echo "  - FIPS 140-2/140-3 validated cryptography"
    echo "  - Ubuntu Pro FIPS packages"
    echo "  - AWS GovCloud support"
    echo "  - RDS PostgreSQL with IAM auth"
    echo "  - S3 storage with IAM roles"
    echo ""
    [[ "$INTERACTIVE" == "true" ]] && read -p "Press Enter to continue..."
}

show_help() {
    echo "CISO Assistant - Ubuntu FIPS Deployment"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --non-interactive    Run without prompts"
    echo "  --skip-fips          Skip FIPS enablement"
    echo "  --skip-config        Use existing configuration"
    echo "  --help, -h           Show this help"
    echo ""
}

# =============================================================================
# Main
# =============================================================================

main() {
    show_welcome

    log_info "Starting deployment..."

    check_root
    check_ubuntu

    # FIPS Setup
    echo ""
    echo -e "${YELLOW}=== Phase 1: FIPS Cryptography ===${NC}"
    enable_fips
    verify_fips_crypto

    # System Setup
    echo ""
    echo -e "${YELLOW}=== Phase 2: System Packages ===${NC}"
    install_system_packages
    install_python
    install_nodejs

    # Application Setup
    echo ""
    echo -e "${YELLOW}=== Phase 3: Application ===${NC}"
    create_app_user
    create_directories
    clone_repository
    setup_backend
    setup_frontend

    # Configuration
    echo ""
    echo -e "${YELLOW}=== Phase 4: Configuration ===${NC}"
    create_env_file

    # Services
    echo ""
    echo -e "${YELLOW}=== Phase 5: Services ===${NC}"
    create_systemd_services
    configure_nginx
    configure_firewall
    create_update_script
    install_helper_scripts

    # Post-install
    if [[ "$INTERACTIVE" == "true" ]]; then
        interactive_post_install
    fi

    print_summary

    log_info "Deployment complete!"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --non-interactive|-n)
            INTERACTIVE=false
            shift
            ;;
        --skip-fips)
            SKIP_FIPS=true
            shift
            ;;
        --skip-config)
            SKIP_CONFIG=true
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

main
