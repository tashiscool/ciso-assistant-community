"""
Restore Module - MIT Licensed

Clean-room implementation of restore functionality.
Copyright (c) 2026 Tash
"""

import io
import json
import zipfile
from datetime import datetime
from typing import Dict, List, Any, Optional, Type, BinaryIO, Tuple

from django.db import models, transaction
from django.apps import apps
from django.core.files.base import ContentFile

from .utils import (
    deserialize_model_instance,
    resolve_dependencies,
    generate_id_mapping,
    validate_backup_data,
)


class BackupReader:
    """
    Reader for processing backup archives.

    Handles:
    - Reading and validating backup files
    - Resolving object dependencies
    - Creating objects in correct order
    - Handling ID remapping
    - Restoring file attachments
    """

    def __init__(
        self,
        preserve_ids: bool = False,
        skip_existing: bool = True,
        organization_id: Optional[str] = None
    ):
        self.preserve_ids = preserve_ids
        self.skip_existing = skip_existing
        self.organization_id = organization_id
        self.id_mapping: Dict[str, str] = {}
        self.errors: List[str] = []
        self.stats: Dict[str, Dict[str, int]] = {}
        self.manifest: Dict[str, Any] = {}
        self.attachments: Dict[str, bytes] = {}

    def read(self, input_file: BinaryIO) -> Tuple[bool, Dict[str, Any]]:
        """
        Read and parse a backup file.

        Args:
            input_file: Binary file-like object containing backup

        Returns:
            Tuple of (success, data_or_errors)
        """
        try:
            with zipfile.ZipFile(input_file, 'r') as zf:
                # Read manifest
                if 'manifest.json' in zf.namelist():
                    manifest_data = zf.read('manifest.json')
                    self.manifest = json.loads(manifest_data.decode('utf-8'))

                # Read data
                if 'data.json' not in zf.namelist():
                    return False, {'error': 'Missing data.json in backup'}

                data_content = zf.read('data.json')
                data = json.loads(data_content.decode('utf-8'))

                # Validate data
                is_valid, errors = validate_backup_data(data)
                if not is_valid:
                    return False, {'errors': errors}

                # Read attachments
                for name in zf.namelist():
                    if name.startswith('attachments/'):
                        self.attachments[name] = zf.read(name)

                return True, data

        except zipfile.BadZipFile:
            return False, {'error': 'Invalid ZIP file'}
        except json.JSONDecodeError as e:
            return False, {'error': f'Invalid JSON: {e}'}
        except Exception as e:
            return False, {'error': str(e)}

    def restore(
        self,
        data: Dict[str, Any],
        model_registry: Optional[Dict[str, Type[models.Model]]] = None
    ) -> Dict[str, Any]:
        """
        Restore objects from parsed backup data.

        Args:
            data: Parsed backup data
            model_registry: Optional mapping of model names to classes

        Returns:
            Restore result summary
        """
        if model_registry is None:
            model_registry = _build_model_registry()

        objects = data.get('objects', [])

        # Collect all IDs for mapping
        all_ids = [obj.get('_pk') for obj in objects if obj.get('_pk')]
        self.id_mapping = generate_id_mapping(all_ids, self.preserve_ids)

        # Resolve dependencies and order objects
        ordered_objects = resolve_dependencies(objects, model_registry)

        # Restore objects
        with transaction.atomic():
            for model_name, obj_data in ordered_objects:
                self._restore_object(model_name, obj_data, model_registry)

        return {
            'success': True,
            'stats': self.stats,
            'errors': self.errors if self.errors else None,
            'id_mapping': self.id_mapping if not self.preserve_ids else None,
        }

    def _restore_object(
        self,
        model_name: str,
        obj_data: Dict[str, Any],
        model_registry: Dict[str, Type[models.Model]]
    ):
        """Restore a single object."""
        model_class = model_registry.get(model_name)
        if not model_class:
            self.errors.append(f"Unknown model: {model_name}")
            return

        if model_name not in self.stats:
            self.stats[model_name] = {'created': 0, 'skipped': 0, 'errors': 0}

        old_pk = obj_data.get('_pk')
        new_pk = self.id_mapping.get(old_pk, old_pk)

        try:
            # Check if object exists
            if self.skip_existing:
                try:
                    existing = model_class.objects.get(pk=new_pk)
                    self.stats[model_name]['skipped'] += 1
                    return
                except model_class.DoesNotExist:
                    pass

            # Override organization if specified
            if self.organization_id and 'organization_id' in obj_data:
                obj_data['organization_id'] = self.organization_id

            # Create instance
            instance = deserialize_model_instance(
                model_class,
                obj_data,
                self.id_mapping
            )

            # Set the new primary key
            instance.pk = new_pk

            # Save the instance
            instance.save()

            # Handle M2M relations
            self._restore_m2m_relations(instance, obj_data, model_class)

            # Handle file attachments
            self._restore_attachments(instance, obj_data)

            self.stats[model_name]['created'] += 1

        except Exception as e:
            self.errors.append(f"Error restoring {model_name}:{old_pk}: {e}")
            self.stats[model_name]['errors'] += 1

    def _restore_m2m_relations(
        self,
        instance: models.Model,
        obj_data: Dict[str, Any],
        model_class: Type[models.Model]
    ):
        """Restore many-to-many relations."""
        for field in model_class._meta.get_fields():
            if isinstance(field, models.ManyToManyField):
                field_name = field.name
                if field_name in obj_data:
                    related_pks = obj_data[field_name]
                    if related_pks:
                        # Map old IDs to new IDs
                        mapped_pks = [
                            self.id_mapping.get(pk, pk)
                            for pk in related_pks
                        ]
                        try:
                            getattr(instance, field_name).set(mapped_pks)
                        except Exception:
                            pass

    def _restore_attachments(
        self,
        instance: models.Model,
        obj_data: Dict[str, Any]
    ):
        """Restore file attachments for an instance."""
        old_pk = obj_data.get('_pk')

        for field in instance._meta.get_fields():
            if isinstance(field, models.FileField):
                # Look for attachment in backup
                prefix = f"attachments/{old_pk}/{field.name}/"
                for path, content in self.attachments.items():
                    if path.startswith(prefix):
                        filename = path.split('/')[-1]
                        try:
                            file_field = getattr(instance, field.name)
                            file_field.save(filename, ContentFile(content), save=True)
                        except Exception:
                            pass


