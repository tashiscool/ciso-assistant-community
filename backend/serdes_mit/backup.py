"""
Backup Module - MIT Licensed

Clean-room implementation of backup functionality.
Copyright (c) 2026 Tash
"""

import io
import json
import zipfile
from datetime import datetime
from typing import Dict, List, Any, Optional, Type, BinaryIO, Set

from django.db import models
from django.apps import apps

from .utils import serialize_model_instance, SerdesEncoder


BACKUP_VERSION = "1.0.0"


class BackupWriter:
    """
    Writer for creating backup archives.

    Creates a ZIP archive containing:
    - manifest.json: Backup metadata
    - data.json: Serialized objects
    - attachments/: Binary attachments (optional)
    """

    def __init__(
        self,
        organization_id: Optional[str] = None,
        include_attachments: bool = True
    ):
        self.organization_id = organization_id
        self.include_attachments = include_attachments
        self.objects: List[Dict[str, Any]] = []
        self.attachments: List[Dict[str, Any]] = []
        self.errors: List[str] = []
        self.stats: Dict[str, int] = {}

    def add_model_instances(
        self,
        model_class: Type[models.Model],
        queryset: Optional[models.QuerySet] = None,
        exclude_fields: Optional[Set[str]] = None
    ):
        """
        Add model instances to the backup.

        Args:
            model_class: The Django model class
            queryset: Optional filtered queryset (defaults to all)
            exclude_fields: Fields to exclude from serialization
        """
        if queryset is None:
            queryset = model_class.objects.all()

        # Filter by organization if applicable
        if self.organization_id and hasattr(model_class, 'organization_id'):
            queryset = queryset.filter(organization_id=self.organization_id)

        model_name = f"{model_class._meta.app_label}.{model_class._meta.model_name}"
        count = 0

        for instance in queryset.iterator():
            try:
                obj_data = serialize_model_instance(
                    instance,
                    include_relations=True,
                    exclude_fields=exclude_fields
                )
                self.objects.append(obj_data)
                count += 1

                # Handle file attachments
                if self.include_attachments:
                    self._extract_attachments(instance, obj_data)

            except Exception as e:
                self.errors.append(f"Error serializing {model_name}:{instance.pk}: {e}")

        self.stats[model_name] = count

    def _extract_attachments(
        self,
        instance: models.Model,
        obj_data: Dict[str, Any]
    ):
        """Extract file field attachments from an instance."""
        for field in instance._meta.get_fields():
            if isinstance(field, models.FileField):
                file_field = getattr(instance, field.name, None)
                if file_field and file_field.name:
                    try:
                        self.attachments.append({
                            'model': obj_data['_model'],
                            'pk': obj_data['_pk'],
                            'field': field.name,
                            'filename': file_field.name,
                            'file': file_field,
                        })
                    except Exception:
                        pass

    def write(self, output: BinaryIO) -> Dict[str, Any]:
        """
        Write the backup to a file-like object.

        Args:
            output: Binary file-like object to write to

        Returns:
            Backup manifest dictionary
        """
        manifest = {
            'version': BACKUP_VERSION,
            'created_at': datetime.utcnow().isoformat(),
            'organization_id': self.organization_id,
            'object_count': len(self.objects),
            'attachment_count': len(self.attachments),
            'stats': self.stats,
            'errors': self.errors if self.errors else None,
        }

        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as zf:
            # Write manifest
            zf.writestr(
                'manifest.json',
                json.dumps(manifest, indent=2, cls=SerdesEncoder)
            )

            # Write data
            data = {
                'version': BACKUP_VERSION,
                'created_at': manifest['created_at'],
                'objects': self.objects,
            }
            zf.writestr(
                'data.json',
                json.dumps(data, indent=2, cls=SerdesEncoder)
            )

            # Write attachments
            if self.include_attachments:
                for attachment in self.attachments:
                    try:
                        file_obj = attachment['file']
                        if file_obj:
                            file_obj.seek(0)
                            path = f"attachments/{attachment['pk']}/{attachment['field']}/{attachment['filename'].split('/')[-1]}"
                            zf.writestr(path, file_obj.read())
                    except Exception as e:
                        self.errors.append(f"Error writing attachment: {e}")

        return manifest


