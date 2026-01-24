"""
Serdes Utilities - MIT Licensed

Clean-room implementation of serialization utilities.
Copyright (c) 2026 Tash
"""

import uuid
import json
from datetime import datetime, date
from decimal import Decimal
from typing import Dict, List, Any, Optional, Type, Set, Tuple
from collections import defaultdict

from django.db import models
from django.db.models import Field
from django.db.models.fields.related import ForeignKey, ManyToManyField


class SerdesEncoder(json.JSONEncoder):
    """JSON encoder that handles Django model types."""

    def default(self, obj):
        if isinstance(obj, uuid.UUID):
            return str(obj)
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, bytes):
            return obj.decode('utf-8', errors='replace')
        if hasattr(obj, '__dict__'):
            return str(obj)
        return super().default(obj)


def serialize_model_instance(
    instance: models.Model,
    include_relations: bool = True,
    exclude_fields: Optional[Set[str]] = None
) -> Dict[str, Any]:
    """
    Serialize a Django model instance to a dictionary.

    Args:
        instance: The model instance to serialize
        include_relations: Whether to include related objects
        exclude_fields: Set of field names to exclude

    Returns:
        Dictionary representation of the instance
    """
    exclude_fields = exclude_fields or set()
    data = {
        '_model': f"{instance._meta.app_label}.{instance._meta.model_name}",
        '_pk': str(instance.pk),
    }

    for field in instance._meta.get_fields():
        field_name = field.name

        if field_name in exclude_fields:
            continue

        # Skip reverse relations unless explicitly included
        if field.is_relation and not hasattr(field, 'column'):
            if not include_relations:
                continue
            if isinstance(field, models.ManyToOneRel):
                continue
            if isinstance(field, models.ManyToManyRel):
                continue

        try:
            if isinstance(field, ManyToManyField):
                if include_relations:
                    related_pks = list(
                        getattr(instance, field_name).values_list('pk', flat=True)
                    )
                    data[field_name] = [str(pk) for pk in related_pks]
            elif isinstance(field, ForeignKey):
                fk_value = getattr(instance, f"{field_name}_id", None)
                data[field_name] = str(fk_value) if fk_value else None
            elif hasattr(field, 'value_from_object'):
                value = field.value_from_object(instance)
                data[field_name] = _serialize_value(value)
        except Exception:
            # Skip fields that can't be serialized
            pass

    return data


def _serialize_value(value: Any) -> Any:
    """Serialize a single value."""
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, bytes):
        return value.decode('utf-8', errors='replace')
    if isinstance(value, (list, tuple)):
        return [_serialize_value(v) for v in value]
    if isinstance(value, dict):
        return {k: _serialize_value(v) for k, v in value.items()}
    return value


def deserialize_model_instance(
    model_class: Type[models.Model],
    data: Dict[str, Any],
    id_mapping: Optional[Dict[str, str]] = None
) -> models.Model:
    """
    Deserialize a dictionary to a Django model instance.

    Args:
        model_class: The model class to instantiate
        data: Dictionary containing field values
        id_mapping: Mapping of old IDs to new IDs for FK resolution

    Returns:
        Model instance (not saved)
    """
    id_mapping = id_mapping or {}
    instance = model_class()

    for field in model_class._meta.get_fields():
        field_name = field.name

        if field_name not in data:
            continue

        value = data[field_name]

        try:
            if isinstance(field, ManyToManyField):
                # M2M fields handled separately after save
                continue
            elif isinstance(field, ForeignKey):
                if value:
                    # Check if we have a mapping for this ID
                    mapped_id = id_mapping.get(value, value)
                    setattr(instance, f"{field_name}_id", mapped_id)
            elif hasattr(field, 'to_python'):
                # Convert value to proper Python type
                if value is not None:
                    value = _deserialize_value(value, field)
                setattr(instance, field_name, value)
        except Exception:
            # Skip fields that can't be deserialized
            pass

    return instance


def _deserialize_value(value: Any, field: Field) -> Any:
    """Deserialize a value based on field type."""
    if value is None:
        return None

    field_type = field.get_internal_type()

    if field_type == 'UUIDField':
        return uuid.UUID(value) if isinstance(value, str) else value
    if field_type == 'DateTimeField':
        if isinstance(value, str):
            return datetime.fromisoformat(value.replace('Z', '+00:00'))
        return value
    if field_type == 'DateField':
        if isinstance(value, str):
            return date.fromisoformat(value)
        return value
    if field_type == 'DecimalField':
        return Decimal(str(value))
    if field_type in ('JSONField', 'ArrayField'):
        if isinstance(value, str):
            return json.loads(value)
        return value

    return value


