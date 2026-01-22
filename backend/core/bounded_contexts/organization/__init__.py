"""
Organization Bounded Context

Manages organizational structure, users, groups, and responsibility assignments.

Note: Import aggregates directly from their modules to avoid Django app registry issues:
    from core.bounded_contexts.organization.aggregates.org_unit import OrgUnit
"""

__all__ = [
    "OrgUnit",
    "OrganizationUser",
    "Group",
    "ResponsibilityAssignment",
]


def __getattr__(name):
    """Lazy loading to avoid Django app registry issues during startup"""
    if name == "OrgUnit":
        from .aggregates.org_unit import OrgUnit
        return OrgUnit
    elif name == "OrganizationUser":
        from .aggregates.user import User
        return User
    elif name == "Group":
        from .aggregates.group import Group
        return Group
    elif name == "ResponsibilityAssignment":
        from .associations.responsibility_assignment import ResponsibilityAssignment
        return ResponsibilityAssignment
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

