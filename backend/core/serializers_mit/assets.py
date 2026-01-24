"""
Asset Serializers - MIT Licensed

Clean-room implementation of asset serializers.
Copyright (c) 2026 Tash
"""

from rest_framework import serializers
from ..models_mit import Asset, AssetCategory, AssetClassification, AssetRelationship
from .organization import DomainListSerializer


class AssetCategorySerializer(serializers.ModelSerializer):
    """Full serializer for AssetCategory model."""
    organization_name = serializers.CharField(
        source='organization.name',
        read_only=True
    )
    parent_name = serializers.CharField(
        source='parent.name',
        read_only=True,
        allow_null=True
    )
    asset_count = serializers.SerializerMethodField()

    class Meta:
        model = AssetCategory
        fields = [
            'id',
            'name',
            'description',
            'organization',
            'organization_name',
            'parent',
            'parent_name',
            'icon',
            'color',
            'asset_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_asset_count(self, obj):
        return obj.assets.count()


class AssetClassificationSerializer(serializers.ModelSerializer):
    """Full serializer for AssetClassification model."""
    organization_name = serializers.CharField(
        source='organization.name',
        read_only=True
    )

    class Meta:
        model = AssetClassification
        fields = [
            'id',
            'name',
            'description',
            'organization',
            'organization_name',
            'level',
            'handling_requirements',
            'color',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AssetSerializer(serializers.ModelSerializer):
    """Full serializer for Asset model."""
    organization_name = serializers.CharField(
        source='organization.name',
        read_only=True
    )
    category_name = serializers.CharField(
        source='category.name',
        read_only=True,
        allow_null=True
    )
    classification_name = serializers.CharField(
        source='classification.name',
        read_only=True,
        allow_null=True
    )
    classification_level = serializers.IntegerField(
        source='classification.level',
        read_only=True,
        allow_null=True
    )
    domains = DomainListSerializer(many=True, read_only=True)
    overall_sensitivity = serializers.IntegerField(read_only=True)
    dependent_count = serializers.SerializerMethodField()
    dependency_count = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        fields = [
            'id',
            'name',
            'description',
            'organization',
            'organization_name',
            'domains',
            'category',
            'category_name',
            'classification',
            'classification_name',
            'classification_level',
            'parent',
            'asset_type',
            'status',
            'asset_id',
            'serial_number',
            'location',
            'owner',
            'custodian',
            'business_criticality',
            'purchase_cost',
            'current_value',
            'replacement_cost',
            'acquisition_date',
            'end_of_life_date',
            'warranty_expiration',
            'last_inventory_date',
            'technical_details',
            'vendor',
            'vendor_contact',
            'support_contract',
            'confidentiality_requirement',
            'integrity_requirement',
            'availability_requirement',
            'overall_sensitivity',
            'dependent_count',
            'dependency_count',
            'tags',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_dependent_count(self, obj):
        return obj.dependents.count()

    def get_dependency_count(self, obj):
        return obj.depends_on.count()


class AssetListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for asset lists."""
    classification_name = serializers.CharField(
        source='classification.name',
        read_only=True,
        allow_null=True
    )

    class Meta:
        model = Asset
        fields = [
            'id',
            'name',
            'asset_id',
            'asset_type',
            'status',
            'business_criticality',
            'classification_name',
        ]


class AssetRelationshipSerializer(serializers.ModelSerializer):
    """Serializer for AssetRelationship model."""
    source_asset_name = serializers.CharField(
        source='source_asset.name',
        read_only=True
    )
    target_asset_name = serializers.CharField(
        source='target_asset.name',
        read_only=True
    )

    class Meta:
        model = AssetRelationship
        fields = [
            'id',
            'source_asset',
            'source_asset_name',
            'target_asset',
            'target_asset_name',
            'relationship_type',
            'description',
        ]
