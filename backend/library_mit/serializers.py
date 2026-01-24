"""
Library Serializers - MIT Licensed

Clean-room implementation of library serializers.
Copyright (c) 2026 Tash
"""

from rest_framework import serializers
from .models import StoredLibrary, LoadedLibrary


class StoredLibrarySerializer(serializers.ModelSerializer):
    """Full serializer for StoredLibrary."""

    object_counts = serializers.SerializerMethodField()

    class Meta:
        model = StoredLibrary
        fields = [
            'id', 'name', 'description', 'ref_id',
            'version', 'provider', 'locale',
            'object_type', 'content', 'dependencies',
            'is_loaded', 'is_builtin', 'is_update', 'is_deprecated',
            'content_hash', 'object_counts',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'content_hash']

    def get_object_counts(self, obj):
        return obj.get_object_count()


class StoredLibraryListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing stored libraries."""

    object_counts = serializers.SerializerMethodField()

    class Meta:
        model = StoredLibrary
        fields = [
            'id', 'name', 'ref_id', 'version',
            'provider', 'locale', 'object_type',
            'is_loaded', 'is_builtin', 'is_deprecated',
            'object_counts', 'created_at',
        ]

    def get_object_counts(self, obj):
        return obj.get_object_count()


class StoredLibraryUploadSerializer(serializers.Serializer):
    """Serializer for library file upload."""

    file = serializers.FileField()

    def validate_file(self, value):
        from .utils import validate_file_extension

        if not validate_file_extension(value.name):
            raise serializers.ValidationError(
                "Invalid file extension. Allowed: .json, .yaml, .yml"
            )

        # Check file size (max 50MB)
        if value.size > 50 * 1024 * 1024:
            raise serializers.ValidationError(
                "File too large. Maximum size is 50MB."
            )

        return value


class StoredLibraryPreviewSerializer(serializers.Serializer):
    """Serializer for library preview response."""

    name = serializers.CharField()
    ref_id = serializers.CharField()
    version = serializers.CharField()
    description = serializers.CharField(allow_blank=True)
    provider = serializers.CharField(allow_blank=True)
    locale = serializers.CharField()
    object_counts = serializers.DictField()
    dependencies = serializers.ListField(child=serializers.CharField())
    is_valid = serializers.BooleanField()
    validation_errors = serializers.ListField(child=serializers.CharField())


class LoadedLibrarySerializer(serializers.ModelSerializer):
    """Full serializer for LoadedLibrary."""

    library_name = serializers.CharField(source='stored_library.name', read_only=True)
    library_ref_id = serializers.CharField(source='stored_library.ref_id', read_only=True)
    loaded_by_name = serializers.CharField(source='loaded_by.get_full_name', read_only=True)

    class Meta:
        model = LoadedLibrary
        fields = [
            'id', 'stored_library', 'organization_id',
            'library_name', 'library_ref_id',
            'loaded_version', 'loaded_at', 'loaded_by', 'loaded_by_name',
            'import_status', 'import_errors',
            'created_objects', 'is_current',
        ]
        read_only_fields = [
            'id', 'loaded_at', 'import_status', 'import_errors',
            'created_objects', 'is_current',
        ]


class LoadedLibraryListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing loaded libraries."""

    library_name = serializers.CharField(source='stored_library.name', read_only=True)
    library_ref_id = serializers.CharField(source='stored_library.ref_id', read_only=True)

    class Meta:
        model = LoadedLibrary
        fields = [
            'id', 'stored_library', 'organization_id',
            'library_name', 'library_ref_id',
            'loaded_version', 'loaded_at',
            'import_status', 'is_current',
        ]


class LibraryImportSerializer(serializers.Serializer):
    """Serializer for library import request."""

    stored_library_id = serializers.UUIDField()
    organization_id = serializers.UUIDField()


class LibraryDependencySerializer(serializers.Serializer):
    """Serializer for library dependency information."""

    ref_id = serializers.CharField()
    name = serializers.CharField()
    version = serializers.CharField()
    is_available = serializers.BooleanField()
    is_loaded = serializers.BooleanField()
