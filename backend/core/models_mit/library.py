"""
Library Reference Models - MIT Licensed

Clean-room implementation of library reference entities for GRC.
Copyright (c) 2026 Tash
"""

from django.db import models
from ..base_models_mit import AbstractGRCEntity, OrderedModel
from .governance import Framework


class ReferenceControl(AbstractGRCEntity, OrderedModel):
    """
    A reference control from a library.

    Reference controls are standard controls from frameworks
    that can be mapped to applied controls.
    """
    framework = models.ForeignKey(
        Framework,
        on_delete=models.CASCADE,
        related_name='reference_controls'
    )

    # Control identification
    ref_id = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Reference ID from the library"
    )

    # Category
    class ControlCategory(models.TextChoices):
        TECHNICAL = 'technical', 'Technical'
        ORGANIZATIONAL = 'organizational', 'Organizational'
        POLICY = 'policy', 'Policy'
        PROCESS = 'process', 'Process'
        PHYSICAL = 'physical', 'Physical'

    category = models.CharField(
        max_length=20,
        choices=ControlCategory.choices,
        default=ControlCategory.TECHNICAL
    )

    # Control text
    typical_evidence = models.TextField(
        blank=True,
        default="",
        help_text="Typical evidence for this control"
    )

    # Annotations from library
    annotation = models.TextField(
        blank=True,
        default=""
    )

    # Provider/source
    provider = models.CharField(
        max_length=255,
        blank=True,
        default=""
    )

    class Meta:
        verbose_name = "Reference Control"
        verbose_name_plural = "Reference Controls"
        ordering = ['order', 'ref_id']
        unique_together = [['framework', 'ref_id']]

    def __str__(self):
        return f"{self.ref_id}: {self.name}"


class RequirementNode(AbstractGRCEntity, OrderedModel):
    """
    A requirement node in a framework.

    Requirement nodes form a hierarchical structure of
    requirements within a compliance framework.
    """
    framework = models.ForeignKey(
        Framework,
        on_delete=models.CASCADE,
        related_name='requirement_nodes'
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children'
    )

    # Node identification
    ref_id = models.CharField(
        max_length=100,
        db_index=True
    )
    level = models.PositiveSmallIntegerField(
        default=0,
        help_text="Depth level in the hierarchy"
    )

    # Node content
    implementation_groups = models.JSONField(
        default=list,
        blank=True,
        help_text="Implementation groups this node belongs to"
    )
    assessable = models.BooleanField(
        default=True,
        help_text="Whether this node can be assessed"
    )

    # Annotations
    annotation = models.TextField(
        blank=True,
        default=""
    )

    # Typical evidence
    typical_evidence = models.TextField(
        blank=True,
        default=""
    )

    # Reference controls
    reference_controls = models.ManyToManyField(
        ReferenceControl,
        blank=True,
        related_name='requirement_nodes'
    )

    # Threats addressed
    threats = models.JSONField(
        default=list,
        blank=True,
        help_text="Threat IDs addressed by this requirement"
    )

    class Meta:
        verbose_name = "Requirement Node"
        verbose_name_plural = "Requirement Nodes"
        ordering = ['order', 'ref_id']
        unique_together = [['framework', 'ref_id']]

    def __str__(self):
        return f"{self.ref_id}: {self.name}"

    def get_ancestors(self):
        """Get all ancestor nodes."""
        ancestors = []
        current = self.parent
        while current:
            ancestors.append(current)
            current = current.parent
        return ancestors

    def get_descendants(self):
        """Get all descendant nodes."""
        descendants = list(self.children.all())
        for child in self.children.all():
            descendants.extend(child.get_descendants())
        return descendants


class RequirementMappingSet(AbstractGRCEntity):
    """
    A mapping set between two frameworks.

    Mapping sets define relationships between requirements
    in different frameworks for crosswalks.
    """
    source_framework = models.ForeignKey(
        Framework,
        on_delete=models.CASCADE,
        related_name='source_mapping_sets'
    )
    target_framework = models.ForeignKey(
        Framework,
        on_delete=models.CASCADE,
        related_name='target_mapping_sets'
    )

    # Mapping version
    version = models.CharField(
        max_length=50,
        blank=True,
        default="1.0"
    )

    # Library reference
    library_ref_id = models.CharField(
        max_length=100,
        blank=True,
        default=""
    )

    class Meta:
        verbose_name = "Requirement Mapping Set"
        verbose_name_plural = "Requirement Mapping Sets"
        unique_together = [['source_framework', 'target_framework']]

    def __str__(self):
        return f"{self.source_framework.name} -> {self.target_framework.name}"


class RequirementMapping(models.Model):
    """
    A mapping between two requirements.

    Individual mapping entries within a mapping set.
    """
    import uuid
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    mapping_set = models.ForeignKey(
        RequirementMappingSet,
        on_delete=models.CASCADE,
        related_name='mappings'
    )
    source_requirement = models.ForeignKey(
        RequirementNode,
        on_delete=models.CASCADE,
        related_name='outgoing_mappings'
    )
    target_requirement = models.ForeignKey(
        RequirementNode,
        on_delete=models.CASCADE,
        related_name='incoming_mappings'
    )

    # Mapping relationship
    class MappingRelation(models.TextChoices):
        EQUAL = 'equal', 'Equal'
        SUPERSET = 'superset', 'Superset'
        SUBSET = 'subset', 'Subset'
        INTERSECT = 'intersect', 'Intersects'
        NOT_RELATED = 'not_related', 'Not Related'

    relation = models.CharField(
        max_length=15,
        choices=MappingRelation.choices,
        default=MappingRelation.EQUAL
    )

    # Strength/confidence
    strength = models.PositiveSmallIntegerField(
        default=100,
        help_text="Mapping confidence (0-100)"
    )

    # Rationale
    rationale = models.TextField(
        blank=True,
        default=""
    )

    class Meta:
        verbose_name = "Requirement Mapping"
        verbose_name_plural = "Requirement Mappings"
        unique_together = [['mapping_set', 'source_requirement', 'target_requirement']]

    def __str__(self):
        return f"{self.source_requirement.ref_id} -> {self.target_requirement.ref_id}"
