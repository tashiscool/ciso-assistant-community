"""
SecurityOperations Bounded Context

Manages security incidents and awareness programs.

Note: Import aggregates directly from their modules to avoid Django app registry issues.
"""

__all__ = [
    "SecurityIncident",
    "AwarenessProgram",
]


def __getattr__(name):
    """Lazy loading to avoid Django app registry issues during startup"""
    if name == "SecurityIncident":
        from .aggregates.security_incident import SecurityIncident
        return SecurityIncident
    elif name == "AwarenessProgram":
        from .aggregates.awareness_program import AwarenessProgram
        return AwarenessProgram
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

