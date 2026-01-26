#!/bin/bash
#
# CISO Assistant - SSL Certificate Setup Script
#
# This script helps configure SSL certificates for CISO Assistant.
# Supports self-signed certificates, manual certificate installation,
# and Let's Encrypt automatic certificate generation.
#
# Usage:
#   sudo ./setup-ssl.sh [option]
#
# Options:
#   --self-signed    Generate a self-signed certificate
#   --letsencrypt    Use Let's Encrypt (requires public DNS)
#   --manual         Show instructions for manual certificate installation
#   --check          Check current certificate status
#   (no option)      Interactive mode
#

set -euo pipefail

# Configuration
CERT_PATH="/etc/pki/tls/certs/server.crt"
KEY_PATH="/etc/pki/tls/private/server.key"
CONFIG_DIR="/etc/ciso-assistant"

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

get_domain() {
    if [[ -f "${CONFIG_DIR}/env" ]]; then
        local url=$(grep "^CISO_ASSISTANT_URL=" "${CONFIG_DIR}/env" | cut -d'=' -f2 | tr -d '"' | tr -d "'")
        # Extract domain from URL
        echo "$url" | sed -E 's|^https?://||' | cut -d'/' -f1 | cut -d':' -f1
    else
        echo "localhost"
    fi
}

