#!/bin/bash
#
# CISO Assistant - EC2 RHEL 8 Deployment Script
#
# This script deploys CISO Assistant on a RHEL 8 EC2 instance with:
# - PostgreSQL RDS with IAM authentication
# - S3 for file storage (using IAM roles)
# - Nginx reverse proxy
# - Systemd services
#
# Prerequisites:
# - RHEL 8 EC2 instance with IAM role attached
# - RDS PostgreSQL instance configured for IAM auth
# - S3 bucket created
# - Security groups configured (ports 80, 443, 5432)
#
# Usage:
#   sudo ./deploy.sh
#
# Environment variables (set before running or in /etc/ciso-assistant/env):
#   POSTGRES_NAME - Database name
#   POSTGRES_USER - Database IAM user
#   DB_HOST - RDS endpoint
#   AWS_REGION - AWS region (default: us-gov-west-1)
#   AWS_STORAGE_BUCKET_NAME - S3 bucket name
#   CISO_ASSISTANT_URL - Public URL (e.g., https://ciso.example.gov)
#   DJANGO_SECRET_KEY - Django secret key
#   CISO_ASSISTANT_SUPERUSER_EMAIL - Initial admin email

set -euo pipefail

# Configuration
APP_USER="ciso-assistant"
APP_DIR="/opt/ciso-assistant"
CONFIG_DIR="/etc/ciso-assistant"
LOG_DIR="/var/log/ciso-assistant"
VENV_DIR="${APP_DIR}/venv"
NODE_VERSION="20"
PYTHON_VERSION="3.11"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        exit 1
    fi
}

check_rhel8() {
    if ! grep -q "Red Hat Enterprise Linux" /etc/os-release; then
        log_warn "This script is designed for RHEL 8. Proceeding anyway..."
    fi
    if ! grep -q "VERSION_ID=\"8" /etc/os-release; then
        log_warn "This script is designed for RHEL 8.x. Detected different version."
    fi
}

install_system_packages() {
    log_info "Installing system packages..."

    # Enable required repos
    dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-8.noarch.rpm || true
    dnf config-manager --set-enabled codeready-builder-for-rhel-8-rhui-rpms || \
        dnf config-manager --set-enabled codeready-builder-for-rhel-8-x86_64-rpms || true

    # Install base packages
    dnf install -y \
        git \
        gcc \
        gcc-c++ \
        make \
        openssl-devel \
        bzip2-devel \
        libffi-devel \
        zlib-devel \
        readline-devel \
        sqlite-devel \
        postgresql-devel \
        nginx \
        curl \
        wget \
        unzip \
        jq \
        policycoreutils-python-utils

    log_info "System packages installed"
}

install_python() {
    log_info "Installing Python ${PYTHON_VERSION}..."

    # Check if Python 3.11 is available
    if command -v python3.11 &> /dev/null; then
        log_info "Python 3.11 already installed"
        return
    fi

    # Install Python 3.11 from source if not available
    dnf install -y python3.11 python3.11-devel python3.11-pip || {
        log_info "Installing Python 3.11 from source..."
        cd /tmp
        wget https://www.python.org/ftp/python/3.11.7/Python-3.11.7.tgz
        tar xzf Python-3.11.7.tgz
        cd Python-3.11.7
        ./configure --enable-optimizations --prefix=/usr/local
        make -j$(nproc)
        make altinstall
        cd /
        rm -rf /tmp/Python-3.11.7*
    }

    log_info "Python ${PYTHON_VERSION} installed"
}

install_nodejs() {
    log_info "Installing Node.js ${NODE_VERSION}..."

    if command -v node &> /dev/null; then
        CURRENT_NODE=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ "$CURRENT_NODE" -ge "$NODE_VERSION" ]]; then
            log_info "Node.js ${NODE_VERSION}+ already installed"
            return
        fi
    fi

    # Install Node.js from NodeSource
    curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | bash -
    dnf install -y nodejs

    log_info "Node.js installed: $(node --version)"
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
    mkdir -p "${APP_DIR}/static"
    mkdir -p "${APP_DIR}/media"

    chown -R "$APP_USER:$APP_USER" "$APP_DIR"
    chown -R "$APP_USER:$APP_USER" "$LOG_DIR"
    chmod 750 "$CONFIG_DIR"

    log_info "Directories created"
}

