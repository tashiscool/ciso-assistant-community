"""
IAM Serializers - MIT Licensed

Clean-room implementation of IAM serializers.
Copyright (c) 2026 Tash
"""

from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
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


class PermissionSerializer(serializers.ModelSerializer):
    """Serializer for Permission model."""

    class Meta:
        model = Permission
        fields = [
            'id',
            'codename',
            'name',
            'description',
            'category',
            'permission_type',
            'resource',
            'is_system',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class PermissionListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for permission lists."""

    class Meta:
        model = Permission
        fields = ['id', 'codename', 'name', 'category']


class RolePermissionSerializer(serializers.ModelSerializer):
    """Serializer for role-permission associations."""
    permission = PermissionListSerializer(read_only=True)
    permission_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = RolePermission
        fields = [
            'id',
            'permission',
            'permission_id',
            'constraints',
            'granted_at',
        ]
        read_only_fields = ['id', 'granted_at']


class RoleSerializer(serializers.ModelSerializer):
    """Serializer for Role model."""
    permissions = PermissionListSerializer(many=True, read_only=True)
    permission_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False
    )
    parent_name = serializers.CharField(source='parent.name', read_only=True)

    class Meta:
        model = Role
        fields = [
            'id',
            'name',
            'description',
            'organization_id',
            'role_type',
            'permissions',
            'permission_ids',
            'parent',
            'parent_name',
            'is_system',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'is_system', 'created_at', 'updated_at']

    def create(self, validated_data):
        permission_ids = validated_data.pop('permission_ids', [])
        role = Role.objects.create(**validated_data)
        if permission_ids:
            permissions = Permission.objects.filter(id__in=permission_ids)
            for perm in permissions:
                RolePermission.objects.create(role=role, permission=perm)
        return role

    def update(self, instance, validated_data):
        permission_ids = validated_data.pop('permission_ids', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if permission_ids is not None:
            # Clear existing and add new
            instance.role_permissions.all().delete()
            permissions = Permission.objects.filter(id__in=permission_ids)
            for perm in permissions:
                RolePermission.objects.create(role=instance, permission=perm)

        return instance


class RoleListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for role lists."""

    class Meta:
        model = Role
        fields = ['id', 'name', 'role_type', 'is_active']


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""
    full_name = serializers.CharField(read_only=True)
    password = serializers.CharField(
        write_only=True,
        required=False,
        validators=[validate_password]
    )

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'password',
            'first_name',
            'last_name',
            'display_name',
            'full_name',
            'job_title',
            'department',
            'phone',
            'avatar_url',
            'primary_organization_id',
            'is_active',
            'is_staff',
            'date_joined',
            'last_login',
            'mfa_enabled',
            'timezone',
            'locale',
            'preferences',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'date_joined',
            'last_login',
            'created_at',
            'updated_at',
        ]
        extra_kwargs = {
            'password': {'write_only': True},
            'mfa_secret': {'write_only': True},
        }

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User.objects.create(**validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class UserListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for user lists."""
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'is_active']


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for user profile (self-view)."""
    full_name = serializers.CharField(read_only=True)
    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'display_name',
            'full_name',
            'job_title',
            'department',
            'phone',
            'avatar_url',
            'primary_organization_id',
            'mfa_enabled',
            'timezone',
            'locale',
            'preferences',
            'roles',
        ]
        read_only_fields = ['id', 'email', 'roles']

    def get_roles(self, obj):
        """Get user's active roles."""
        user_roles = obj.user_roles.filter(is_active=True)
        return [
            {
                'id': str(ur.role.id),
                'name': ur.role.name,
                'organization_id': str(ur.organization_id) if ur.organization_id else None,
            }
            for ur in user_roles
            if ur.is_valid()
        ]


class UserRoleSerializer(serializers.ModelSerializer):
    """Serializer for user role assignments."""
    user = UserListSerializer(read_only=True)
    user_id = serializers.UUIDField(write_only=True)
    role = RoleListSerializer(read_only=True)
    role_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = UserRole
        fields = [
            'id',
            'user',
            'user_id',
            'role',
            'role_id',
            'organization_id',
            'domain_id',
            'valid_from',
            'valid_until',
            'assigned_at',
            'reason',
            'is_active',
        ]
        read_only_fields = ['id', 'assigned_at']


