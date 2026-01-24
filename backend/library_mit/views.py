"""
Library Views - MIT Licensed

Clean-room implementation of library API views.
Copyright (c) 2026 Tash
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from .models import StoredLibrary, LoadedLibrary
from .serializers import (
    StoredLibrarySerializer,
    StoredLibraryListSerializer,
    StoredLibraryUploadSerializer,
    StoredLibraryPreviewSerializer,
    LoadedLibrarySerializer,
    LoadedLibraryListSerializer,
    LibraryImportSerializer,
    LibraryDependencySerializer,
)
from .utils import (
    LibraryImporter,
    validate_library,
    preview_library,
    compute_content_hash,
    parse_library_file,
    validate_file_extension,
)


class IsAdminOrReadOnly(permissions.BasePermission):
    """Allow read-only for authenticated, write for admins."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_staff


class StoredLibraryViewSet(viewsets.ModelViewSet):
    """
    API endpoint for stored library management.

    Stored libraries are reference libraries containing frameworks,
    controls, threats, and other GRC objects.
    """
    queryset = StoredLibrary.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]
    parser_classes = [MultiPartParser, FormParser]

    def get_serializer_class(self):
        if self.action == 'list':
            return StoredLibraryListSerializer
        if self.action == 'upload':
            return StoredLibraryUploadSerializer
        return StoredLibrarySerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by object type
        object_type = self.request.query_params.get('object_type')
        if object_type:
            queryset = queryset.filter(object_type=object_type)

        # Filter by loaded status
        is_loaded = self.request.query_params.get('is_loaded')
        if is_loaded is not None:
            queryset = queryset.filter(is_loaded=is_loaded.lower() == 'true')

        # Filter by builtin status
        is_builtin = self.request.query_params.get('is_builtin')
        if is_builtin is not None:
            queryset = queryset.filter(is_builtin=is_builtin.lower() == 'true')

        # Filter by locale
        locale = self.request.query_params.get('locale')
        if locale:
            queryset = queryset.filter(locale=locale)

        # Filter by provider
        provider = self.request.query_params.get('provider')
        if provider:
            queryset = queryset.filter(provider__icontains=provider)

        # Exclude deprecated unless explicitly included
        include_deprecated = self.request.query_params.get('include_deprecated')
        if include_deprecated is None or include_deprecated.lower() != 'true':
            queryset = queryset.filter(is_deprecated=False)

        return queryset

    @action(detail=False, methods=['get'])
    def object_type_choices(self, request):
        """Get object type choices."""
        return Response([
            {'value': c[0], 'label': c[1]}
            for c in StoredLibrary.ObjectType.choices
        ])

    @action(detail=False, methods=['get'])
    def available_locales(self, request):
        """Get available library locales."""
        locales = StoredLibrary.objects.values_list('locale', flat=True).distinct()
        return Response(list(locales))

    @action(detail=False, methods=['post'])
    def upload(self, request):
        """Upload a new library file."""
        serializer = StoredLibraryUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        file = serializer.validated_data['file']

        try:
            # Parse file content
            content = parse_library_file(file.read(), file.name)

            # Validate library structure
            is_valid, errors = validate_library(content)
            if not is_valid:
                return Response(
                    {'errors': errors},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check if library already exists
            ref_id = content.get('ref_id')
            existing = StoredLibrary.objects.filter(ref_id=ref_id).first()

            if existing:
                # Update existing library
                existing.name = content.get('name', existing.name)
                existing.description = content.get('description', '')
                existing.version = content.get('version', existing.version)
                existing.provider = content.get('provider', '')
                existing.locale = content.get('locale', 'en')
                existing.content = content
                existing.dependencies = content.get('dependencies', [])
                existing.content_hash = compute_content_hash(content)
                existing.is_update = True
                existing.save()

                return Response(
                    StoredLibrarySerializer(existing).data,
                    status=status.HTTP_200_OK
                )

            # Determine object type
            object_type = self._detect_object_type(content)

            # Create new library
            library = StoredLibrary.objects.create(
                name=content.get('name', 'Unknown'),
                description=content.get('description', ''),
                ref_id=ref_id,
                version=content.get('version', '1.0'),
                provider=content.get('provider', ''),
                locale=content.get('locale', 'en'),
                object_type=object_type,
                content=content,
                dependencies=content.get('dependencies', []),
                content_hash=compute_content_hash(content),
            )

            return Response(
                StoredLibrarySerializer(library).data,
                status=status.HTTP_201_CREATED
            )

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    def _detect_object_type(self, content):
        """Detect the primary object type from library content."""
        type_keys = {
            'frameworks': StoredLibrary.ObjectType.FRAMEWORK,
            'risk_matrices': StoredLibrary.ObjectType.RISK_MATRIX,
            'threats': StoredLibrary.ObjectType.THREAT_CATALOG,
            'controls': StoredLibrary.ObjectType.CONTROL_CATALOG,
            'reference_controls': StoredLibrary.ObjectType.REFERENCE_CONTROLS,
        }

        found_types = []
        for key, obj_type in type_keys.items():
            if key in content and content[key]:
                found_types.append(obj_type)

        if len(found_types) == 0:
            return StoredLibrary.ObjectType.MIXED
        elif len(found_types) == 1:
            return found_types[0]
        else:
            return StoredLibrary.ObjectType.MIXED

    @action(detail=False, methods=['post'])
    def preview(self, request):
        """Preview a library file without importing."""
        serializer = StoredLibraryUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        file = serializer.validated_data['file']

        try:
            content = parse_library_file(file.read(), file.name)
            is_valid, errors = validate_library(content)
            preview_data = preview_library(content)

            preview_data['is_valid'] = is_valid
            preview_data['validation_errors'] = errors

            return Response(preview_data)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['get'])
    def dependencies(self, request, pk=None):
        """Get dependency information for a library."""
        library = self.get_object()

        dependencies = []
        for dep_ref_id in library.dependencies:
            dep = StoredLibrary.objects.filter(ref_id=dep_ref_id).first()
            if dep:
                dependencies.append({
                    'ref_id': dep_ref_id,
                    'name': dep.name,
                    'version': dep.version,
                    'is_available': True,
                    'is_loaded': dep.is_loaded,
                })
            else:
                dependencies.append({
                    'ref_id': dep_ref_id,
                    'name': dep_ref_id,
                    'version': '',
                    'is_available': False,
                    'is_loaded': False,
                })

        return Response(dependencies)

    @action(detail=True, methods=['get'])
    def content_summary(self, request, pk=None):
        """Get summary of library content."""
        library = self.get_object()
        return Response(preview_library(library.content))

    @action(detail=True, methods=['post'])
    def deprecate(self, request, pk=None):
        """Mark a library as deprecated."""
        library = self.get_object()
        library.is_deprecated = True
        library.save()
        return Response({'message': 'Library marked as deprecated'})


