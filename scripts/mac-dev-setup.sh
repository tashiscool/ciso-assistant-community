#!/usr/bin/env bash
# mac-dev-setup.sh — One-shot setup and run script for CISO Assistant on macOS
# Usage: ./scripts/mac-dev-setup.sh [--run-only]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ── Check for Homebrew ──────────────────────────────────────────────
check_homebrew() {
    if ! command -v brew &>/dev/null; then
        error "Homebrew is required. Install it from https://brew.sh"
    fi
    info "Homebrew found"
}

# ── Install system dependencies via Homebrew ────────────────────────
install_system_deps() {
    local deps=(pango libxmlsec1 libxml2)
    local to_install=()

    for dep in "${deps[@]}"; do
        if ! brew list "$dep" &>/dev/null; then
            to_install+=("$dep")
        fi
    done

    if [ ${#to_install[@]} -gt 0 ]; then
        warn "Installing system dependencies: ${to_install[*]}"
        brew install "${to_install[@]}"
    fi
    info "System dependencies ready (pango, libxmlsec1, libxml2)"
}

# ── Check/install Python + Poetry ──────────────────────────────────
setup_python() {
    if ! command -v python3 &>/dev/null; then
        error "Python 3.11+ is required. Install via: brew install python@3.12"
    fi

    local py_version
    py_version=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    info "Python $py_version found"

    if ! command -v poetry &>/dev/null; then
        warn "Installing Poetry..."
        pip3 install poetry
    fi
    info "Poetry found"
}

# ── Check/install Node.js ──────────────────────────────────────────
setup_node() {
    if ! command -v node &>/dev/null; then
        error "Node.js 18+ is required. Install via: brew install node or nvm"
    fi
    info "Node.js $(node --version) found"
}

# ── Install backend dependencies ───────────────────────────────────
install_backend() {
    info "Installing backend dependencies..."
    cd "$BACKEND_DIR"

    poetry install
    info "Backend dependencies installed"
}

# ── Install frontend dependencies ──────────────────────────────────
install_frontend() {
    info "Installing frontend dependencies..."
    cd "$FRONTEND_DIR"
    npm install --legacy-peer-deps

    # Install known missing peer dependency
    npm install @internationalized/date --legacy-peer-deps 2>/dev/null || true
    info "Frontend dependencies installed"
}

# ── Run database migrations ────────────────────────────────────────
run_migrations() {
    info "Running database migrations (SQLite)..."
    cd "$BACKEND_DIR"
    DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib \
        poetry run python manage.py migrate
    info "Migrations complete"
}

# ── Create admin user ──────────────────────────────────────────────
create_admin() {
    cd "$BACKEND_DIR"
    local admin_exists
    admin_exists=$(DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib \
        poetry run python -c "
import django, os
os.environ['DJANGO_SETTINGS_MODULE']='ciso_assistant.settings'
django.setup()
from django.contrib.auth import get_user_model
print(get_user_model().objects.filter(email='admin@example.com').exists())
" 2>/dev/null)

    if [ "$admin_exists" = "False" ]; then
        DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib \
            poetry run python manage.py createsuperuser --noinput --email admin@example.com

        DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib \
            poetry run python -c "
import django, os
os.environ['DJANGO_SETTINGS_MODULE']='ciso_assistant.settings'
django.setup()
from django.contrib.auth import get_user_model
u = get_user_model().objects.get(email='admin@example.com')
u.set_password('admin')
u.save()
"
        info "Admin user created: admin@example.com / admin"
    else
        info "Admin user already exists: admin@example.com"
    fi
}

# ── Start services ─────────────────────────────────────────────────
start_services() {
    echo ""
    echo "============================================"
    echo "  Starting CISO Assistant"
    echo "============================================"
    echo ""

    # Kill any existing instances
    pkill -f "manage.py runserver" 2>/dev/null || true
    pkill -f "vite dev" 2>/dev/null || true
    sleep 1

    # Start backend
    cd "$BACKEND_DIR"
    DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib \
    ALLOWED_HOSTS="*" \
    CISO_ASSISTANT_URL=http://localhost:5173 \
    DJANGO_DEBUG=True \
        poetry run python manage.py runserver 0.0.0.0:8000 &
    BACKEND_PID=$!

    # Start frontend
    cd "$FRONTEND_DIR"
    PUBLIC_BACKEND_API_URL=http://localhost:8000/api \
    PUBLIC_BACKEND_API_EXPOSED_URL=http://localhost:8000/api \
        npm run dev &
    FRONTEND_PID=$!

    # Wait for backend to be ready
    echo ""
    warn "Waiting for backend to start..."
    for _ in $(seq 1 30); do
        if curl -sf http://localhost:8000/api/health/ &>/dev/null; then
            break
        fi
        sleep 2
    done

    # Wait for frontend to be ready
    warn "Waiting for frontend to start..."
    for _ in $(seq 1 20); do
        if curl -sf -o /dev/null http://localhost:5173/ 2>/dev/null; then
            break
        fi
        sleep 2
    done

    echo ""
    echo "============================================"
    info "CISO Assistant is running!"
    echo ""
    echo "  Frontend:  http://localhost:5173"
    echo "  Backend:   http://localhost:8000/api"
    echo "  Login:     admin@example.com / admin"
    echo ""
    echo "  Press Ctrl+C to stop all services"
    echo "============================================"

    # Trap Ctrl+C to clean up
    trap 'echo ""; warn "Shutting down..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0' INT TERM

    # Wait for either process to exit
    wait
}

# ── Main ───────────────────────────────────────────────────────────
main() {
    echo ""
    echo "============================================"
    echo "  CISO Assistant — macOS Dev Setup"
    echo "============================================"
    echo ""

    if [ "${1:-}" = "--run-only" ]; then
        start_services
        exit 0
    fi

    check_homebrew
    install_system_deps
    setup_python
    setup_node
    install_backend
    install_frontend
    run_migrations
    create_admin
    start_services
}

main "$@"