check_certificate() {
    echo ""
    echo "========================================"
    echo "  SSL Certificate Status"
    echo "========================================"
    echo ""

    if [[ -f "$CERT_PATH" ]]; then
        log_info "Certificate found at: $CERT_PATH"
        echo ""

        # Get certificate details
        echo "Certificate Details:"
        echo "-------------------"
        openssl x509 -in "$CERT_PATH" -noout -subject -issuer -dates 2>/dev/null || {
            log_error "Failed to read certificate"
            return 1
        }

        # Check expiration
        echo ""
        local expiry=$(openssl x509 -in "$CERT_PATH" -noout -enddate 2>/dev/null | cut -d'=' -f2)
        local expiry_epoch=$(date -d "$expiry" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$expiry" +%s 2>/dev/null)
        local now_epoch=$(date +%s)
        local days_left=$(( (expiry_epoch - now_epoch) / 86400 ))

        if [[ $days_left -lt 0 ]]; then
            log_error "Certificate has EXPIRED!"
        elif [[ $days_left -lt 30 ]]; then
            log_warn "Certificate expires in $days_left days"
        else
            log_info "Certificate expires in $days_left days"
        fi

        # Check if self-signed
        local subject=$(openssl x509 -in "$CERT_PATH" -noout -subject 2>/dev/null)
        local issuer=$(openssl x509 -in "$CERT_PATH" -noout -issuer 2>/dev/null)
        if [[ "$subject" == "$issuer" ]]; then
            echo ""
            log_warn "This is a self-signed certificate (not trusted by browsers)"
        fi
    else
        log_warn "No certificate found at: $CERT_PATH"
    fi

    if [[ -f "$KEY_PATH" ]]; then
        log_info "Private key found at: $KEY_PATH"
    else
        log_warn "No private key found at: $KEY_PATH"
    fi

    echo ""
}

generate_self_signed() {
    local domain="${1:-$(get_domain)}"
    local days="${2:-365}"

    echo ""
    echo "========================================"
    echo "  Generating Self-Signed Certificate"
    echo "========================================"
    echo ""

    log_info "Domain: $domain"
    log_info "Validity: $days days"
    echo ""

    # Create directories if they don't exist
    mkdir -p "$(dirname "$CERT_PATH")"
    mkdir -p "$(dirname "$KEY_PATH")"

    # Generate certificate
    openssl req -x509 -nodes -days "$days" -newkey rsa:2048 \
        -keyout "$KEY_PATH" \
        -out "$CERT_PATH" \
        -subj "/CN=$domain/O=CISO Assistant/C=US" \
        -addext "subjectAltName=DNS:$domain,DNS:localhost,IP:127.0.0.1"

    # Set permissions
    chmod 644 "$CERT_PATH"
    chmod 600 "$KEY_PATH"

    log_info "Self-signed certificate generated successfully!"
    log_warn "This certificate is for testing only. Use a proper certificate for production."
    echo ""

    # Restart nginx if running
    if systemctl is-active --quiet nginx; then
        log_info "Restarting nginx..."
        systemctl restart nginx
    fi
}

setup_letsencrypt() {
    local domain="${1:-}"

    echo ""
    echo "========================================"
    echo "  Let's Encrypt Certificate Setup"
    echo "========================================"
    echo ""

    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
        log_info "Installing certbot..."
        dnf install -y certbot python3-certbot-nginx || {
            log_error "Failed to install certbot"
            exit 1
        }
    fi

    # Get domain if not provided
    if [[ -z "$domain" ]]; then
        domain=$(get_domain)
        if [[ "$domain" == "localhost" ]]; then
            log_error "Let's Encrypt requires a public domain name"
            echo ""
            read -p "Enter your domain name: " domain
        fi
    fi

    log_info "Domain: $domain"
    echo ""

    # Check DNS resolution
    log_info "Checking DNS resolution..."
    if ! host "$domain" &>/dev/null; then
        log_warn "DNS lookup failed for $domain"
        log_warn "Make sure your domain points to this server's IP address"
        echo ""
        read -p "Continue anyway? (y/n) [n]: " continue_anyway
        if [[ ! "$continue_anyway" =~ ^[Yy] ]]; then
            exit 1
        fi
    fi

    # Get email for notifications
    local email=""
    if [[ -f "${CONFIG_DIR}/env" ]]; then
        email=$(grep "^CISO_ASSISTANT_SUPERUSER_EMAIL=" "${CONFIG_DIR}/env" | cut -d'=' -f2 | tr -d '"' | tr -d "'")
    fi

    if [[ -z "$email" ]]; then
        read -p "Enter email for certificate notifications: " email
    fi

    log_info "Running certbot..."
    echo ""

    # Run certbot
    certbot --nginx -d "$domain" \
        --non-interactive \
        --agree-tos \
        --email "$email" \
        --redirect || {
        log_error "Certbot failed. Please check the error above."
        log_warn "Common issues:"
        log_warn "  - Domain DNS not pointing to this server"
        log_warn "  - Port 80 not accessible from internet"
        log_warn "  - Firewall blocking incoming connections"
        exit 1
    }

    log_info "Let's Encrypt certificate installed successfully!"
    echo ""

    # Set up auto-renewal
    log_info "Setting up automatic renewal..."
    systemctl enable certbot-renew.timer 2>/dev/null || \
        echo "0 0,12 * * * root certbot renew --quiet" > /etc/cron.d/certbot-renew

    log_info "Certificates will auto-renew before expiration"
}

show_manual_instructions() {
    echo ""
    echo "========================================"
    echo "  Manual Certificate Installation"
    echo "========================================"
    echo ""
    echo "To install your own SSL certificates:"
    echo ""
    echo "1. Copy your certificate file to:"
    echo "   ${BLUE}$CERT_PATH${NC}"
    echo ""
    echo "2. Copy your private key to:"
    echo "   ${BLUE}$KEY_PATH${NC}"
    echo ""
    echo "3. If you have intermediate certificates, append them to server.crt:"
    echo "   ${BLUE}cat intermediate.crt >> $CERT_PATH${NC}"
    echo ""
    echo "4. Set correct permissions:"
    echo "   ${BLUE}chmod 644 $CERT_PATH${NC}"
    echo "   ${BLUE}chmod 600 $KEY_PATH${NC}"
    echo ""
    echo "5. Restart nginx:"
    echo "   ${BLUE}systemctl restart nginx${NC}"
    echo ""
    echo "Certificate requirements:"
    echo "  - Format: PEM (Base64 encoded)"
    echo "  - Key: RSA or ECDSA, unencrypted"
    echo "  - Chain: Include intermediate certificates if applicable"
    echo ""
}

interactive_mode() {
    echo ""
    echo "========================================"
    echo "  SSL Certificate Setup"
    echo "========================================"
    echo ""
    echo "Select an option:"
    echo ""
    echo "  1) Use Let's Encrypt (Recommended - free, auto-renewing)"
    echo "  2) Generate self-signed certificate (testing only)"
    echo "  3) Manual installation (show instructions)"
    echo "  4) Check current certificate status"
    echo "  5) Exit"
    echo ""
    read -p "Enter choice [1]: " choice
    choice="${choice:-1}"

    case "$choice" in
        1)
            local domain=$(get_domain)
            if [[ "$domain" != "localhost" ]]; then
                read -p "Domain name [$domain]: " input_domain
                domain="${input_domain:-$domain}"
            else
                read -p "Domain name: " domain
            fi
            setup_letsencrypt "$domain"
            ;;
        2)
            log_warn "Self-signed certificates are NOT recommended for production!"
            log_warn "Consider using Let's Encrypt instead (option 1)"
            echo ""
            read -p "Continue with self-signed? (y/n) [n]: " confirm
            if [[ ! "$confirm" =~ ^[Yy] ]]; then
                interactive_mode
                return
            fi

            local domain=$(get_domain)
            read -p "Domain name [$domain]: " input_domain
            domain="${input_domain:-$domain}"

            read -p "Certificate validity in days [365]: " days
            days="${days:-365}"

            generate_self_signed "$domain" "$days"
            ;;
        3)
            show_manual_instructions
            ;;
        4)
            check_certificate
            ;;
        5)
            exit 0
            ;;
        *)
            log_error "Invalid choice"
            exit 1
            ;;
    esac
}

show_help() {
    echo "CISO Assistant SSL Certificate Setup"
    echo ""
    echo "Usage: $0 [option]"
    echo ""
    echo "Options:"
    echo "  --self-signed [domain] [days]  Generate self-signed certificate"
    echo "  --letsencrypt [domain]         Use Let's Encrypt"
    echo "  --manual                       Show manual installation instructions"
    echo "  --check                        Check current certificate status"
    echo "  --help, -h                     Show this help"
    echo ""
    echo "Without options, runs in interactive mode."
}

# Main
check_root

case "${1:-}" in
    --self-signed)
        generate_self_signed "${2:-}" "${3:-365}"
        ;;
    --letsencrypt)
        setup_letsencrypt "${2:-}"
        ;;
    --manual)
        show_manual_instructions
        ;;
    --check)
        check_certificate
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
