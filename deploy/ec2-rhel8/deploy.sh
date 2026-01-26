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

create_env_file() {
    log_info "Creating environment configuration..."

    if [[ -f "${CONFIG_DIR}/env" ]]; then
        log_warn "Environment file already exists. Skipping..."
        return
    fi

    cat > "${CONFIG_DIR}/env" << 'EOF'
# CISO Assistant Configuration
# Edit this file with your settings

# Django Settings
DJANGO_SECRET_KEY=CHANGE_ME_GENERATE_A_SECURE_KEY
DJANGO_DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1

# Application URL (change to your domain)
CISO_ASSISTANT_URL=https://ciso.example.gov

# Database Configuration (RDS with IAM Auth)
POSTGRES_NAME=ciso_assistant
POSTGRES_USER=ciso_app
DB_HOST=your-rds-endpoint.us-gov-west-1.rds.amazonaws.com
DB_PORT=5432
RDS_IAM_AUTH=True
DB_SSL_MODE=require

# AWS Configuration
AWS_REGION=us-gov-west-1

# S3 Storage
USE_S3=True
AWS_AUTH_MODE=iam
AWS_STORAGE_BUCKET_NAME=your-bucket-name

# Task Queue Backend (huey or celery)
TASK_QUEUE_BACKEND=huey

# Redis/ElastiCache (optional - for caching and task queue)
# USE_REDIS=True
# REDIS_HOST=your-redis.cache.amazonaws.com
# REDIS_PORT=6379
# REDIS_SSL=True
# HUEY_WORKERS=4

# AWS SQS (alternative to Redis for task queue, requires TASK_QUEUE_BACKEND=celery)
# USE_SQS=True
# SQS_QUEUE_NAME=ciso-assistant-tasks
# CELERY_WORKERS=4

# Admin User
CISO_ASSISTANT_SUPERUSER_EMAIL=admin@example.gov

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json

# Connection Pool (for IAM auth, keep under 15 min)
CONN_MAX_AGE=840
EOF

    chmod 640 "${CONFIG_DIR}/env"
    chown root:$APP_USER "${CONFIG_DIR}/env"

    log_warn "Please edit ${CONFIG_DIR}/env with your configuration!"
    log_info "Environment file created"
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

print_summary() {
    echo ""
    echo "========================================"
    echo "  CISO Assistant Deployment Complete"
    echo "========================================"
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Edit the configuration file:"
    echo "   sudo vi ${CONFIG_DIR}/env"
    echo ""
    echo "2. Add your SSL certificates:"
    echo "   /etc/pki/tls/certs/server.crt"
    echo "   /etc/pki/tls/private/server.key"
    echo ""
    echo "3. Run database migrations:"
    echo "   sudo -u ${APP_USER} ${VENV_DIR}/bin/python ${APP_DIR}/app/backend/manage.py migrate"
    echo ""
    echo "4. Create superuser:"
    echo "   sudo -u ${APP_USER} ${VENV_DIR}/bin/python ${APP_DIR}/app/backend/manage.py createsuperuser"
    echo ""
    echo "5. Restart services:"
    echo "   sudo systemctl restart ciso-assistant-backend"
    echo "   sudo systemctl restart ciso-assistant-frontend"
    echo "   sudo systemctl restart ciso-assistant-worker"
    echo "   sudo systemctl restart nginx"
    echo ""
    echo "6. Test RDS IAM connection:"
    echo "   sudo -u ${APP_USER} ${VENV_DIR}/bin/python ${APP_DIR}/app/backend/manage.py test_rds_iam"
    echo ""
    echo "7. (Optional) For AWS SQS task queue:"
    echo "   - Install Celery extras: cd ${APP_DIR}/app/backend && poetry install --extras celery"
    echo "   - Set TASK_QUEUE_BACKEND=celery and USE_SQS=True in ${CONFIG_DIR}/env"
    echo "   - Restart worker: sudo systemctl restart ciso-assistant-worker"
    echo ""
    echo "Service status:"
    echo "   sudo systemctl status ciso-assistant-backend"
    echo "   sudo systemctl status ciso-assistant-frontend"
    echo "   sudo systemctl status ciso-assistant-worker"
    echo ""
    echo "Logs:"
    echo "   ${LOG_DIR}/"
    echo "   /var/log/nginx/"
    echo ""
    echo "Update script:"
    echo "   sudo ${APP_DIR}/update.sh"
    echo ""
}

main() {
    log_info "Starting CISO Assistant deployment on RHEL 8..."

    check_root
    check_rhel8

    install_system_packages
    install_python
    install_nodejs

    create_app_user
    create_directories
    clone_repository

    setup_backend
    setup_frontend
    create_env_file

    create_systemd_services
    configure_nginx
    configure_selinux
    configure_firewall

    create_update_script

    print_summary

    log_info "Deployment complete!"
}

# Run main function
main "$@"
