#!/bin/bash
#
# CISO Assistant - FIPS Compliance Check Script
#
# Verifies FIPS 140-2/140-3 compliance status for the system.
# Checks Ubuntu Pro subscription, FIPS packages, and cryptographic modules.
#
# Usage:
#   sudo ./check-fips.sh [options]
#
# Options:
#   --verbose, -v    Show detailed output
#   --json           Output as JSON
#   --help, -h       Show help
#

set -euo pipefail

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
log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; }

# Results tracking
declare -A RESULTS

check_kernel_fips() {
    echo ""
    echo "=== Kernel FIPS Mode ==="
    echo ""

    if [[ -f /proc/sys/crypto/fips_enabled ]]; then
        local fips_enabled=$(cat /proc/sys/crypto/fips_enabled)
        if [[ "$fips_enabled" == "1" ]]; then
            log_pass "Kernel FIPS mode: ENABLED"
            RESULTS["kernel_fips"]="enabled"
        else
            log_fail "Kernel FIPS mode: DISABLED"
            RESULTS["kernel_fips"]="disabled"
        fi
    else
        log_fail "FIPS status file not found"
        RESULTS["kernel_fips"]="not_available"
    fi

    # Check kernel command line
    if [[ "$VERBOSE" == "true" ]]; then
        echo ""
        echo "Kernel command line:"
        cat /proc/cmdline | grep -o "fips=[^ ]*" || echo "  (no fips parameter)"
    fi
}

check_ubuntu_pro() {
    echo ""
    echo "=== Ubuntu Pro Status ==="
    echo ""

    if ! command -v pro &> /dev/null; then
        log_fail "Ubuntu Pro tools not installed"
        RESULTS["ubuntu_pro"]="not_installed"
        return
    fi

    # Check if attached
    if pro status --format json 2>/dev/null | grep -q '"attached": true'; then
        log_pass "Ubuntu Pro: Attached"
        RESULTS["ubuntu_pro"]="attached"

        # Check FIPS service status
        local fips_status=$(pro status --format json 2>/dev/null | grep -A5 '"name": "fips"' | grep '"status"' | head -1 | cut -d'"' -f4)
        local fips_updates_status=$(pro status --format json 2>/dev/null | grep -A5 '"name": "fips-updates"' | grep '"status"' | head -1 | cut -d'"' -f4)

        if [[ "$fips_status" == "enabled" ]] || [[ "$fips_updates_status" == "enabled" ]]; then
            log_pass "FIPS packages: Enabled"
            RESULTS["fips_packages"]="enabled"
        else
            log_warn "FIPS packages: Not enabled"
            RESULTS["fips_packages"]="disabled"
        fi

        if [[ "$VERBOSE" == "true" ]]; then
            echo ""
            echo "Ubuntu Pro services:"
            pro status 2>/dev/null | grep -E "(fips|esm|livepatch)" || true
        fi
    else
        log_warn "Ubuntu Pro: Not attached"
        RESULTS["ubuntu_pro"]="not_attached"
        RESULTS["fips_packages"]="not_available"
    fi
}

check_openssl_fips() {
    echo ""
    echo "=== OpenSSL FIPS ==="
    echo ""

    local openssl_version=$(openssl version 2>&1)
    echo "OpenSSL version: $openssl_version"

    # Check if FIPS provider is available
    if openssl list -providers 2>/dev/null | grep -qi fips; then
        log_pass "OpenSSL FIPS provider: Available"
        RESULTS["openssl_fips"]="available"
    elif echo "$openssl_version" | grep -qi fips; then
        log_pass "OpenSSL FIPS: Built with FIPS support"
        RESULTS["openssl_fips"]="built_in"
    else
        log_warn "OpenSSL FIPS provider: Not detected"
        RESULTS["openssl_fips"]="not_detected"
    fi

    if [[ "$VERBOSE" == "true" ]]; then
        echo ""
        echo "OpenSSL configuration:"
        openssl version -a 2>/dev/null | head -10
    fi
}

