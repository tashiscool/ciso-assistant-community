from django.apps import AppConfig


class ConnectorsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "connectors"
    verbose_name = "Security Tool Connectors"

    def ready(self):
        from .base.registry import discover_connectors

        discover_connectors()