def create_backup(
    organization_id: Optional[str] = None,
    model_classes: Optional[List[Type[models.Model]]] = None,
    include_attachments: bool = True,
    exclude_models: Optional[Set[str]] = None,
) -> BinaryIO:
    """
    Create a backup of the system.

    Args:
        organization_id: Optional organization to scope backup
        model_classes: Specific models to backup (defaults to all GRC models)
        include_attachments: Whether to include file attachments
        exclude_models: Set of model names to exclude

    Returns:
        Binary buffer containing the backup ZIP file
    """
    exclude_models = exclude_models or set()

    writer = BackupWriter(
        organization_id=organization_id,
        include_attachments=include_attachments
    )

    if model_classes is None:
        model_classes = _get_default_backup_models()

    for model_class in model_classes:
        model_name = f"{model_class._meta.app_label}.{model_class._meta.model_name}"
        if model_name not in exclude_models:
            writer.add_model_instances(model_class)

    output = io.BytesIO()
    writer.write(output)
    output.seek(0)

    return output


def _get_default_backup_models() -> List[Type[models.Model]]:
    """Get the default list of models to include in backups."""
    model_paths = [
        # Core models
        'core_mit.organization',
        'core_mit.project',
        'core_mit.domain',
        'core_mit.asset',
        'core_mit.assetcategory',
        'core_mit.riskassessment',
        'core_mit.riskscenario',
        'core_mit.threatactor',
        'core_mit.vulnerability',
        'core_mit.complianceassessment',
        'core_mit.requirement',
        'core_mit.requirementmapping',
        'core_mit.appliedcontrol',
        'core_mit.referencecontrol',
        'core_mit.evidence',
        'core_mit.policy',
        'core_mit.audit',
        'core_mit.finding',
        'core_mit.recommendation',
        # Library models
        'library_mit.storedlibrary',
        'library_mit.loadedlibrary',
        # EBIOS RM models
        'ebios_rm_mit.ebiosrmstudy',
        'ebios_rm_mit.fearedevent',
        'ebios_rm_mit.riskorigin',
        'ebios_rm_mit.targetobjective',
        'ebios_rm_mit.roto',
        'ebios_rm_mit.stakeholder',
        'ebios_rm_mit.strategicscenario',
        'ebios_rm_mit.attackpath',
        'ebios_rm_mit.operationalscenario',
        # TPRM models
        'tprm_mit.entity',
        'tprm_mit.representative',
        'tprm_mit.solution',
        'tprm_mit.contract',
        'tprm_mit.entityassessment',
        # CRQ models
        'crq_mit.quantitativeriskstudy',
        'crq_mit.quantitativeriskscenario',
        'crq_mit.quantitativeriskhypothesis',
    ]

    models_list = []
    for path in model_paths:
        try:
            app_label, model_name = path.rsplit('.', 1)
            model_class = apps.get_model(app_label, model_name)
            if model_class:
                models_list.append(model_class)
        except LookupError:
            pass

    return models_list


class IncrementalBackupWriter(BackupWriter):
    """
    Writer for creating incremental backups.

    Only includes objects modified since a given timestamp.
    """

    def __init__(
        self,
        organization_id: Optional[str] = None,
        since: Optional[datetime] = None,
        include_attachments: bool = True
    ):
        super().__init__(organization_id, include_attachments)
        self.since = since

    def add_model_instances(
        self,
        model_class: Type[models.Model],
        queryset: Optional[models.QuerySet] = None,
        exclude_fields: Optional[Set[str]] = None
    ):
        """Add only modified instances to the backup."""
        if queryset is None:
            queryset = model_class.objects.all()

        # Filter by modification time if available
        if self.since and hasattr(model_class, 'updated_at'):
            queryset = queryset.filter(updated_at__gte=self.since)
        elif self.since and hasattr(model_class, 'modified_at'):
            queryset = queryset.filter(modified_at__gte=self.since)

        super().add_model_instances(model_class, queryset, exclude_fields)