def restore_backup(
    input_file: BinaryIO,
    preserve_ids: bool = False,
    skip_existing: bool = True,
    organization_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Restore a backup file.

    Args:
        input_file: Binary file-like object containing backup
        preserve_ids: If True, use original IDs
        skip_existing: If True, skip objects that already exist
        organization_id: Optional organization to scope restore

    Returns:
        Restore result summary
    """
    reader = BackupReader(
        preserve_ids=preserve_ids,
        skip_existing=skip_existing,
        organization_id=organization_id
    )

    success, data = reader.read(input_file)
    if not success:
        return {'success': False, **data}

    return reader.restore(data)


def _build_model_registry() -> Dict[str, Type[models.Model]]:
    """Build a registry of all available models."""
    registry = {}

    # Add models from all installed apps
    for app_config in apps.get_app_configs():
        for model in app_config.get_models():
            key = f"{model._meta.app_label}.{model._meta.model_name}"
            registry[key] = model

    return registry


class SelectiveRestorer:
    """
    Restorer that allows selective object restoration.

    Provides preview and selection capabilities before
    actually restoring objects.
    """

    def __init__(self, input_file: BinaryIO):
        self.reader = BackupReader()
        success, data = self.reader.read(input_file)
        if not success:
            raise ValueError(f"Invalid backup: {data}")
        self.data = data
        self.selected_objects: List[Dict[str, Any]] = []

    def get_preview(self) -> Dict[str, Any]:
        """Get preview of backup contents."""
        objects = self.data.get('objects', [])

        # Group by model type
        by_model = {}
        for obj in objects:
            model_name = obj.get('_model', 'unknown')
            if model_name not in by_model:
                by_model[model_name] = []
            by_model[model_name].append({
                'pk': obj.get('_pk'),
                'name': obj.get('name', obj.get('title', obj.get('ref_id', 'Unnamed'))),
            })

        return {
            'manifest': self.reader.manifest,
            'object_count': len(objects),
            'by_model': {k: len(v) for k, v in by_model.items()},
            'objects_preview': {k: v[:10] for k, v in by_model.items()},  # First 10 of each
        }

    def select_by_model(self, model_names: List[str]):
        """Select objects to restore by model type."""
        objects = self.data.get('objects', [])
        self.selected_objects = [
            obj for obj in objects
            if obj.get('_model') in model_names
        ]

    def select_by_pk(self, pks: List[str]):
        """Select specific objects to restore by primary key."""
        objects = self.data.get('objects', [])
        pk_set = set(pks)
        self.selected_objects = [
            obj for obj in objects
            if obj.get('_pk') in pk_set
        ]

    def restore_selected(
        self,
        preserve_ids: bool = False,
        organization_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Restore only selected objects."""
        if not self.selected_objects:
            return {'success': False, 'error': 'No objects selected'}

        reader = BackupReader(
            preserve_ids=preserve_ids,
            skip_existing=True,
            organization_id=organization_id
        )
        reader.manifest = self.reader.manifest
        reader.attachments = self.reader.attachments

        data = {
            'version': self.data.get('version'),
            'created_at': self.data.get('created_at'),
            'objects': self.selected_objects,
        }

        return reader.restore(data)