def resolve_dependencies(
    objects: List[Dict[str, Any]],
    model_registry: Dict[str, Type[models.Model]]
) -> List[Tuple[str, Dict[str, Any]]]:
    """
    Resolve dependencies between objects for correct import order.

    Uses topological sort to order objects so that dependencies
    are imported before dependents.

    Args:
        objects: List of serialized object dictionaries
        model_registry: Mapping of model names to model classes

    Returns:
        Ordered list of (model_name, object_data) tuples
    """
    # Build dependency graph
    graph = defaultdict(set)
    obj_by_pk = {}

    for obj in objects:
        model_name = obj.get('_model', '')
        pk = obj.get('_pk', '')
        key = f"{model_name}:{pk}"
        obj_by_pk[key] = (model_name, obj)

        # Find FK dependencies
        model_class = model_registry.get(model_name)
        if model_class:
            for field in model_class._meta.get_fields():
                if isinstance(field, ForeignKey):
                    fk_value = obj.get(field.name)
                    if fk_value:
                        related_model = field.related_model
                        related_name = f"{related_model._meta.app_label}.{related_model._meta.model_name}"
                        dep_key = f"{related_name}:{fk_value}"
                        if dep_key in obj_by_pk:
                            graph[key].add(dep_key)

    # Topological sort using Kahn's algorithm
    in_degree = defaultdict(int)
    for node in obj_by_pk:
        if node not in in_degree:
            in_degree[node] = 0
        for dep in graph[node]:
            in_degree[dep] = in_degree.get(dep, 0)

    for node, deps in graph.items():
        for dep in deps:
            in_degree[node] += 1

    # Start with nodes that have no dependencies
    queue = [node for node in obj_by_pk if in_degree[node] == 0]
    result = []

    while queue:
        node = queue.pop(0)
        if node in obj_by_pk:
            result.append(obj_by_pk[node])

        # Reduce in-degree for dependent nodes
        for other in obj_by_pk:
            if node in graph[other]:
                in_degree[other] -= 1
                if in_degree[other] == 0 and other not in result:
                    queue.append(other)

    # Add any remaining nodes (cycles or orphans)
    for key, obj_data in obj_by_pk.items():
        if obj_data not in result:
            result.append(obj_data)

    return result


def get_model_dependencies(model_class: Type[models.Model]) -> List[Type[models.Model]]:
    """Get list of models this model depends on via ForeignKey."""
    deps = []
    for field in model_class._meta.get_fields():
        if isinstance(field, ForeignKey):
            related_model = field.related_model
            if related_model != model_class:  # Avoid self-reference
                deps.append(related_model)
    return deps


def compute_import_order(
    models_to_import: List[Type[models.Model]]
) -> List[Type[models.Model]]:
    """
    Compute the order in which models should be imported.

    Dependencies must be imported before dependents.
    """
    # Build dependency graph
    graph = {m: set(get_model_dependencies(m)) for m in models_to_import}

    # Filter to only include models in our import set
    model_set = set(models_to_import)
    for model in graph:
        graph[model] = graph[model] & model_set

    # Topological sort
    result = []
    visited = set()
    temp_mark = set()

    def visit(model):
        if model in temp_mark:
            # Cycle detected, skip
            return
        if model in visited:
            return
        temp_mark.add(model)
        for dep in graph.get(model, []):
            visit(dep)
        temp_mark.remove(model)
        visited.add(model)
        result.append(model)

    for model in models_to_import:
        visit(model)

    return result


def generate_id_mapping(
    old_ids: List[str],
    preserve_ids: bool = False
) -> Dict[str, str]:
    """
    Generate mapping from old IDs to new IDs.

    Args:
        old_ids: List of old UUIDs as strings
        preserve_ids: If True, keep original IDs

    Returns:
        Dictionary mapping old IDs to new IDs
    """
    if preserve_ids:
        return {id_: id_ for id_ in old_ids}

    return {id_: str(uuid.uuid4()) for id_ in old_ids}


def validate_backup_data(data: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """
    Validate backup data structure.

    Returns (is_valid, error_messages)
    """
    errors = []

    # Check required keys
    if 'version' not in data:
        errors.append("Missing 'version' field")
    if 'created_at' not in data:
        errors.append("Missing 'created_at' field")
    if 'objects' not in data:
        errors.append("Missing 'objects' field")

    # Check version compatibility
    version = data.get('version', '')
    if version and not version.startswith('1.'):
        errors.append(f"Unsupported backup version: {version}")

    # Check objects structure
    objects = data.get('objects', [])
    if not isinstance(objects, list):
        errors.append("'objects' must be a list")
    else:
        for i, obj in enumerate(objects):
            if not isinstance(obj, dict):
                errors.append(f"objects[{i}] must be a dictionary")
            elif '_model' not in obj:
                errors.append(f"objects[{i}] missing '_model' field")
            elif '_pk' not in obj:
                errors.append(f"objects[{i}] missing '_pk' field")

    return len(errors) == 0, errors