clone_repository() {
    log_info "Cloning CISO Assistant repository..."

    if [[ -d "${APP_DIR}/app" ]]; then
        log_info "Repository already exists, pulling latest..."
        cd "${APP_DIR}/app"
        sudo -u "$APP_USER" git pull origin main
    else
        sudo -u "$APP_USER" git clone https://github.com/tashiscool/ciso-assistant-community.git "${APP_DIR}/app"
    fi

    log_info "Repository ready"
}

setup_backend() {
    log_info "Setting up backend..."

    cd "${APP_DIR}/app/backend"

    # Create virtual environment
    if [[ ! -d "$VENV_DIR" ]]; then
        python3.11 -m venv "$VENV_DIR"
    fi

    # Activate and install dependencies
    source "${VENV_DIR}/bin/activate"
    pip install --upgrade pip
    pip install poetry
    poetry config virtualenvs.create false
    poetry install --no-dev

    # Install additional production dependencies
    pip install gunicorn psycopg2-binary

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

prompt_value() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    local is_secret="${4:-false}"
    local value

    # In non-interactive mode, use default
    if [[ "${INTERACTIVE:-true}" != "true" ]]; then
        eval "$var_name=\"$default\""
        return
    fi

    if [[ "$is_secret" == "true" ]]; then
        read -sp "$prompt [$default]: " value
        echo ""
    else
        read -p "$prompt [$default]: " value
    fi

    if [[ -z "$value" ]]; then
        value="$default"
    fi

    eval "$var_name=\"$value\""
}

prompt_yes_no() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    local response

    # In non-interactive mode, use default
    if [[ "${INTERACTIVE:-true}" != "true" ]]; then
        case "$default" in
            [Yy]* ) eval "$var_name=true"; return;;
            [Nn]* ) eval "$var_name=false"; return;;
        esac
        return
    fi

    while true; do
        read -p "$prompt (y/n) [$default]: " response
        response="${response:-$default}"
        case "$response" in
            [Yy]* ) eval "$var_name=true"; return;;
            [Nn]* ) eval "$var_name=false"; return;;
            * ) echo "Please answer y or n.";;
        esac
    done
}

prompt_choice() {
    local prompt="$1"
    local options="$2"
    local default="$3"
    local var_name="$4"
    local choice

    # In non-interactive mode, use default
    if [[ "${INTERACTIVE:-true}" != "true" ]]; then
        eval "$var_name=\"$default\""
        return
    fi

    echo "$prompt"
    echo "$options"
    read -p "Enter choice [$default]: " choice
    choice="${choice:-$default}"
    eval "$var_name=\"$choice\""
}