class UserGroupSerializer(serializers.ModelSerializer):
    """Serializer for UserGroup model."""
    member_count = serializers.SerializerMethodField()
    roles = RoleListSerializer(many=True, read_only=True)
    role_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False
    )

    class Meta:
        model = UserGroup
        fields = [
            'id',
            'name',
            'description',
            'organization_id',
            'member_count',
            'roles',
            'role_ids',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_member_count(self, obj):
        return obj.memberships.count()

    def create(self, validated_data):
        role_ids = validated_data.pop('role_ids', [])
        group = UserGroup.objects.create(**validated_data)
        if role_ids:
            roles = Role.objects.filter(id__in=role_ids)
            group.roles.set(roles)
        return group

    def update(self, instance, validated_data):
        role_ids = validated_data.pop('role_ids', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if role_ids is not None:
            roles = Role.objects.filter(id__in=role_ids)
            instance.roles.set(roles)
        return instance


class GroupMembershipSerializer(serializers.ModelSerializer):
    """Serializer for group memberships."""
    user = UserListSerializer(read_only=True)
    user_id = serializers.UUIDField(write_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)

    class Meta:
        model = GroupMembership
        fields = [
            'id',
            'user',
            'user_id',
            'group',
            'group_name',
            'membership_type',
            'joined_at',
        ]
        read_only_fields = ['id', 'joined_at']


class AccessPolicySerializer(serializers.ModelSerializer):
    """Serializer for AccessPolicy model."""

    class Meta:
        model = AccessPolicy
        fields = [
            'id',
            'name',
            'description',
            'organization_id',
            'rules',
            'effect',
            'priority',
            'resource_pattern',
            'action_pattern',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class APIKeySerializer(serializers.ModelSerializer):
    """Serializer for APIKey model."""
    key = serializers.CharField(read_only=True)  # Only returned on creation

    class Meta:
        model = APIKey
        fields = [
            'id',
            'name',
            'key_prefix',
            'key',
            'user',
            'organization_id',
            'expires_at',
            'last_used_at',
            'allowed_ips',
            'is_active',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'key_prefix',
            'key',
            'user',
            'last_used_at',
            'created_at',
        ]

    def create(self, validated_data):
        # Generate the key
        raw_key = APIKey.generate_key()
        validated_data['key_prefix'] = raw_key[:8]
        validated_data['key_hash'] = APIKey.hash_key(raw_key)
        validated_data['user'] = self.context['request'].user

        api_key = APIKey.objects.create(**validated_data)

        # Attach the raw key for the response (only shown once)
        api_key.key = raw_key
        return api_key


class APIKeyListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for API key lists."""

    class Meta:
        model = APIKey
        fields = [
            'id',
            'name',
            'key_prefix',
            'expires_at',
            'last_used_at',
            'is_active',
        ]


class AuditLogSerializer(serializers.ModelSerializer):
    """Serializer for AuditLog model (read-only)."""

    class Meta:
        model = AuditLog
        fields = [
            'id',
            'category',
            'action',
            'resource_type',
            'resource_id',
            'user_id',
            'user_email',
            'organization_id',
            'ip_address',
            'user_agent',
            'request_id',
            'outcome',
            'outcome_reason',
            'details',
            'timestamp',
        ]
        read_only_fields = fields


class PasswordChangeSerializer(serializers.Serializer):
    """Serializer for password change."""
    current_password = serializers.CharField(required=True)
    new_password = serializers.CharField(
        required=True,
        validators=[validate_password]
    )

    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect")
        return value


class LoginSerializer(serializers.Serializer):
    """Serializer for user login."""
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True)
    mfa_code = serializers.CharField(required=False, allow_blank=True)


class TokenSerializer(serializers.Serializer):
    """Serializer for authentication tokens."""
    access_token = serializers.CharField()
    refresh_token = serializers.CharField(required=False)
    token_type = serializers.CharField(default='Bearer')
    expires_in = serializers.IntegerField()