class LoadedLibraryViewSet(viewsets.ModelViewSet):
    """
    API endpoint for loaded library management.

    Loaded libraries are libraries that have been imported into
    an organization's workspace.
    """
    queryset = LoadedLibrary.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return LoadedLibraryListSerializer
        return LoadedLibrarySerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by organization
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)

        # Filter by import status
        import_status = self.request.query_params.get('import_status')
        if import_status:
            queryset = queryset.filter(import_status=import_status)

        # Only current by default
        include_old = self.request.query_params.get('include_old')
        if include_old is None or include_old.lower() != 'true':
            queryset = queryset.filter(is_current=True)

        return queryset

    @action(detail=False, methods=['post'])
    def import_library(self, request):
        """Import a stored library into an organization."""
        serializer = LibraryImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        stored_library_id = serializer.validated_data['stored_library_id']
        organization_id = serializer.validated_data['organization_id']

        try:
            stored_library = StoredLibrary.objects.get(id=stored_library_id)
        except StoredLibrary.DoesNotExist:
            return Response(
                {'error': 'Stored library not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check dependencies
        missing_deps = []
        for dep_ref_id in stored_library.dependencies:
            dep = StoredLibrary.objects.filter(ref_id=dep_ref_id).first()
            if not dep:
                missing_deps.append(dep_ref_id)

        if missing_deps:
            return Response(
                {'error': f'Missing dependencies: {", ".join(missing_deps)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Import the library
        importer = LibraryImporter(
            organization_id=str(organization_id),
            user=request.user
        )

        try:
            loaded = importer.import_library(stored_library)
            return Response(
                LoadedLibrarySerializer(loaded).data,
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            return Response(
                {'error': str(e), 'details': importer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def import_status_choices(self, request):
        """Get import status choices."""
        return Response([
            {'value': c[0], 'label': c[1]}
            for c in LoadedLibrary.ImportStatus.choices
        ])

    @action(detail=True, methods=['get'])
    def created_objects_summary(self, request, pk=None):
        """Get summary of objects created from this library."""
        loaded = self.get_object()

        summary = {
            'total': 0,
            'by_type': loaded.created_objects or {}
        }

        for obj_type, ids in summary['by_type'].items():
            if isinstance(ids, list):
                summary['total'] += len(ids)

        return Response(summary)

    @action(detail=True, methods=['post'])
    def unload(self, request, pk=None):
        """Unload a library from an organization."""
        loaded = self.get_object()

        # Mark as not current
        loaded.is_current = False
        loaded.save()

        # Update stored library
        stored = loaded.stored_library
        remaining = LoadedLibrary.objects.filter(
            stored_library=stored,
            is_current=True
        ).exclude(id=loaded.id).count()

        if remaining == 0:
            stored.is_loaded = False
            stored.save()

        return Response({'message': 'Library unloaded'})

    @action(detail=True, methods=['post'])
    def refresh(self, request, pk=None):
        """Refresh a loaded library with latest stored content."""
        loaded = self.get_object()

        importer = LibraryImporter(
            organization_id=str(loaded.organization_id),
            user=request.user
        )

        try:
            new_loaded = importer.import_library(loaded.stored_library)
            return Response(
                LoadedLibrarySerializer(new_loaded).data,
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': str(e), 'details': importer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