interactive_config() {
    log_info "Starting interactive configuration..."
    echo ""
    echo "========================================"
    echo "  CISO Assistant Configuration Wizard"
    echo "========================================"
    echo ""
    echo "This wizard will help you configure CISO Assistant."
    echo "Press Enter to accept default values shown in brackets."
    echo ""

    # Generate a random secret key
    local default_secret_key=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")

    # ===== BASIC SETTINGS =====
    echo ""
    echo "${YELLOW}=== Basic Settings ===${NC}"
    echo ""

    prompt_value "Application URL (e.g., https://ciso.example.gov)" "https://localhost" CONFIG_URL
    prompt_value "Allowed hosts (comma-separated)" "localhost,127.0.0.1" CONFIG_ALLOWED_HOSTS
    prompt_value "Admin email address" "admin@example.gov" CONFIG_ADMIN_EMAIL
    prompt_value "Django secret key" "$default_secret_key" CONFIG_SECRET_KEY true

    # ===== AWS REGION =====
    echo ""
    echo "${YELLOW}=== AWS Configuration ===${NC}"
    echo ""

    prompt_choice "Select AWS region:" "  1) us-gov-west-1 (GovCloud West)
  2) us-gov-east-1 (GovCloud East)
  3) us-east-1 (N. Virginia)
  4) us-west-2 (Oregon)
  5) Other (enter manually)" "1" region_choice

    case "$region_choice" in
        1) CONFIG_AWS_REGION="us-gov-west-1" ;;
        2) CONFIG_AWS_REGION="us-gov-east-1" ;;
        3) CONFIG_AWS_REGION="us-east-1" ;;
        4) CONFIG_AWS_REGION="us-west-2" ;;
        5) prompt_value "Enter AWS region" "us-east-1" CONFIG_AWS_REGION ;;
        *) CONFIG_AWS_REGION="us-gov-west-1" ;;
    esac

    # ===== DATABASE =====
    echo ""
    echo "${YELLOW}=== Database Configuration (RDS PostgreSQL) ===${NC}"
    echo ""

    prompt_value "RDS endpoint (e.g., mydb.xxx.rds.amazonaws.com)" "" CONFIG_DB_HOST
    prompt_value "Database name" "ciso_assistant" CONFIG_DB_NAME
    prompt_value "Database user" "ciso_app" CONFIG_DB_USER
    prompt_value "Database port" "5432" CONFIG_DB_PORT

    prompt_yes_no "Use IAM authentication for RDS?" "y" CONFIG_USE_IAM_AUTH

    if [[ "$CONFIG_USE_IAM_AUTH" != "true" ]]; then
        prompt_value "Database password" "" CONFIG_DB_PASSWORD true
    fi

    # ===== S3 STORAGE =====
    echo ""
    echo "${YELLOW}=== S3 Storage Configuration ===${NC}"
    echo ""

    prompt_yes_no "Use S3 for file storage?" "y" CONFIG_USE_S3

    if [[ "$CONFIG_USE_S3" == "true" ]]; then
        prompt_value "S3 bucket name" "ciso-assistant-files" CONFIG_S3_BUCKET

        prompt_choice "S3 authentication method:" "  1) IAM role (recommended for EC2)
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

    # ===== TASK QUEUE =====
    echo ""
    echo "${YELLOW}=== Task Queue Configuration ===${NC}"
    echo ""

    prompt_choice "Select task queue backend:" "  1) Huey with SQLite (simple, single-server)
  2) Huey with Redis/ElastiCache (recommended for production)
  3) Celery with AWS SQS (fully managed, serverless)" "1" queue_choice

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
            echo ""
            prompt_value "ElastiCache/Redis endpoint" "" CONFIG_REDIS_HOST
            prompt_value "Redis port" "6379" CONFIG_REDIS_PORT
            prompt_yes_no "Enable Redis SSL/TLS?" "y" CONFIG_REDIS_SSL
            prompt_value "Number of workers" "4" CONFIG_WORKERS
            ;;
        3)
            CONFIG_TASK_BACKEND="celery"
            CONFIG_USE_REDIS="false"
            CONFIG_USE_SQS="true"
            echo ""
            prompt_value "SQS queue name" "ciso-assistant-tasks" CONFIG_SQS_QUEUE
            prompt_value "Number of workers" "4" CONFIG_WORKERS

            prompt_yes_no "Also use Redis/ElastiCache for caching?" "n" CONFIG_USE_REDIS
            if [[ "$CONFIG_USE_REDIS" == "true" ]]; then
                prompt_value "ElastiCache/Redis endpoint" "" CONFIG_REDIS_HOST
                prompt_value "Redis port" "6379" CONFIG_REDIS_PORT
                prompt_yes_no "Enable Redis SSL/TLS?" "y" CONFIG_REDIS_SSL
            fi
            ;;
        *)
            CONFIG_TASK_BACKEND="huey"
            CONFIG_USE_REDIS="false"
            CONFIG_USE_SQS="false"
            ;;
    esac

    # ===== LOGGING =====
    echo ""
    echo "${YELLOW}=== Logging Configuration ===${NC}"
    echo ""

    prompt_choice "Log level:" "  1) INFO (recommended)
  2) DEBUG (verbose)
  3) WARNING
  4) ERROR" "1" log_choice

    case "$log_choice" in
        1) CONFIG_LOG_LEVEL="INFO" ;;
        2) CONFIG_LOG_LEVEL="DEBUG" ;;
        3) CONFIG_LOG_LEVEL="WARNING" ;;
        4) CONFIG_LOG_LEVEL="ERROR" ;;
        *) CONFIG_LOG_LEVEL="INFO" ;;
    esac

    prompt_choice "Log format:" "  1) JSON (recommended for production)
  2) Plain text (easier to read)" "1" log_format_choice

    case "$log_format_choice" in
        1) CONFIG_LOG_FORMAT="json" ;;
        2) CONFIG_LOG_FORMAT="plain" ;;
        *) CONFIG_LOG_FORMAT="json" ;;
    esac
}

