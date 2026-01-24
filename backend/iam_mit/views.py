"""
IAM Views - MIT Licensed

Clean-room implementation of IAM API views.
Copyright (c) 2026 Tash
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q

from .models import (
    User,
    Role,
    Permission,
    RolePermission,
    UserRole,
    UserGroup,
    GroupMembership,
    AccessPolicy,
    APIKey,
    AuditLog,
)
from .serializers import (
    UserSerializer,
    UserListSerializer,
    UserProfileSerializer,
    RoleSerializer,
    RoleListSerializer,
    PermissionSerializer,
    PermissionListSerializer,
    UserRoleSerializer,
    UserGroupSerializer,
    GroupMembershipSerializer,
    AccessPolicySerializer,
    APIKeySerializer,
    APIKeyListSerializer,
    AuditLogSerializer,
    PasswordChangeSerializer,
)


class IsAdminOrReadOnly(permissions.BasePermission):
    """Allow read-only for authenticated, write for admins."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_staff


class IsOwnerOrAdmin(permissions.BasePermission):
    """Allow owners or admins to modify."""

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff:
            return True
        if hasattr(obj, 'user'):
            return obj.user == request.user
        return obj == request.user


class UserViewSet(viewsets.ModelViewSet):
    """
    API endpoint for user management.

    list: List all users (admin only)
    create: Create a new user (admin only)
    retrieve: Get user details
    update: Update user details
    delete: Deactivate user (soft delete)
    """
    queryset = User.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return UserListSerializer
        if self.action == 'me':
            return UserProfileSerializer
        return UserSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        # Filter by organization if not admin
        if not self.request.user.is_staff:
            org_id = self.request.user.primary_organization_id
            if org_id:
                queryset = queryset.filter(
                    Q(primary_organization_id=org_id) |
                    Q(user_roles__organization_id=org_id)
                ).distinct()
        return queryset

    def perform_destroy(self, instance):
        """Soft delete - deactivate instead of deleting."""
        instance.is_active = False
        instance.save()

    @action(detail=False, methods=['get', 'patch'])
    def me(self, request):
        """Get or update current user's profile."""
        if request.method == 'GET':
            serializer = UserProfileSerializer(request.user)
            return Response(serializer.data)

        serializer = UserProfileSerializer(
            request.user,
            data=request.data,
            partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def change_password(self, request):
        """Change current user's password."""
        serializer = PasswordChangeSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        request.user.set_password(serializer.validated_data['new_password'])
        request.user.password_changed_at = timezone.now()
        request.user.save()

        return Response({'message': 'Password changed successfully'})

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a deactivated user."""
        user = self.get_object()
        user.is_active = True
        user.locked_until = None
        user.failed_login_attempts = 0
        user.save()
        return Response({'message': 'User activated'})

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate a user."""
        user = self.get_object()
        user.is_active = False
        user.save()
        return Response({'message': 'User deactivated'})


class RoleViewSet(viewsets.ModelViewSet):
    """
    API endpoint for role management.
    """
    queryset = Role.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return RoleListSerializer
        return RoleSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            queryset = queryset.filter(
                Q(organization_id=org_id) | Q(organization_id__isnull=True)
            )
        return queryset.filter(is_active=True)

    def perform_destroy(self, instance):
        """Prevent deletion of system roles."""
        if instance.is_system:
            return Response(
                {'error': 'Cannot delete system role'},
                status=status.HTTP_400_BAD_REQUEST
            )
        instance.is_active = False
        instance.save()

    @action(detail=True, methods=['get'])
    def permissions(self, request, pk=None):
        """Get all permissions for a role (including inherited)."""
        role = self.get_object()
        permissions = role.get_all_permissions()
        serializer = PermissionListSerializer(permissions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_permission(self, request, pk=None):
        """Add a permission to a role."""
        role = self.get_object()
        permission_id = request.data.get('permission_id')

        if not permission_id:
            return Response(
                {'error': 'permission_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            permission = Permission.objects.get(id=permission_id)
        except Permission.DoesNotExist:
            return Response(
                {'error': 'Permission not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        RolePermission.objects.get_or_create(
            role=role,
            permission=permission,
            defaults={'granted_by_id': request.user.id}
        )
        return Response({'message': 'Permission added'})

    @action(detail=True, methods=['post'])
    def remove_permission(self, request, pk=None):
        """Remove a permission from a role."""
        role = self.get_object()
        permission_id = request.data.get('permission_id')

        RolePermission.objects.filter(
            role=role,
            permission_id=permission_id
        ).delete()
        return Response({'message': 'Permission removed'})


class PermissionViewSet(viewsets.ModelViewSet):
    """
    API endpoint for permission management.
    """
    queryset = Permission.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return PermissionListSerializer
        return PermissionSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        return queryset

    def perform_destroy(self, instance):
        """Prevent deletion of system permissions."""
        if instance.is_system:
            return Response(
                {'error': 'Cannot delete system permission'},
                status=status.HTTP_400_BAD_REQUEST
            )
        instance.delete()


class UserRoleViewSet(viewsets.ModelViewSet):
    """
    API endpoint for user role assignments.
    """
    queryset = UserRole.objects.all()
    serializer_class = UserRoleSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        role_id = self.request.query_params.get('role_id')
        if role_id:
            queryset = queryset.filter(role_id=role_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(assigned_by_id=self.request.user.id)


class UserGroupViewSet(viewsets.ModelViewSet):
    """
    API endpoint for user group management.
    """
    queryset = UserGroup.objects.all()
    serializer_class = UserGroupSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        return queryset.filter(is_active=True)

    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        """List all members of a group."""
        group = self.get_object()
        memberships = group.memberships.all()
        serializer = GroupMembershipSerializer(memberships, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_member(self, request, pk=None):
        """Add a member to a group."""
        group = self.get_object()
        user_id = request.data.get('user_id')
        membership_type = request.data.get('membership_type', 'member')

        if not user_id:
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        membership, created = GroupMembership.objects.get_or_create(
            user=user,
            group=group,
            defaults={
                'membership_type': membership_type,
                'added_by_id': request.user.id
            }
        )

        if not created:
            return Response(
                {'message': 'User is already a member'},
                status=status.HTTP_200_OK
            )

        return Response(
            {'message': 'Member added'},
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    def remove_member(self, request, pk=None):
        """Remove a member from a group."""
        group = self.get_object()
        user_id = request.data.get('user_id')

        GroupMembership.objects.filter(
            group=group,
            user_id=user_id
        ).delete()
        return Response({'message': 'Member removed'})


class AccessPolicyViewSet(viewsets.ModelViewSet):
    """
    API endpoint for access policy management.
    """
    queryset = AccessPolicy.objects.all()
    serializer_class = AccessPolicySerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            queryset = queryset.filter(
                Q(organization_id=org_id) | Q(organization_id__isnull=True)
            )
        return queryset.filter(is_active=True).order_by('-priority')


class APIKeyViewSet(viewsets.ModelViewSet):
    """
    API endpoint for API key management.
    """
    queryset = APIKey.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]

    def get_serializer_class(self):
        if self.action == 'list':
            return APIKeyListSerializer
        return APIKeySerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        # Non-admin users can only see their own keys
        if not self.request.user.is_staff:
            queryset = queryset.filter(user=self.request.user)
        return queryset.filter(is_active=True)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_destroy(self, instance):
        """Soft delete - deactivate instead of deleting."""
        instance.is_active = False
        instance.save()

    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        """Revoke an API key."""
        api_key = self.get_object()
        api_key.is_active = False
        api_key.save()
        return Response({'message': 'API key revoked'})


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for audit log viewing.

    Read-only - audit logs cannot be modified through the API.
    """
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by organization
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)

        # Filter by user
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)

        # Filter by category
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)

        # Filter by action
        action = self.request.query_params.get('action')
        if action:
            queryset = queryset.filter(action=action)

        # Filter by outcome
        outcome = self.request.query_params.get('outcome')
        if outcome:
            queryset = queryset.filter(outcome=outcome)

        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        if start_date:
            queryset = queryset.filter(timestamp__gte=start_date)

        end_date = self.request.query_params.get('end_date')
        if end_date:
            queryset = queryset.filter(timestamp__lte=end_date)

        return queryset

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get audit log summary statistics."""
        from django.db.models import Count
        from datetime import timedelta

        now = timezone.now()
        last_24h = now - timedelta(hours=24)
        last_7d = now - timedelta(days=7)

        queryset = self.get_queryset()

        summary = {
            'total_events': queryset.count(),
            'last_24h': queryset.filter(timestamp__gte=last_24h).count(),
            'last_7d': queryset.filter(timestamp__gte=last_7d).count(),
            'by_category': list(
                queryset.values('category')
                .annotate(count=Count('id'))
                .order_by('-count')
            ),
            'by_outcome': list(
                queryset.values('outcome')
                .annotate(count=Count('id'))
                .order_by('-count')
            ),
            'failed_logins_24h': queryset.filter(
                timestamp__gte=last_24h,
                action='login',
                outcome='failure'
            ).count(),
        }

        return Response(summary)
