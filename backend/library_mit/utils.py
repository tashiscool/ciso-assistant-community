"""
Library Utilities - MIT Licensed

Library import, validation, and management utilities.
Copyright (c) 2026 Tash
"""

import hashlib
import json
from typing import Dict, List, Any, Optional, Tuple

from .models import StoredLibrary, LoadedLibrary


def validate_library(content: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """
    Validate library content structure.

    Returns (is_valid, error_messages).
    """
    errors = []

    # Check required fields
    required = ['name', 'ref_id', 'version']
    for field in required:
        if field not in content:
            errors.append(f"Missing required field: {field}")

    # Check ref_id format
    ref_id = content.get('ref_id', '')
    if ref_id and not ref_id.replace('-', '').replace('_', '').isalnum():
        errors.append("ref_id must be alphanumeric with hyphens/underscores only")

    # Check version format
    version = content.get('version', '')
    if version:
        parts = version.split('.')
        if not all(p.isdigit() for p in parts if p):
            errors.append("version must be in semver format (e.g., 1.0.0)")

    # Validate object arrays
    object_keys = ['frameworks', 'controls', 'threats', 'risk_matrices', 'reference_controls']
    for key in object_keys:
        if key in content:
            if not isinstance(content[key], list):
                errors.append(f"{key} must be an array")
            else:
                for i, item in enumerate(content[key]):
                    if not isinstance(item, dict):
                        errors.append(f"{key}[{i}] must be an object")
                    elif 'ref_id' not in item:
                        errors.append(f"{key}[{i}] missing ref_id")

    return len(errors) == 0, errors


def preview_library(content: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate a preview of library content.

    Returns summary information without importing.
    """
    preview = {
        'name': content.get('name', 'Unknown'),
        'ref_id': content.get('ref_id', ''),
        'version': content.get('version', ''),
        'description': content.get('description', ''),
        'provider': content.get('provider', ''),
        'locale': content.get('locale', 'en'),
        'object_counts': {},
        'dependencies': content.get('dependencies', []),
    }

    # Count objects
    for key in ['frameworks', 'controls', 'threats', 'risk_matrices', 'reference_controls']:
        if key in content:
            preview['object_counts'][key] = len(content[key])

    return preview


def compute_content_hash(content: Dict[str, Any]) -> str:
    """Compute SHA-256 hash of library content."""
    content_str = json.dumps(content, sort_keys=True)
    return hashlib.sha256(content_str.encode()).hexdigest()


class LibraryImporter:
    """
    Import libraries into the system.

    Handles validation, dependency resolution, and object creation.
    """

    def __init__(self, organization_id: str, user=None):
        self.organization_id = organization_id
        self.user = user
        self.errors = []
        self.created_objects = {}

    def import_library(self, stored_library: StoredLibrary) -> LoadedLibrary:
        """
        Import a stored library.

        Returns the LoadedLibrary instance.
        """
        # Check if already loaded
        existing = LoadedLibrary.objects.filter(
            stored_library=stored_library,
            organization_id=self.organization_id,
            is_current=True
        ).first()

        if existing:
            # Update existing
            return self._update_library(existing)

        # Create new loaded library
        loaded = LoadedLibrary.objects.create(
            stored_library=stored_library,
            organization_id=self.organization_id,
            loaded_version=stored_library.version,
            loaded_by=self.user,
            import_status='in_progress'
        )

        try:
            # Check dependencies
            self._check_dependencies(stored_library)

            # Import content
            self._import_content(stored_library.content)

            # Mark as completed
            loaded.import_status = 'completed'
            loaded.created_objects = self.created_objects
            loaded.save()

            # Update stored library
            stored_library.is_loaded = True
            stored_library.save()

        except Exception as e:
            loaded.import_status = 'failed'
            loaded.import_errors = self.errors + [str(e)]
            loaded.save()
            raise

        return loaded

    def _check_dependencies(self, library: StoredLibrary):
        """Check that all dependencies are satisfied."""
        for dep_ref_id in library.dependencies:
            dep = StoredLibrary.objects.filter(ref_id=dep_ref_id).first()
            if not dep:
                self.errors.append(f"Missing dependency: {dep_ref_id}")
            elif not dep.is_loaded:
                # Try to load dependency first
                self.import_library(dep)

    def _update_library(self, loaded: LoadedLibrary) -> LoadedLibrary:
        """Update an existing loaded library."""
        # Mark old as not current
        loaded.is_current = False
        loaded.save()

        # Create new version
        new_loaded = LoadedLibrary.objects.create(
            stored_library=loaded.stored_library,
            organization_id=self.organization_id,
            loaded_version=loaded.stored_library.version,
            loaded_by=self.user,
            import_status='in_progress'
        )

        try:
            self._import_content(loaded.stored_library.content)
            new_loaded.import_status = 'completed'
            new_loaded.created_objects = self.created_objects
            new_loaded.save()
        except Exception as e:
            new_loaded.import_status = 'failed'
            new_loaded.import_errors = self.errors + [str(e)]
            new_loaded.save()
            raise

        return new_loaded

    def _import_content(self, content: Dict[str, Any]):
        """Import library content objects."""
        # Import frameworks
        if 'frameworks' in content:
            self._import_frameworks(content['frameworks'])

        # Import controls
        if 'controls' in content:
            self._import_controls(content['controls'])

        # Import threats
        if 'threats' in content:
            self._import_threats(content['threats'])

        # Import risk matrices
        if 'risk_matrices' in content:
            self._import_risk_matrices(content['risk_matrices'])

    def _import_frameworks(self, frameworks: List[Dict]):
        """Import framework objects."""
        # In practice, this would create Framework model instances
        created_ids = []
        for fw in frameworks:
            # Create framework (placeholder)
            created_ids.append(fw.get('ref_id'))
        self.created_objects['frameworks'] = created_ids

    def _import_controls(self, controls: List[Dict]):
        """Import control objects."""
        created_ids = []
        for ctrl in controls:
            created_ids.append(ctrl.get('ref_id'))
        self.created_objects['controls'] = created_ids

    def _import_threats(self, threats: List[Dict]):
        """Import threat objects."""
        created_ids = []
        for threat in threats:
            created_ids.append(threat.get('ref_id'))
        self.created_objects['threats'] = created_ids

    def _import_risk_matrices(self, matrices: List[Dict]):
        """Import risk matrix objects."""
        created_ids = []
        for matrix in matrices:
            created_ids.append(matrix.get('ref_id'))
        self.created_objects['risk_matrices'] = created_ids


def validate_file_extension(filename: str) -> bool:
    """Validate library file extension."""
    valid_extensions = ['.json', '.yaml', '.yml']
    return any(filename.lower().endswith(ext) for ext in valid_extensions)


def parse_library_file(file_content: bytes, filename: str) -> Dict[str, Any]:
    """Parse library file content."""
    if filename.endswith('.json'):
        return json.loads(file_content.decode('utf-8'))
    elif filename.endswith(('.yaml', '.yml')):
        # Would need PyYAML for this
        raise NotImplementedError("YAML parsing not implemented")
    else:
        raise ValueError(f"Unsupported file format: {filename}")