write_env_file() {
    log_info "Writing environment configuration..."

    cat > "${CONFIG_DIR}/env" << EOF
# CISO Assistant Configuration
# Generated by deployment wizard on $(date)

# Django Settings
DJANGO_SECRET_KEY=${CONFIG_SECRET_KEY}
DJANGO_DEBUG=False
ALLOWED_HOSTS=${CONFIG_ALLOWED_HOSTS}

# Application URL
CISO_ASSISTANT_URL=${CONFIG_URL}

# Database Configuration (RDS PostgreSQL)
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

# AWS Configuration
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

# S3 Storage (disabled - using local storage)
USE_S3=False
EOF
    fi

    cat >> "${CONFIG_DIR}/env" << EOF

# Task Queue Configuration
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
        if [[ -n "${CONFIG_WORKERS:-}" ]]; then
            cat >> "${CONFIG_DIR}/env" << EOF
HUEY_WORKERS=${CONFIG_WORKERS}
EOF
        fi
    fi

    if [[ "$CONFIG_USE_SQS" == "true" ]]; then
        cat >> "${CONFIG_DIR}/env" << EOF

# AWS SQS
USE_SQS=True
SQS_QUEUE_NAME=${CONFIG_SQS_QUEUE}
AWS_SQS_REGION=${CONFIG_AWS_REGION}
EOF
        if [[ -n "${CONFIG_WORKERS:-}" ]]; then
            cat >> "${CONFIG_DIR}/env" << EOF
CELERY_WORKERS=${CONFIG_WORKERS}
EOF
        fi
    fi

    cat >> "${CONFIG_DIR}/env" << EOF

# Admin User
CISO_ASSISTANT_SUPERUSER_EMAIL=${CONFIG_ADMIN_EMAIL}

# Logging
LOG_LEVEL=${CONFIG_LOG_LEVEL}
LOG_FORMAT=${CONFIG_LOG_FORMAT}

# Connection Pool (for IAM auth, keep under 15 min)
CONN_MAX_AGE=840
EOF

    chmod 640 "${CONFIG_DIR}/env"
    chown root:$APP_USER "${CONFIG_DIR}/env"

    log_info "Environment file created at ${CONFIG_DIR}/env"
}

create_default_env_file() {
    # Create a basic env file with placeholders for non-interactive mode
    local default_secret_key=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")

    cat > "${CONFIG_DIR}/env" << EOF
# CISO Assistant Configuration
# Generated by deployment script on $(date)
# IMPORTANT: Edit this file with your actual values!

# Django Settings
DJANGO_SECRET_KEY=${default_secret_key}
DJANGO_DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1

# Application URL (CHANGE THIS)
CISO_ASSISTANT_URL=https://localhost

# Database Configuration (CHANGE THESE)
POSTGRES_NAME=ciso_assistant
POSTGRES_USER=ciso_app
DB_HOST=YOUR_RDS_ENDPOINT_HERE
DB_PORT=5432
RDS_IAM_AUTH=True
DB_SSL_MODE=require

# AWS Configuration
AWS_REGION=us-gov-west-1

# S3 Storage (CHANGE BUCKET NAME)
USE_S3=True
AWS_AUTH_MODE=iam
AWS_STORAGE_BUCKET_NAME=YOUR_S3_BUCKET_HERE

# Task Queue
TASK_QUEUE_BACKEND=huey

# Admin User (CHANGE THIS)
CISO_ASSISTANT_SUPERUSER_EMAIL=admin@example.gov

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json

# Connection Pool
CONN_MAX_AGE=840
EOF

    chmod 640 "${CONFIG_DIR}/env"
    chown root:$APP_USER "${CONFIG_DIR}/env"

    log_warn "Default configuration created. IMPORTANT: Edit ${CONFIG_DIR}/env with your values!"
}

create_env_file() {
    log_info "Setting up environment configuration..."

    # Check if skip-config flag is set
    if [[ "${SKIP_CONFIG:-false}" == "true" ]]; then
        if [[ -f "${CONFIG_DIR}/env" ]]; then
            log_info "Using existing configuration (--skip-config)"
            return
        else
            log_warn "No existing config found. Creating default..."
            create_default_env_file
            return
        fi
    fi

    if [[ -f "${CONFIG_DIR}/env" ]]; then
        echo ""
        log_warn "Environment file already exists at ${CONFIG_DIR}/env"
        prompt_yes_no "Do you want to reconfigure?" "n" do_reconfig

        if [[ "$do_reconfig" != "true" ]]; then
            log_info "Keeping existing configuration."
            return
        fi

        # Backup existing config
        cp "${CONFIG_DIR}/env" "${CONFIG_DIR}/env.backup.$(date +%Y%m%d_%H%M%S)"
        log_info "Existing config backed up."
    fi

    # In non-interactive mode, create default env file
    if [[ "${INTERACTIVE:-true}" != "true" ]]; then
        create_default_env_file
        return
    fi

    interactive_config
    write_env_file
}

