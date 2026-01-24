"""
Security Edge Aggregate

Represents edges (relationships) in the security graph.
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from enum import Enum
from uuid import UUID
from datetime import datetime


class EdgeType(str, Enum):
    """Types of relationships in the security graph."""
    # Asset relationships
    DEPENDS_ON = 'depends_on'
    CONTAINS = 'contains'
    HOSTED_ON = 'hosted_on'
    CONNECTS_TO = 'connects_to'
    ACCESSES = 'accesses'

    # Control relationships
    MITIGATES = 'mitigates'
    PROTECTS = 'protects'
    IMPLEMENTS = 'implements'

    # Risk relationships
    THREATENS = 'threatens'
    EXPLOITS = 'exploits'
    AFFECTS = 'affects'

    # Data flow
    DATA_FLOWS_TO = 'data_flows_to'
    AUTHENTICATES_TO = 'authenticates_to'

    # Trust relationships
    TRUSTS = 'trusts'
    MANAGES = 'manages'
    OWNS = 'owns'

    # Generic
    RELATED_TO = 'related_to'


class EdgeDirection(str, Enum):
    """Edge direction types."""
    DIRECTED = 'directed'
    BIDIRECTIONAL = 'bidirectional'


@dataclass
class SecurityEdge:
    """
    Represents an edge (relationship) in the security graph.
    """
    id: UUID
    source_id: UUID
    target_id: UUID
    edge_type: EdgeType

    # Edge properties
    weight: float = 1.0
    direction: EdgeDirection = EdgeDirection.DIRECTED
    label: Optional[str] = None
    description: Optional[str] = None

    # Metadata
    metadata: Dict[str, Any] = field(default_factory=dict)

    # Risk propagation
    risk_propagation_factor: float = 0.5  # How much risk propagates along this edge

    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)

    def __post_init__(self):
        if isinstance(self.id, str):
            self.id = UUID(self.id)
        if isinstance(self.source_id, str):
            self.source_id = UUID(self.source_id)
        if isinstance(self.target_id, str):
            self.target_id = UUID(self.target_id)
        if isinstance(self.edge_type, str):
            self.edge_type = EdgeType(self.edge_type)
        if isinstance(self.direction, str):
            self.direction = EdgeDirection(self.direction)

    @property
    def is_risk_relationship(self) -> bool:
        """Check if this edge represents a risk relationship."""
        return self.edge_type in [
            EdgeType.THREATENS, EdgeType.EXPLOITS, EdgeType.AFFECTS
        ]

    @property
    def is_mitigation_relationship(self) -> bool:
        """Check if this edge represents a mitigation relationship."""
        return self.edge_type in [
            EdgeType.MITIGATES, EdgeType.PROTECTS, EdgeType.IMPLEMENTS
        ]

    @property
    def is_dependency(self) -> bool:
        """Check if this edge represents a dependency."""
        return self.edge_type in [
            EdgeType.DEPENDS_ON, EdgeType.HOSTED_ON, EdgeType.CONNECTS_TO
        ]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API response."""
        return {
            'id': str(self.id),
            'source_id': str(self.source_id),
            'target_id': str(self.target_id),
            'edge_type': self.edge_type.value,
            'weight': self.weight,
            'direction': self.direction.value,
            'label': self.label or self.edge_type.value.replace('_', ' ').title(),
            'description': self.description,
            'metadata': self.metadata,
            'risk_propagation_factor': self.risk_propagation_factor,
            'is_risk_relationship': self.is_risk_relationship,
            'is_mitigation_relationship': self.is_mitigation_relationship,
            'is_dependency': self.is_dependency,
        }

    def to_vis_edge(self) -> Dict[str, Any]:
        """Convert to visualization format for frontend."""
        # Color based on type
        type_colors = {
            EdgeType.DEPENDS_ON: '#9E9E9E',
            EdgeType.CONTAINS: '#607D8B',
            EdgeType.MITIGATES: '#4CAF50',
            EdgeType.PROTECTS: '#2196F3',
            EdgeType.THREATENS: '#F44336',
            EdgeType.EXPLOITS: '#FF5722',
            EdgeType.AFFECTS: '#FF9800',
            EdgeType.DATA_FLOWS_TO: '#00BCD4',
            EdgeType.CONNECTS_TO: '#3F51B5',
        }

        return {
            'id': str(self.id),
            'from': str(self.source_id),
            'to': str(self.target_id),
            'label': self.label or self.edge_type.value.replace('_', ' '),
            'color': type_colors.get(self.edge_type, '#9E9E9E'),
            'arrows': 'to' if self.direction == EdgeDirection.DIRECTED else 'to, from',
            'width': max(1, min(5, self.weight * 2)),
            'dashes': self.is_risk_relationship,
            'title': f"{self.edge_type.value}\nWeight: {self.weight:.2f}",
        }
