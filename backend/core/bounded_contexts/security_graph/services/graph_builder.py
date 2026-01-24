"""
Security Graph Builder Service

Builds and maintains the security relationship graph from
CISO Assistant entities.
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Set, Tuple
from uuid import UUID, uuid4
import logging
from collections import defaultdict

from ..aggregates.security_node import SecurityNode, NodeType, NodeCriticality
from ..aggregates.security_edge import SecurityEdge, EdgeType, EdgeDirection

logger = logging.getLogger(__name__)


@dataclass
class SecurityGraph:
    """
    In-memory security graph representation.

    Provides graph operations without requiring external graph database.
    """
    nodes: Dict[UUID, SecurityNode] = field(default_factory=dict)
    edges: Dict[UUID, SecurityEdge] = field(default_factory=dict)

    # Adjacency lists for efficient traversal
    _outgoing: Dict[UUID, Set[UUID]] = field(default_factory=lambda: defaultdict(set))
    _incoming: Dict[UUID, Set[UUID]] = field(default_factory=lambda: defaultdict(set))
    _edge_index: Dict[Tuple[UUID, UUID], UUID] = field(default_factory=dict)

    def add_node(self, node: SecurityNode) -> None:
        """Add a node to the graph."""
        self.nodes[node.id] = node

    def add_edge(self, edge: SecurityEdge) -> None:
        """Add an edge to the graph."""
        self.edges[edge.id] = edge
        self._outgoing[edge.source_id].add(edge.target_id)
        self._incoming[edge.target_id].add(edge.source_id)
        self._edge_index[(edge.source_id, edge.target_id)] = edge.id

        if edge.direction == EdgeDirection.BIDIRECTIONAL:
            self._outgoing[edge.target_id].add(edge.source_id)
            self._incoming[edge.source_id].add(edge.target_id)

    def get_node(self, node_id: UUID) -> Optional[SecurityNode]:
        """Get a node by ID."""
        return self.nodes.get(node_id)

    def get_edge(self, source_id: UUID, target_id: UUID) -> Optional[SecurityEdge]:
        """Get edge between two nodes."""
        edge_id = self._edge_index.get((source_id, target_id))
        return self.edges.get(edge_id) if edge_id else None

    def get_neighbors(self, node_id: UUID, direction: str = 'both') -> Set[UUID]:
        """Get neighboring node IDs."""
        if direction == 'outgoing':
            return self._outgoing.get(node_id, set())
        elif direction == 'incoming':
            return self._incoming.get(node_id, set())
        else:
            return self._outgoing.get(node_id, set()) | self._incoming.get(node_id, set())

    def get_subgraph(self, node_ids: Set[UUID]) -> 'SecurityGraph':
        """Extract a subgraph containing specified nodes."""
        subgraph = SecurityGraph()

        for node_id in node_ids:
            if node_id in self.nodes:
                subgraph.add_node(self.nodes[node_id])

        for edge in self.edges.values():
            if edge.source_id in node_ids and edge.target_id in node_ids:
                subgraph.add_edge(edge)

        return subgraph

    def compute_degrees(self) -> None:
        """Compute in/out degrees for all nodes."""
        for node_id, node in self.nodes.items():
            node.out_degree = len(self._outgoing.get(node_id, set()))
            node.in_degree = len(self._incoming.get(node_id, set()))

    def compute_pagerank(self, damping: float = 0.85, iterations: int = 100) -> None:
        """Compute PageRank for all nodes."""
        if not self.nodes:
            return

        n = len(self.nodes)
        node_ids = list(self.nodes.keys())
        pagerank = {nid: 1.0 / n for nid in node_ids}

        for _ in range(iterations):
            new_pagerank = {}
            for node_id in node_ids:
                incoming = self._incoming.get(node_id, set())
                rank_sum = sum(
                    pagerank[src] / max(1, len(self._outgoing.get(src, set())))
                    for src in incoming if src in pagerank
                )
                new_pagerank[node_id] = (1 - damping) / n + damping * rank_sum
            pagerank = new_pagerank

        for node_id, rank in pagerank.items():
            if node_id in self.nodes:
                self.nodes[node_id].pagerank = rank

    def compute_betweenness_centrality(self) -> None:
        """Compute betweenness centrality for all nodes (simplified)."""
        if not self.nodes:
            return

        centrality = {nid: 0.0 for nid in self.nodes}
        node_ids = list(self.nodes.keys())

        for source in node_ids:
            # BFS from source
            distances = {source: 0}
            paths = {source: 1}
            queue = [source]
            order = []

            while queue:
                current = queue.pop(0)
                order.append(current)

                for neighbor in self._outgoing.get(current, set()):
                    if neighbor not in distances:
                        distances[neighbor] = distances[current] + 1
                        queue.append(neighbor)
                    if distances[neighbor] == distances[current] + 1:
                        paths[neighbor] = paths.get(neighbor, 0) + paths[current]

            # Accumulate dependencies
            dependencies = {nid: 0.0 for nid in order}
            while order:
                node = order.pop()
                for neighbor in self._incoming.get(node, set()):
                    if neighbor in distances and distances[neighbor] == distances[node] - 1:
                        dependencies[neighbor] += (paths[neighbor] / paths[node]) * (1 + dependencies[node])
                if node != source:
                    centrality[node] += dependencies[node]

        # Normalize
        n = len(self.nodes)
        if n > 2:
            factor = 1.0 / ((n - 1) * (n - 2))
            for node_id in centrality:
                centrality[node_id] *= factor

        for node_id, value in centrality.items():
            if node_id in self.nodes:
                self.nodes[node_id].betweenness_centrality = value

    def find_critical_nodes(self, top_n: int = 10) -> List[SecurityNode]:
        """Find the most critical nodes based on multiple factors."""
        scored_nodes = []

        for node in self.nodes.values():
            # Composite criticality score
            score = (
                (1 if node.criticality == NodeCriticality.CRITICAL else 0) * 100 +
                (1 if node.criticality == NodeCriticality.HIGH else 0) * 50 +
                node.degree * 5 +
                node.pagerank * 1000 +
                node.betweenness_centrality * 500 +
                node.blast_radius_score * 10
            )
            scored_nodes.append((score, node))

        scored_nodes.sort(key=lambda x: x[0], reverse=True)
        return [node for _, node in scored_nodes[:top_n]]

    def to_dict(self) -> Dict[str, Any]:
        """Convert graph to dictionary for API response."""
        return {
            'nodes': [node.to_dict() for node in self.nodes.values()],
            'edges': [edge.to_dict() for edge in self.edges.values()],
            'stats': {
                'node_count': len(self.nodes),
                'edge_count': len(self.edges),
                'node_types': self._count_node_types(),
                'edge_types': self._count_edge_types(),
            },
        }

    def to_vis_format(self) -> Dict[str, Any]:
        """Convert to visualization format for frontend."""
        return {
            'nodes': [node.to_vis_node() for node in self.nodes.values()],
            'edges': [edge.to_vis_edge() for edge in self.edges.values()],
        }

    def _count_node_types(self) -> Dict[str, int]:
        """Count nodes by type."""
        counts = defaultdict(int)
        for node in self.nodes.values():
            counts[node.node_type.value] += 1
        return dict(counts)

    def _count_edge_types(self) -> Dict[str, int]:
        """Count edges by type."""
        counts = defaultdict(int)
        for edge in self.edges.values():
            counts[edge.edge_type.value] += 1
        return dict(counts)


class SecurityGraphBuilder:
    """
    Builds security graphs from CISO Assistant data.
    """

    def __init__(self):
        """Initialize the graph builder."""
        self.graph = SecurityGraph()

    def build_from_folder(self, folder_id: UUID) -> SecurityGraph:
        """
        Build a security graph from all entities in a folder.

        Args:
            folder_id: The folder UUID to build graph from

        Returns:
            SecurityGraph with all entities and relationships
        """
        self.graph = SecurityGraph()

        try:
            # Import models here to avoid circular imports
            from core.models import Asset, AppliedControl, Threat, Vulnerability
            from iam.models import Folder

            folder = Folder.objects.get(id=folder_id)

            # Add assets
            assets = Asset.objects.filter(folder=folder)
            for asset in assets:
                node = SecurityNode.from_asset(asset)
                self.graph.add_node(node)

            # Add controls
            controls = AppliedControl.objects.filter(folder=folder)
            for control in controls:
                node = SecurityNode.from_control(control)
                self.graph.add_node(node)

            # Add threats
            threats = Threat.objects.filter(folder=folder)
            for threat in threats:
                node = SecurityNode.from_threat(threat)
                self.graph.add_node(node)

            # Build relationships
            self._build_asset_relationships(assets)
            self._build_control_relationships(controls)
            self._build_threat_relationships(threats, assets)

            # Compute metrics
            self.graph.compute_degrees()
            self.graph.compute_pagerank()
            self.graph.compute_betweenness_centrality()

        except Exception as e:
            logger.error(f"Error building graph from folder: {e}")

        return self.graph

    def build_from_assets(self, asset_ids: List[UUID]) -> SecurityGraph:
        """
        Build a security graph from specific assets.

        Args:
            asset_ids: List of asset UUIDs

        Returns:
            SecurityGraph with assets and related entities
        """
        self.graph = SecurityGraph()

        try:
            from core.models import Asset, AppliedControl

            assets = Asset.objects.filter(id__in=asset_ids)

            # Add assets
            for asset in assets:
                node = SecurityNode.from_asset(asset)
                self.graph.add_node(node)

            # Add related controls
            for asset in assets:
                if hasattr(asset, 'applied_controls'):
                    for control in asset.applied_controls.all():
                        if control.id not in self.graph.nodes:
                            node = SecurityNode.from_control(control)
                            self.graph.add_node(node)

                        # Create protection edge
                        edge = SecurityEdge(
                            id=uuid4(),
                            source_id=control.id,
                            target_id=asset.id,
                            edge_type=EdgeType.PROTECTS,
                        )
                        self.graph.add_edge(edge)

            # Build asset relationships
            self._build_asset_relationships(assets)

            # Compute metrics
            self.graph.compute_degrees()
            self.graph.compute_pagerank()

        except Exception as e:
            logger.error(f"Error building graph from assets: {e}")

        return self.graph

    def build_risk_graph(self, risk_assessment_id: UUID) -> SecurityGraph:
        """
        Build a graph focused on risk relationships.

        Args:
            risk_assessment_id: Risk assessment UUID

        Returns:
            SecurityGraph with risk-focused relationships
        """
        self.graph = SecurityGraph()

        try:
            from core.models import RiskScenario, RiskAssessment

            assessment = RiskAssessment.objects.get(id=risk_assessment_id)
            scenarios = RiskScenario.objects.filter(risk_assessment=assessment)

            for scenario in scenarios:
                # Add risk node
                risk_node = SecurityNode.from_risk(scenario)
                self.graph.add_node(risk_node)

                # Add associated assets
                if hasattr(scenario, 'assets'):
                    for asset in scenario.assets.all():
                        if asset.id not in self.graph.nodes:
                            asset_node = SecurityNode.from_asset(asset)
                            self.graph.add_node(asset_node)

                        # Risk affects asset
                        edge = SecurityEdge(
                            id=uuid4(),
                            source_id=scenario.id,
                            target_id=asset.id,
                            edge_type=EdgeType.AFFECTS,
                            risk_propagation_factor=0.8,
                        )
                        self.graph.add_edge(edge)

                # Add associated threats
                if hasattr(scenario, 'threats'):
                    for threat in scenario.threats.all():
                        if threat.id not in self.graph.nodes:
                            threat_node = SecurityNode.from_threat(threat)
                            self.graph.add_node(threat_node)

                        # Threat causes risk
                        edge = SecurityEdge(
                            id=uuid4(),
                            source_id=threat.id,
                            target_id=scenario.id,
                            edge_type=EdgeType.THREATENS,
                        )
                        self.graph.add_edge(edge)

            # Compute metrics
            self.graph.compute_degrees()
            self.graph.compute_pagerank()
            self.graph.compute_betweenness_centrality()

        except Exception as e:
            logger.error(f"Error building risk graph: {e}")

        return self.graph

    def _build_asset_relationships(self, assets) -> None:
        """Build relationships between assets."""
        # Check for parent-child relationships
        for asset in assets:
            if hasattr(asset, 'parent_assets'):
                for parent in asset.parent_assets.all():
                    if parent.id in self.graph.nodes:
                        edge = SecurityEdge(
                            id=uuid4(),
                            source_id=asset.id,
                            target_id=parent.id,
                            edge_type=EdgeType.DEPENDS_ON,
                        )
                        self.graph.add_edge(edge)

    def _build_control_relationships(self, controls) -> None:
        """Build relationships for controls."""
        for control in controls:
            # Link controls to assets they protect
            if hasattr(control, 'assets'):
                for asset in control.assets.all():
                    if asset.id in self.graph.nodes:
                        edge = SecurityEdge(
                            id=uuid4(),
                            source_id=control.id,
                            target_id=asset.id,
                            edge_type=EdgeType.PROTECTS,
                        )
                        self.graph.add_edge(edge)

    def _build_threat_relationships(self, threats, assets) -> None:
        """Build relationships for threats."""
        for threat in threats:
            # Link threats to vulnerable assets
            if hasattr(threat, 'assets'):
                for asset in threat.assets.all():
                    if asset.id in self.graph.nodes:
                        edge = SecurityEdge(
                            id=uuid4(),
                            source_id=threat.id,
                            target_id=asset.id,
                            edge_type=EdgeType.THREATENS,
                            risk_propagation_factor=0.7,
                        )
                        self.graph.add_edge(edge)


# Singleton instance
_graph_builder: Optional[SecurityGraphBuilder] = None


def get_graph_builder() -> SecurityGraphBuilder:
    """Get or create the graph builder instance."""
    global _graph_builder
    if _graph_builder is None:
        _graph_builder = SecurityGraphBuilder()
    return _graph_builder