run_migrations() {
    log_info "Running database migrations..."

    source "${VENV_DIR}/bin/activate"
    cd "${APP_DIR}/app/backend"

    # Load environment
    set -a
    source "${CONFIG_DIR}/env"
    set +a

    python manage.py migrate --noinput
    python manage.py collectstatic --noinput

    log_info "Migrations complete"
}

create_systemd_services() {
    log_info "Creating systemd services..."

    # Backend service (Gunicorn)
    cat > /etc/systemd/system/ciso-assistant-backend.service << EOF
[Unit]
Description=CISO Assistant Backend (Gunicorn)
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

    # Frontend service (Node.js)
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

    # Worker wrapper script (supports both Huey and Celery)
    cat > "${APP_DIR}/run-worker.sh" << 'WORKER_SCRIPT'
#!/bin/bash
# CISO Assistant Worker Script
# Supports both Huey and Celery backends

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

    # Worker service (background tasks - supports Huey and Celery)
    cat > /etc/systemd/system/ciso-assistant-worker.service << EOF
[Unit]
Description=CISO Assistant Background Worker (Huey/Celery)
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

configure_nginx() {
    log_info "Configuring Nginx..."

    cat > /etc/nginx/conf.d/ciso-assistant.conf << 'EOF'
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

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name _;

    # SSL Configuration - Update paths to your certificates
    ssl_certificate /etc/pki/tls/certs/server.crt;
    ssl_certificate_key /etc/pki/tls/private/server.key;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    # Modern SSL configuration
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

    # Max upload size
    client_max_body_size 100M;

    # API requests to backend
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

    # Frontend
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

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

    # Remove default config
    rm -f /etc/nginx/conf.d/default.conf

    # Test nginx configuration
    nginx -t

    log_info "Nginx configured"
}

configure_selinux() {
    log_info "Configuring SELinux..."

    # Allow nginx to connect to upstream
    setsebool -P httpd_can_network_connect 1

    # Allow nginx to read app files
    semanage fcontext -a -t httpd_sys_content_t "${APP_DIR}(/.*)?" || true
    restorecon -Rv "$APP_DIR" || true

    log_info "SELinux configured"
}

configure_firewall() {
    log_info "Configuring firewall..."

    if systemctl is-active --quiet firewalld; then
        firewall-cmd --permanent --add-service=http
        firewall-cmd --permanent --add-service=https
        firewall-cmd --reload
        log_info "Firewall configured"
    else
        log_warn "firewalld not running, skipping firewall configuration"
    fi
}

enable_services() {
    log_info "Enabling and starting services..."

    systemctl enable nginx
    systemctl enable ciso-assistant-backend
    systemctl enable ciso-assistant-frontend
    systemctl enable ciso-assistant-worker

    systemctl start nginx
    systemctl start ciso-assistant-backend
    systemctl start ciso-assistant-frontend
    systemctl start ciso-assistant-worker

    log_info "Services enabled and started"
}

create_update_script() {
    log_info "Creating update script..."

    cat > "${APP_DIR}/update.sh" << 'EOF'
#!/bin/bash
# CISO Assistant Update Script

set -euo pipefail

APP_DIR="/opt/ciso-assistant"
VENV_DIR="${APP_DIR}/venv"
CONFIG_DIR="/etc/ciso-assistant"

echo "Stopping services..."
systemctl stop ciso-assistant-frontend
systemctl stop ciso-assistant-worker
systemctl stop ciso-assistant-backend

echo "Pulling latest code..."
cd "${APP_DIR}/app"
git pull origin main

echo "Updating backend..."
source "${VENV_DIR}/bin/activate"
cd "${APP_DIR}/app/backend"
poetry install --no-dev

echo "Running migrations..."
set -a
source "${CONFIG_DIR}/env"
set +a
python manage.py migrate --noinput
python manage.py collectstatic --noinput

echo "Updating frontend..."
cd "${APP_DIR}/app/frontend"
npm ci
npm run build

echo "Starting services..."
systemctl start ciso-assistant-backend
systemctl start ciso-assistant-frontend
systemctl start ciso-assistant-worker

echo "Update complete!"
EOF

    chmod +x "${APP_DIR}/update.sh"
    chown "$APP_USER:$APP_USER" "${APP_DIR}/update.sh"

    log_info "Update script created at ${APP_DIR}/update.sh"
}

install_helper_scripts() {
    log_info "Installing helper scripts..."

    local scripts_dir="${APP_DIR}/scripts"
    mkdir -p "$scripts_dir"

    # Download helper scripts from repository
    local repo_scripts_dir="${APP_DIR}/app/deploy/ec2-rhel8/scripts"

    if [[ -d "$repo_scripts_dir" ]]; then
        # Copy from local repo
        cp -r "$repo_scripts_dir"/* "$scripts_dir/"
    else
        # Download from GitHub
        local base_url="https://raw.githubusercontent.com/tashiscool/ciso-assistant-community/main/deploy/ec2-rhel8/scripts"
        local scripts=("ciso-assistant.sh" "setup-ssl.sh" "test-db.sh" "run-migrations.sh" "create-admin.sh" "manage-services.sh")

        for script in "${scripts[@]}"; do
            curl -sL "${base_url}/${script}" -o "${scripts_dir}/${script}" || log_warn "Failed to download $script"
        done
    fi

    # Make scripts executable
    chmod +x "${scripts_dir}"/*.sh 2>/dev/null || true
    chown -R root:root "$scripts_dir"

    # Create symlink for easy access
    ln -sf "${scripts_dir}/ciso-assistant.sh" /usr/local/bin/ciso-assistant

    log_info "Helper scripts installed to ${scripts_dir}"
    log_info "Run 'sudo ciso-assistant' for the management console"
}

test_database_connection() {
    log_info "Testing database connection..."

    source "${VENV_DIR}/bin/activate"
    cd "${APP_DIR}/app/backend"

    # Load environment
    set -a
    source "${CONFIG_DIR}/env"
    set +a

    if [[ "${RDS_IAM_AUTH:-False}" == "True" ]]; then
        if sudo -u "$APP_USER" "${VENV_DIR}/bin/python" manage.py test_rds_iam --json 2>/dev/null; then
            log_info "Database connection successful!"
            return 0
        else
            log_error "Database connection failed. Please check your configuration."
            return 1
        fi
    else
        # Try a simple database check for non-IAM auth
        if sudo -u "$APP_USER" "${VENV_DIR}/bin/python" manage.py check --database default 2>/dev/null; then
            log_info "Database connection successful!"
            return 0
        else
            log_error "Database connection failed. Please check your configuration."
            return 1
        fi
    fi
}

run_initial_setup() {
    log_info "Running initial database setup..."

    source "${VENV_DIR}/bin/activate"
    cd "${APP_DIR}/app/backend"

    # Load environment
    set -a
    source "${CONFIG_DIR}/env"
    set +a

    log_info "Running migrations..."
    sudo -u "$APP_USER" "${VENV_DIR}/bin/python" manage.py migrate --noinput

    log_info "Collecting static files..."
    sudo -u "$APP_USER" "${VENV_DIR}/bin/python" manage.py collectstatic --noinput

    log_info "Initial setup complete!"
}

create_admin_user() {
    log_info "Creating admin user..."

    source "${VENV_DIR}/bin/activate"
    cd "${APP_DIR}/app/backend"

    # Load environment
    set -a
    source "${CONFIG_DIR}/env"
    set +a

    echo ""
    echo "Please enter credentials for the admin user:"
    sudo -u "$APP_USER" "${VENV_DIR}/bin/python" manage.py createsuperuser
}

interactive_post_install() {
    echo ""
    echo "========================================"
    echo "  Post-Installation Setup"
    echo "========================================"
    echo ""

    # SSL Certificate setup
    echo "${YELLOW}=== SSL Certificates ===${NC}"
    echo ""
    echo "SSL certificates are required for HTTPS."
    echo "Location: /etc/pki/tls/certs/server.crt"
    echo "          /etc/pki/tls/private/server.key"
    echo ""

    prompt_choice "SSL certificate option:" "  1) Generate self-signed certificate (for testing)
  2) I'll add certificates manually later
  3) Use Let's Encrypt (requires public DNS)" "1" ssl_choice

    case "$ssl_choice" in
        1)
            log_info "Generating self-signed certificate..."
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout /etc/pki/tls/private/server.key \
                -out /etc/pki/tls/certs/server.crt \
                -subj "/CN=localhost/O=CISO Assistant/C=US" 2>/dev/null
            chmod 600 /etc/pki/tls/private/server.key
            log_info "Self-signed certificate created."
            log_warn "Replace with a proper certificate for production!"
            ;;
        3)
            if command -v certbot &> /dev/null; then
                prompt_value "Enter your domain name" "" CERTBOT_DOMAIN
                certbot --nginx -d "$CERTBOT_DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || {
                    log_error "Certbot failed. You may need to configure DNS first."
                    log_warn "Generating self-signed certificate as fallback..."
                    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                        -keyout /etc/pki/tls/private/server.key \
                        -out /etc/pki/tls/certs/server.crt \
                        -subj "/CN=localhost/O=CISO Assistant/C=US" 2>/dev/null
                }
            else
                log_warn "Certbot not installed. Installing..."
                dnf install -y certbot python3-certbot-nginx
                prompt_value "Enter your domain name" "" CERTBOT_DOMAIN
                certbot --nginx -d "$CERTBOT_DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || {
                    log_error "Certbot failed. Generating self-signed certificate..."
                    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                        -keyout /etc/pki/tls/private/server.key \
                        -out /etc/pki/tls/certs/server.crt \
                        -subj "/CN=localhost/O=CISO Assistant/C=US" 2>/dev/null
                }
            fi
            ;;
        *)
            log_warn "Remember to add SSL certificates before starting services!"
            # Create placeholder certificates so nginx can start
            if [[ ! -f /etc/pki/tls/certs/server.crt ]]; then
                openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
                    -keyout /etc/pki/tls/private/server.key \
                    -out /etc/pki/tls/certs/server.crt \
                    -subj "/CN=localhost/O=CISO Assistant/C=US" 2>/dev/null
            fi
            ;;
    esac

    # Test database connection
    echo ""
    echo "${YELLOW}=== Database Connection ===${NC}"
    echo ""
    prompt_yes_no "Test database connection now?" "y" do_test_db

    if [[ "$do_test_db" == "true" ]]; then
        if test_database_connection; then
            echo ""
            prompt_yes_no "Run database migrations now?" "y" do_migrate

            if [[ "$do_migrate" == "true" ]]; then
                run_initial_setup
            fi
        else
            echo ""
            log_warn "Please fix database configuration in ${CONFIG_DIR}/env"
            log_warn "Then run: sudo -u ${APP_USER} ${VENV_DIR}/bin/python ${APP_DIR}/app/backend/manage.py migrate"
        fi
    fi

    # Create admin user
    echo ""
    echo "${YELLOW}=== Admin User ===${NC}"
    echo ""
    prompt_yes_no "Create admin user now?" "y" do_create_admin

    if [[ "$do_create_admin" == "true" ]]; then
        create_admin_user
    fi

    # Install Celery extras if using SQS
    if grep -q "TASK_QUEUE_BACKEND=celery" "${CONFIG_DIR}/env" 2>/dev/null; then
        echo ""
        echo "${YELLOW}=== Installing Celery Dependencies ===${NC}"
        echo ""
        log_info "Installing Celery extras for SQS support..."
        source "${VENV_DIR}/bin/activate"
        cd "${APP_DIR}/app/backend"
        poetry install --extras celery || pip install "celery[sqs]" django-celery-results pycurl
        log_info "Celery dependencies installed."
    fi

    # Start services
    echo ""
    echo "${YELLOW}=== Start Services ===${NC}"
    echo ""
    prompt_yes_no "Start all services now?" "y" do_start_services

    if [[ "$do_start_services" == "true" ]]; then
        enable_services
        echo ""
        log_info "All services started!"

        # Show status
        echo ""
        echo "Service Status:"
        echo "---------------"
        systemctl is-active --quiet nginx && echo -e "  nginx:                    ${GREEN}running${NC}" || echo -e "  nginx:                    ${RED}stopped${NC}"
        systemctl is-active --quiet ciso-assistant-backend && echo -e "  ciso-assistant-backend:   ${GREEN}running${NC}" || echo -e "  ciso-assistant-backend:   ${RED}stopped${NC}"
        systemctl is-active --quiet ciso-assistant-frontend && echo -e "  ciso-assistant-frontend:  ${GREEN}running${NC}" || echo -e "  ciso-assistant-frontend:  ${RED}stopped${NC}"
        systemctl is-active --quiet ciso-assistant-worker && echo -e "  ciso-assistant-worker:    ${GREEN}running${NC}" || echo -e "  ciso-assistant-worker:    ${RED}stopped${NC}"
    fi
}

print_summary() {
    echo ""
    echo "========================================"
    echo "  CISO Assistant Deployment Complete!"
    echo "========================================"
    echo ""
    echo "Configuration file: ${CONFIG_DIR}/env"
    echo "Application directory: ${APP_DIR}"
    echo "Log directory: ${LOG_DIR}"
    echo ""
    echo "Management Console:"
    echo "  ${GREEN}sudo ciso-assistant${NC}         - Interactive management menu"
    echo ""
    echo "Quick Commands:"
    echo "  sudo ciso-assistant status   - Show service status"
    echo "  sudo ciso-assistant restart  - Restart all services"
    echo "  sudo ciso-assistant logs     - View logs"
    echo "  sudo ciso-assistant ssl      - Setup SSL certificates"
    echo "  sudo ciso-assistant admin    - Manage admin users"
    echo "  sudo ciso-assistant health   - Run health checks"
    echo ""
    echo "Helper Scripts (${APP_DIR}/scripts/):"
    echo "  setup-ssl.sh        - SSL certificate management"
    echo "  test-db.sh          - Database connection testing"
    echo "  run-migrations.sh   - Database migrations"
    echo "  create-admin.sh     - Admin user management"
    echo "  manage-services.sh  - Service management"
    echo ""
    echo "Access the application at: ${CONFIG_URL:-https://localhost}"
    echo ""
}

show_welcome() {
    if [[ "${INTERACTIVE:-true}" == "true" ]]; then
        clear
    fi
    echo ""
    echo "========================================"
    echo "  CISO Assistant Deployment Script"
    echo "  for RHEL 8 / EC2"
    echo "========================================"
    echo ""
    echo "This script will install and configure CISO Assistant with:"
    echo "  - PostgreSQL RDS (with optional IAM authentication)"
    echo "  - S3 for file storage (with IAM roles)"
    echo "  - Redis/ElastiCache or SQS for task queue"
    echo "  - Nginx reverse proxy with SSL"
    echo "  - Systemd services"
    echo ""
    echo "Prerequisites:"
    echo "  - RHEL 8 EC2 instance with IAM role attached"
    echo "  - RDS PostgreSQL instance"
    echo "  - S3 bucket (optional)"
    echo "  - ElastiCache Redis or SQS queue (optional)"
    echo ""

    if [[ "${INTERACTIVE:-true}" == "true" ]]; then
        read -p "Press Enter to continue or Ctrl+C to cancel..."
    fi
}

main() {
    show_welcome

    log_info "Starting CISO Assistant deployment on RHEL 8..."

    check_root
    check_rhel8

    # Phase 1: Install dependencies
    echo ""
    echo "${YELLOW}=== Phase 1: Installing System Dependencies ===${NC}"
    install_system_packages
    install_python
    install_nodejs

    # Phase 2: Setup application
    echo ""
    echo "${YELLOW}=== Phase 2: Setting Up Application ===${NC}"
    create_app_user
    create_directories
    clone_repository

    setup_backend
    setup_frontend

    # Phase 3: Interactive configuration
    echo ""
    echo "${YELLOW}=== Phase 3: Configuration ===${NC}"
    create_env_file

    # Phase 4: System configuration
    echo ""
    echo "${YELLOW}=== Phase 4: System Configuration ===${NC}"
    create_systemd_services
    configure_nginx
    configure_selinux
    configure_firewall
    create_update_script
    install_helper_scripts

    # Phase 5: Post-installation setup
    interactive_post_install

    # Final summary
    print_summary

    log_info "Deployment complete!"
}

# Parse command line arguments
INTERACTIVE=true
SKIP_CONFIG=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --non-interactive|-n)
            INTERACTIVE=false
            shift
            ;;
        --skip-config)
            SKIP_CONFIG=true
            shift
            ;;
        --help|-h)
            echo "CISO Assistant Deployment Script"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --non-interactive, -n   Run without interactive prompts (use defaults)"
            echo "  --skip-config           Skip configuration wizard (use existing env file)"
            echo "  --help, -h              Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Run main function
main
