# MIT License - See LICENSE-MIT.txt in repository root
"""
Metrology Module (MIT Licensed)

Clean-room implementation of metrics and dashboards for GRC analytics.

Models:
    - MetricDefinition: Template for metric types
    - MetricInstance: Active metric tracking
    - MetricSample: Individual metric measurements
    - Dashboard: Dashboard configuration
    - DashboardWidget: Widget configuration
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models import (
        MetricDefinition,
        MetricInstance,
        MetricSample,
        BuiltinMetricSnapshot,
        Dashboard,
        DashboardWidget,
    )

__all__ = [
    "MetricDefinition",
    "MetricInstance",
    "MetricSample",
    "BuiltinMetricSnapshot",
    "Dashboard",
    "DashboardWidget",
]


def __getattr__(name: str):
    """Lazy import to allow testing without Django."""
    if name in __all__:
        from . import models
        return getattr(models, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