check_crypto_algorithms() {
    echo ""
    echo "=== FIPS-Approved Algorithms ==="
    echo ""

    if [[ ! -f /proc/crypto ]]; then
        log_warn "Crypto information not available"
        return
    fi

    # Count FIPS-approved algorithms
    local total=$(grep -c "^name" /proc/crypto 2>/dev/null || echo "0")
    local fips_approved=0

    # Common FIPS-approved algorithms
    local fips_algos=("aes" "sha256" "sha384" "sha512" "hmac" "gcm" "ccm" "ctr" "ecb" "cbc" "rsa" "ecdsa" "ecdh")

    echo "Checking FIPS-approved algorithms:"
    for algo in "${fips_algos[@]}"; do
        if grep -qi "name.*:.*${algo}" /proc/crypto 2>/dev/null; then
            echo -e "  $algo: ${GREEN}available${NC}"
            ((fips_approved++))
        else
            echo -e "  $algo: ${YELLOW}not found${NC}"
        fi
    done

    RESULTS["crypto_algorithms"]="${fips_approved}/${#fips_algos[@]}"

    if [[ "$VERBOSE" == "true" ]]; then
        echo ""
        echo "All available algorithms:"
        grep "^name" /proc/crypto | sort -u | head -30
        echo "..."
    fi
}

check_libssl() {
    echo ""
    echo "=== SSL/TLS Libraries ==="
    echo ""

    # Check libssl version
    local libssl=$(dpkg -l 2>/dev/null | grep -E "libssl[0-9]" | head -1)
    if [[ -n "$libssl" ]]; then
        echo "Installed: $libssl"
        if echo "$libssl" | grep -qi fips; then
            log_pass "libssl: FIPS version installed"
            RESULTS["libssl"]="fips"
        else
            log_warn "libssl: Standard version (may still support FIPS mode)"
            RESULTS["libssl"]="standard"
        fi
    fi

    # Check libgcrypt
    local libgcrypt=$(dpkg -l 2>/dev/null | grep libgcrypt | head -1)
    if [[ -n "$libgcrypt" ]]; then
        echo "Installed: $libgcrypt"
    fi
}

check_python_crypto() {
    echo ""
    echo "=== Python Cryptography ==="
    echo ""

    local venv_python="/opt/ciso-assistant/venv/bin/python"

    if [[ -f "$venv_python" ]]; then
        echo "Checking CISO Assistant Python environment..."

        # Check cryptography library
        local crypto_version=$("$venv_python" -c "import cryptography; print(cryptography.__version__)" 2>/dev/null || echo "not installed")
        echo "  cryptography: $crypto_version"

        # Check if using system OpenSSL
        local openssl_backend=$("$venv_python" -c "from cryptography.hazmat.backends.openssl import backend; print(backend.openssl_version_text())" 2>/dev/null || echo "unknown")
        echo "  OpenSSL backend: $openssl_backend"

        if echo "$openssl_backend" | grep -qi fips; then
            log_pass "Python cryptography: Using FIPS OpenSSL"
            RESULTS["python_crypto"]="fips"
        else
            log_warn "Python cryptography: OpenSSL backend (check FIPS mode)"
            RESULTS["python_crypto"]="standard"
        fi
    else
        log_warn "CISO Assistant not installed"
        RESULTS["python_crypto"]="not_installed"
    fi
}

check_nginx_ssl() {
    echo ""
    echo "=== Nginx SSL Configuration ==="
    echo ""

    if ! command -v nginx &> /dev/null; then
        log_warn "Nginx not installed"
        return
    fi

    # Check nginx SSL module
    local nginx_ssl=$(nginx -V 2>&1 | grep -o "with-openssl=[^ ]*" || echo "")
    if [[ -n "$nginx_ssl" ]]; then
        echo "Nginx compiled $nginx_ssl"
    fi

    # Check configured ciphers
    if [[ -f /etc/nginx/sites-available/ciso-assistant ]]; then
        echo ""
        echo "Configured SSL protocols and ciphers:"
        grep -E "(ssl_protocols|ssl_ciphers)" /etc/nginx/sites-available/ciso-assistant 2>/dev/null | sed 's/^/  /'

        # Check for FIPS-compliant ciphers
        if grep -q "TLSv1.2\|TLSv1.3" /etc/nginx/sites-available/ciso-assistant 2>/dev/null; then
            if ! grep -qE "RC4|DES|MD5|EXPORT" /etc/nginx/sites-available/ciso-assistant 2>/dev/null; then
                log_pass "Nginx SSL: FIPS-compliant cipher configuration"
                RESULTS["nginx_ssl"]="compliant"
            else
                log_warn "Nginx SSL: Non-FIPS ciphers detected"
                RESULTS["nginx_ssl"]="non_compliant"
            fi
        fi
    fi
}

