"""
IAM URL Configuration - MIT Licensed

Clean-room implementation of IAM URL routing.
Copyright (c) 2026 Tash
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet,
    RoleViewSet,
    PermissionViewSet,
    UserRoleViewSet,
    UserGroupViewSet,
    AccessPolicyViewSet,
    APIKeyViewSet,
    AuditLogViewSet,
)

app_name = 'iam_mit'

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'roles', RoleViewSet, basename='role')
router.register(r'permissions', PermissionViewSet, basename='permission')
router.register(r'user-roles', UserRoleViewSet, basename='user-role')
router.register(r'groups', UserGroupViewSet, basename='group')
router.register(r'access-policies', AccessPolicyViewSet, basename='access-policy')
router.register(r'api-keys', APIKeyViewSet, basename='api-key')
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')

urlpatterns = [
    path('', include(router.urls)),
]
