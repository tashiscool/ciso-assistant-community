#!/usr/bin/env bash
# Post-deploy hook for Elastic Beanstalk — runs after the app is deployed.
# Handles Django migrations, library loading, and optional superuser creation.
set -euo pipefail

# Activate the EB-managed virtual environment
# shellcheck disable=SC1090
source /var/app/venv/*/bin/activate
cd /var/app/current

export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-ciso_assistant.settings}"

echo "[postdeploy] Running Django migrations..."
python manage.py migrate --noinput --settings="${DJANGO_SETTINGS_MODULE}"

echo "[postdeploy] Loading/updating framework libraries..."
python manage.py storelibraries --settings="${DJANGO_SETTINGS_MODULE}"

if [ -n "${DJANGO_SUPERUSER_EMAIL:-}" ]; then
    echo "[postdeploy] Creating superuser (${DJANGO_SUPERUSER_EMAIL})..."
    python manage.py createsuperuser --noinput --settings="${DJANGO_SETTINGS_MODULE}" || true
fi

echo "[postdeploy] Done."
