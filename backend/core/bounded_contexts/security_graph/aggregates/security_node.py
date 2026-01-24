"""
Security Node Aggregate

Represents nodes in the security graph (assets, controls, risks, etc.)
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Set
from enum import Enum
from uuid import UUID, uuid4
from datetime import datetime


class NodeType(str, Enum):
    """Types of nodes in the security graph."""
    ASSET = 'asset'
    CONTROL = 'control'
    RISK = 'risk'
    THREAT = 'threat'
    VULNERABILITY = 'vulnerability'
    USER = 'user'
    SYSTEM = 'system'
    DATA = 'data'
    NETWORK = 'network'
    APPLICATION = 'application'
    PROCESS = 'process'
    THIRD_PARTY = 'third_party'


class NodeCriticality(str, Enum):
    """Criticality levels for nodes."""
    CRITICAL = 'critical'
    HIGH = 'high'
    MEDIUM = 'medium'
    LOW = 'low'
    INFORMATIONAL = 'informational'


@dataclass
class SecurityNode:
    """
    Represents a node in the security graph.

    Nodes can be assets, controls, risks, threats, or other security entities.
    """
    id: UUID
    name: str
    node_type: NodeType
    criticality: NodeCriticality = NodeCriticality.MEDIUM

    # Source entity reference
    source_type: Optional[str] = None  # e.g., 'Asset', 'AppliedControl'
    source_id: Optional[UUID] = None

    # Node attributes
    description: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    # Graph metrics (computed)
    in_degree: int = 0
    out_degree: int = 0
    betweenness_centrality: float = 0.0
    pagerank: float = 0.0

    # Risk metrics
    inherent_risk_score: float = 0.0
    residual_risk_score: float = 0.0
    blast_radius_score: float = 0.0

    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def __post_init__(self):
        if isinstance(self.id, str):
            self.id = UUID(self.id)
        if isinstance(self.node_type, str):
            self.node_type = NodeType(self.node_type)
        if isinstance(self.criticality, str):
            self.criticality = NodeCriticality(self.criticality)

    @property
    def degree(self) -> int:
        """Total degree (in + out)."""
        return self.in_degree + self.out_degree

    @property
    def is_critical(self) -> bool:
        """Check if node is critical."""
        return self.criticality in [NodeCriticality.CRITICAL, NodeCriticality.HIGH]

    @property
    def is_hub(self) -> bool:
        """Check if node is a hub (high connectivity)."""
        return self.degree > 10 or self.betweenness_centrality > 0.1

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API response."""
        return {
            'id': str(self.id),
            'name': self.name,
            'node_type': self.node_type.value,
            'criticality': self.criticality.value,
            'source_type': self.source_type,
            'source_id': str(self.source_id) if self.source_id else None,
            'description': self.description,
            'tags': self.tags,
            'metadata': self.metadata,
            'metrics': {
                'in_degree': self.in_degree,
                'out_degree': self.out_degree,
                'degree': self.degree,
                'betweenness_centrality': self.betweenness_centrality,
                'pagerank': self.pagerank,
            },
            'risk': {
                'inherent_risk_score': self.inherent_risk_score,
                'residual_risk_score': self.residual_risk_score,
                'blast_radius_score': self.blast_radius_score,
            },
            'is_critical': self.is_critical,
            'is_hub': self.is_hub,
        }

    def to_vis_node(self) -> Dict[str, Any]:
        """Convert to visualization format for frontend."""
        # Color based on type
        type_colors = {
            NodeType.ASSET: '#4CAF50',
            NodeType.CONTROL: '#2196F3',
            NodeType.RISK: '#F44336',
            NodeType.THREAT: '#FF9800',
            NodeType.VULNERABILITY: '#9C27B0',
            NodeType.USER: '#00BCD4',
            NodeType.SYSTEM: '#607D8B',
            NodeType.DATA: '#3F51B5',
            NodeType.NETWORK: '#009688',
            NodeType.APPLICATION: '#673AB7',
            NodeType.PROCESS: '#795548',
            NodeType.THIRD_PARTY: '#FF5722',
        }

        # Size based on criticality
        criticality_sizes = {
            NodeCriticality.CRITICAL: 30,
            NodeCriticality.HIGH: 25,
            NodeCriticality.MEDIUM: 20,
            NodeCriticality.LOW: 15,
            NodeCriticality.INFORMATIONAL: 10,
        }

        return {
            'id': str(self.id),
            'label': self.name,
            'group': self.node_type.value,
            'color': type_colors.get(self.node_type, '#9E9E9E'),
            'size': criticality_sizes.get(self.criticality, 20),
            'title': f"{self.name}\nType: {self.node_type.value}\nCriticality: {self.criticality.value}",
            'criticality': self.criticality.value,
            'risk_score': self.blast_radius_score,
        }

    @classmethod
    def from_asset(cls, asset) -> 'SecurityNode':
        """Create a SecurityNode from an Asset model instance."""
        criticality_map = {
            'critical': NodeCriticality.CRITICAL,
            'high': NodeCriticality.HIGH,
            'medium': NodeCriticality.MEDIUM,
            'low': NodeCriticality.LOW,
        }

        return cls(
            id=asset.id,
            name=asset.name,
            node_type=NodeType.ASSET,
            criticality=criticality_map.get(
                getattr(asset, 'business_value', 'medium'),
                NodeCriticality.MEDIUM
            ),
            source_type='Asset',
            source_id=asset.id,
            description=getattr(asset, 'description', None),
            tags=list(getattr(asset, 'tags', [])) if hasattr(asset, 'tags') else [],
        )

    @classmethod
    def from_control(cls, control) -> 'SecurityNode':
        """Create a SecurityNode from an AppliedControl model instance."""
        return cls(
            id=control.id,
            name=control.name,
            node_type=NodeType.CONTROL,
            criticality=NodeCriticality.MEDIUM,
            source_type='AppliedControl',
            source_id=control.id,
            description=getattr(control, 'description', None),
        )

    @classmethod
    def from_risk(cls, risk) -> 'SecurityNode':
        """Create a SecurityNode from a RiskScenario model instance."""
        return cls(
            id=risk.id,
            name=risk.name,
            node_type=NodeType.RISK,
            criticality=NodeCriticality.HIGH,
            source_type='RiskScenario',
            source_id=risk.id,
            description=getattr(risk, 'description', None),
        )

    @classmethod
    def from_threat(cls, threat) -> 'SecurityNode':
        """Create a SecurityNode from a Threat model instance."""
        return cls(
            id=threat.id,
            name=threat.name,
            node_type=NodeType.THREAT,
            criticality=NodeCriticality.HIGH,
            source_type='Threat',
            source_id=threat.id,
            description=getattr(threat, 'description', None),
        )
