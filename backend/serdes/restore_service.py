import json
from collections import defaultdict

import structlog
from django.apps import apps
from django.core.serializers import deserialize
from django.db import transaction

logger = structlog.get_logger(__name__)

EXCLUDED_MODELS = frozenset(
    {
        "contenttypes.contenttype",
        "auth.permission",
        "sessions.session",
        "iam.personalaccesstoken",
        "iam.ssosettings",
        "knox.authtoken",
        "auditlog.logentry",
    }
)

MAX_PASSES = 10


def _build_excluded_m2m_fields() -> dict[str, set[str]]:
    """Return a mapping of model_label -> set of M2M field names whose
    related model is in EXCLUDED_MODELS.

    E.g. ``{"iam.role": {"permissions"}}`` because Role.permissions points
    to ``auth.Permission`` which is excluded.
    """
    result: dict[str, set[str]] = {}
    for model in apps.get_models():
        label = f"{model._meta.app_label}.{model._meta.model_name}"
        for field in model._meta.many_to_many:
            related = field.related_model
            related_label = (
                f"{related._meta.app_label}.{related._meta.model_name}"
            )
            if related_label in EXCLUDED_MODELS:
                result.setdefault(label, set()).add(field.name)
    return result


def _strip_excluded_m2m(raw_objects: list[dict]) -> list[dict]:
    """Remove M2M field values that reference excluded models so that
    ``deserialize()`` doesn't try to resolve their natural keys.

    The stripped M2M data is stashed in a ``_stripped_m2m`` key so we can
    handle it manually after deserialization.
    """
    excluded_m2m = _build_excluded_m2m_fields()
    for obj in raw_objects:
        model_label = obj.get("model", "")
        fields_to_strip = excluded_m2m.get(model_label, set())
        if not fields_to_strip:
            continue
        stripped = {}
        for field_name in fields_to_strip:
            if field_name in obj.get("fields", {}):
                stripped[field_name] = obj["fields"].pop(field_name)
        if stripped:
            obj["_stripped_m2m"] = stripped
    return raw_objects


class UpsertRestoreService:
    """Restore a JSON backup using object-level upserts inside a single
    atomic transaction, avoiding the flush+loaddata pattern that destroys
    ContentType rows and causes FK IntegrityErrors."""

    def restore(self, json_data: str) -> dict:
        stats = {"created": 0, "updated": 0, "deleted": 0, "failed": 0}

        raw_objects = json.loads(json_data)

        # Filter out excluded models at the raw JSON level
        raw_objects = [
            obj for obj in raw_objects
            if obj.get("model", "") not in EXCLUDED_MODELS
        ]

        # Strip M2M fields that reference excluded models so deserialize()
        # doesn't choke resolving their natural keys
        raw_objects = _strip_excluded_m2m(raw_objects)

        # Stash stripped M2M data before deserializing (deserialize consumes
        # a fresh JSON string and ignores unknown keys)
        stripped_m2m_by_pk: dict[str, dict] = {}
        for obj in raw_objects:
            stripped = obj.pop("_stripped_m2m", None)
            if stripped:
                stripped_m2m_by_pk[f"{obj['model']}:{obj['pk']}"] = stripped

        deserialized = list(
            deserialize("json", json.dumps(raw_objects))
        )

        if not deserialized:
            return stats

        with transaction.atomic():
            saved_pks = self._upsert_objects(deserialized, stats)
            self._set_m2m(deserialized, stats)
            self._cleanup_stale(saved_pks, stats)

        return stats

    # ------------------------------------------------------------------
    # Phase 1 – multi-pass upsert
    # ------------------------------------------------------------------
    def _upsert_objects(self, objects, stats) -> dict[str, set]:
        """Save objects in multiple passes to resolve FK ordering.

        Returns a mapping of ``app_label.model`` -> set of saved PKs so the
        cleanup phase knows which rows to keep.
        """
        saved_pks: dict[str, set] = defaultdict(set)
        pending = list(objects)

        for pass_num in range(1, MAX_PASSES + 1):
            deferred = []
            progress = 0

            for obj in pending:
                label = self._model_label(obj)
                try:
                    sp = transaction.savepoint()
                    created = not obj.object.__class__.objects.filter(
                        pk=obj.object.pk
                    ).exists()
                    obj.object.save_base(raw=True)
                    transaction.savepoint_commit(sp)
                    saved_pks[label].add(obj.object.pk)
                    if created:
                        stats["created"] += 1
                    else:
                        stats["updated"] += 1
                    progress += 1
                except Exception:
                    transaction.savepoint_rollback(sp)
                    deferred.append(obj)

            logger.debug(
                "upsert pass",
                pass_num=pass_num,
                saved=progress,
                deferred=len(deferred),
            )

            if not deferred:
                break
            if progress == 0:
                # No progress – remaining objects have unresolvable issues
                for obj in deferred:
                    logger.warning(
                        "could not restore object",
                        model=self._model_label(obj),
                        pk=obj.object.pk,
                    )
                stats["failed"] += len(deferred)
                break
            pending = deferred

        return saved_pks

    # ------------------------------------------------------------------
    # Phase 2 – M2M relationships
    # ------------------------------------------------------------------
    def _set_m2m(self, objects, stats) -> None:
        for obj in objects:
            if not obj.m2m_data:
                continue
            label = self._model_label(obj)
            try:
                sp = transaction.savepoint()
                for accessor_name, m2m_values in obj.m2m_data.items():
                    getattr(obj.object, accessor_name).set(m2m_values)
                transaction.savepoint_commit(sp)
            except Exception as exc:
                transaction.savepoint_rollback(sp)
                logger.warning(
                    "m2m set failed",
                    model=label,
                    pk=obj.object.pk,
                    error=str(exc),
                )

    # ------------------------------------------------------------------
    # Phase 3 – delete rows not present in the backup
    # ------------------------------------------------------------------
    def _cleanup_stale(self, saved_pks: dict[str, set], stats) -> None:
        from django.db.models.deletion import ProtectedError

        for label, pks in saved_pks.items():
            app_label, model_name = label.split(".")
            try:
                model = apps.get_model(app_label, model_name)
            except LookupError:
                continue
            stale_qs = model.objects.exclude(pk__in=pks)
            try:
                deleted_count, _ = stale_qs.delete()
            except ProtectedError:
                # Some stale objects are protected by FK constraints;
                # delete individually, skipping protected ones.
                deleted_count = 0
                for obj in stale_qs.iterator():
                    try:
                        sp = transaction.savepoint()
                        obj.delete()
                        transaction.savepoint_commit(sp)
                        deleted_count += 1
                    except (ProtectedError, Exception):
                        transaction.savepoint_rollback(sp)
            stats["deleted"] += deleted_count
            if deleted_count:
                logger.info(
                    "cleaned up stale objects",
                    model=label,
                    deleted=deleted_count,
                )

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _model_label(obj) -> str:
        meta = obj.object._meta
        return f"{meta.app_label}.{meta.model_name}"
