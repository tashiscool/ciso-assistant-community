"""
Organization Serializers - MIT Licensed

Clean-room implementation of organization serializers.
Copyright (c) 2026 Tash
"""

from rest_framework import serializers
from ..models_mit import Organization, Domain, Perimeter, OrganizationalUnit


class OrganizationSerializer(serializers.ModelSerializer):
    """Full serializer for Organization model."""
    domain_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            'id',
            'name',
            'short_name',
            'description',
            'contact_email',
            'contact_phone',
            'website',
            'address_line1',
            'address_line2',
            'city',
            'state_province',
            'postal_code',
            'country',
            'industry',
            'employee_count',
            'is_active',
            'settings',
            'domain_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_domain_count(self, obj):
        return obj.domains.count()


class OrganizationListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for organization lists."""

    class Meta:
        model = Organization
        fields = ['id', 'name', 'short_name', 'is_active']


class DomainSerializer(serializers.ModelSerializer):
    """Full serializer for Domain model."""
    organization_name = serializers.CharField(
        source='organization.name',
        read_only=True
    )
    parent_name = serializers.CharField(
        source='parent.name',
        read_only=True,
        allow_null=True
    )
    children_count = serializers.SerializerMethodField()
    path = serializers.SerializerMethodField()

    class Meta:
        model = Domain
        fields = [
            'id',
            'name',
            'description',
            'organization',
            'organization_name',
            'parent',
            'parent_name',
            'owner',
            'color',
            'icon',
            'is_active',
            'children_count',
            'path',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_children_count(self, obj):
        return obj.children.count()

    def get_path(self, obj):
        """Get full path from root to this domain."""
        ancestors = obj.get_ancestors()
        path = [a.name for a in reversed(ancestors)]
        path.append(obj.name)
        return ' / '.join(path)


class DomainListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for domain lists."""

    class Meta:
        model = Domain
        fields = ['id', 'name', 'color', 'icon', 'is_active']


class PerimeterSerializer(serializers.ModelSerializer):
    """Full serializer for Perimeter model."""
    organization_name = serializers.CharField(
        source='organization.name',
        read_only=True
    )
    domains = DomainListSerializer(many=True, read_only=True)
    domain_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Domain.objects.all(),
        source='domains',
        write_only=True,
        required=False
    )

    class Meta:
        model = Perimeter
        fields = [
            'id',
            'name',
            'description',
            'organization',
            'organization_name',
            'domains',
            'domain_ids',
            'perimeter_type',
            'boundary_definition',
            'in_scope_for_compliance',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class OrganizationalUnitSerializer(serializers.ModelSerializer):
    """Full serializer for OrganizationalUnit model."""
    organization_name = serializers.CharField(
        source='organization.name',
        read_only=True
    )
    parent_name = serializers.CharField(
        source='parent.name',
        read_only=True,
        allow_null=True
    )

    class Meta:
        model = OrganizationalUnit
        fields = [
            'id',
            'name',
            'description',
            'organization',
            'organization_name',
            'parent',
            'parent_name',
            'unit_type',
            'manager',
            'contact_email',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