print_summary() {
    echo ""
    echo "========================================"
    echo "  FIPS Compliance Summary"
    echo "========================================"
    echo ""

    local compliant=true

    # Check critical requirements
    if [[ "${RESULTS["kernel_fips"]:-}" != "enabled" ]]; then
        echo -e "Kernel FIPS:      ${RED}NOT COMPLIANT${NC}"
        compliant=false
    else
        echo -e "Kernel FIPS:      ${GREEN}COMPLIANT${NC}"
    fi

    if [[ "${RESULTS["ubuntu_pro"]:-}" != "attached" ]]; then
        echo -e "Ubuntu Pro:       ${YELLOW}NOT ATTACHED${NC}"
    else
        echo -e "Ubuntu Pro:       ${GREEN}ATTACHED${NC}"
    fi

    if [[ "${RESULTS["fips_packages"]:-}" == "enabled" ]]; then
        echo -e "FIPS Packages:    ${GREEN}ENABLED${NC}"
    else
        echo -e "FIPS Packages:    ${YELLOW}NOT ENABLED${NC}"
        compliant=false
    fi

    if [[ "${RESULTS["openssl_fips"]:-}" == "available" ]] || [[ "${RESULTS["openssl_fips"]:-}" == "built_in" ]]; then
        echo -e "OpenSSL FIPS:     ${GREEN}AVAILABLE${NC}"
    else
        echo -e "OpenSSL FIPS:     ${YELLOW}CHECK REQUIRED${NC}"
    fi

    echo ""
    echo "========================================"
    if [[ "$compliant" == "true" ]]; then
        echo -e "  ${GREEN}FIPS COMPLIANT${NC}"
    else
        echo -e "  ${RED}NOT FIPS COMPLIANT${NC}"
        echo ""
        echo "To enable FIPS compliance:"
        echo "  1. Attach Ubuntu Pro: sudo pro attach <token>"
        echo "  2. Enable FIPS: sudo pro enable fips-updates"
        echo "  3. Reboot the system"
    fi
    echo "========================================"
    echo ""
}

output_json() {
    echo "{"
    echo "  \"kernel_fips\": \"${RESULTS["kernel_fips"]:-unknown}\","
    echo "  \"ubuntu_pro\": \"${RESULTS["ubuntu_pro"]:-unknown}\","
    echo "  \"fips_packages\": \"${RESULTS["fips_packages"]:-unknown}\","
    echo "  \"openssl_fips\": \"${RESULTS["openssl_fips"]:-unknown}\","
    echo "  \"libssl\": \"${RESULTS["libssl"]:-unknown}\","
    echo "  \"python_crypto\": \"${RESULTS["python_crypto"]:-unknown}\","
    echo "  \"nginx_ssl\": \"${RESULTS["nginx_ssl"]:-unknown}\","
    echo "  \"crypto_algorithms\": \"${RESULTS["crypto_algorithms"]:-unknown}\""
    echo "}"
}

show_help() {
    echo "CISO Assistant FIPS Compliance Check"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --verbose, -v    Show detailed output"
    echo "  --json           Output results as JSON"
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

# Main
echo ""
echo "========================================"
echo "  FIPS Compliance Check"
echo "========================================"

check_kernel_fips
check_ubuntu_pro
check_openssl_fips
check_crypto_algorithms
check_libssl
check_python_crypto
check_nginx_ssl

if [[ "$JSON_OUTPUT" == "true" ]]; then
    output_json
else
    print_summary
fi
