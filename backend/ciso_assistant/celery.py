"""
Celery configuration for CISO Assistant.

This module is used when TASK_QUEUE_BACKEND=celery is set.
Supports Redis (ElastiCache) and SQS as message brokers.

Usage:
    # Start worker
    celery -A ciso_assistant worker -l info

    # Start with SQS
    celery -A ciso_assistant worker -l info -Q ciso-assistant-tasks
"""

import os

from celery import Celery

# Set the default Django settings module
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ciso_assistant.settings")

app = Celery("ciso_assistant")

# Load task modules from all registered Django apps
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks in all installed apps
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task to test Celery is working."""
    print(f"Request: {self.request!r}")
