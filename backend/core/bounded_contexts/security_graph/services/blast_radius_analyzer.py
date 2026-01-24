"""
Blast Radius Analyzer Service

Analyzes potential impact propagation through the security graph.
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Set, Tuple
from uuid import UUID
import logging
from collections import deque

from ..aggregates.security_node import SecurityNode, NodeType, NodeCriticality
from ..aggregates.security_edge import SecurityEdge, EdgeType
from .graph_builder import SecurityGraph

logger = logging.getLogger(__name__)


@dataclass
class AttackPath:
    """Represents a potential attack path through the graph."""
    path: List[UUID]
    path_nodes: List[str]  # Node names for display
    total_length: int
    risk_score: float
    entry_point: UUID
    target: UUID
    edge_types: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'path': [str(p) for p in self.path],
            'path_nodes': self.path_nodes,
            'total_length': self.total_length,
            'risk_score': self.risk_score,
            'entry_point': str(self.entry_point),
            'target': str(self.target),
            'edge_types': self.edge_types,
        }


@dataclass
class BlastRadiusResult:
    """Result of blast radius analysis."""
    source_node_id: UUID
    source_node_name: str
    affected_nodes: List[Dict[str, Any]]
    total_affected: int
    direct_impact: int
    indirect_impact: int
    risk_score: float
    critical_assets_affected: int
    attack_paths: List[AttackPath] = field(default_factory=list)
    impact_by_type: Dict[str, int] = field(default_factory=dict)
    impact_by_hop: Dict[int, int] = field(default_factory=dict)
    recommendations: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'source_node_id': str(self.source_node_id),
            'source_node_name': self.source_node_name,
            'affected_nodes': self.affected_nodes,
            'total_affected': self.total_affected,
            'direct_impact': self.direct_impact,
            'indirect_impact': self.indirect_impact,
            'risk_score': self.risk_score,
            'critical_assets_affected': self.critical_assets_affected,
            'attack_paths': [p.to_dict() for p in self.attack_paths],
            'impact_by_type': self.impact_by_type,
            'impact_by_hop': self.impact_by_hop,
            'recommendations': self.recommendations,
        }


class BlastRadiusAnalyzer:
    """
    Analyzes blast radius and impact propagation in security graphs.

    Provides:
    - Impact propagation analysis
    - Attack path identification
    - Critical node detection
    - Risk score calculation
    """

    def __init__(self, max_hops: int = 5):
        """
        Initialize the analyzer.

        Args:
            max_hops: Maximum number of hops for impact propagation
        """
        self.max_hops = max_hops

    def analyze_blast_radius(
        self,
        graph: SecurityGraph,
        source_node_id: UUID,
        propagation_threshold: float = 0.1,
    ) -> BlastRadiusResult:
        """
        Analyze the blast radius from a source node.

        Args:
            graph: The security graph to analyze
            source_node_id: Starting node for analysis
            propagation_threshold: Minimum propagation factor to continue

        Returns:
            BlastRadiusResult with impact analysis
        """
        source_node = graph.get_node(source_node_id)
        if not source_node:
            return BlastRadiusResult(
                source_node_id=source_node_id,
                source_node_name='Unknown',
                affected_nodes=[],
                total_affected=0,
                direct_impact=0,
                indirect_impact=0,
                risk_score=0.0,
                critical_assets_affected=0,
            )

        # BFS to find affected nodes
        affected = {}  # node_id -> (hop_distance, propagation_factor)
        queue = deque([(source_node_id, 0, 1.0)])  # (node_id, hops, propagation)
        visited = {source_node_id}

        while queue:
            current_id, hops, propagation = queue.popleft()

            if hops > 0:  # Don't include source in affected
                affected[current_id] = (hops, propagation)

            if hops >= self.max_hops:
                continue

            # Propagate to neighbors
            for neighbor_id in graph.get_neighbors(current_id, direction='outgoing'):
                if neighbor_id not in visited:
                    edge = graph.get_edge(current_id, neighbor_id)
                    new_propagation = propagation * (
                        edge.risk_propagation_factor if edge else 0.5
                    )

                    if new_propagation >= propagation_threshold:
                        visited.add(neighbor_id)
                        queue.append((neighbor_id, hops + 1, new_propagation))

        # Build affected nodes list
        affected_nodes = []
        impact_by_type = {}
        impact_by_hop = {}
        critical_count = 0

        for node_id, (hops, prop) in affected.items():
            node = graph.get_node(node_id)
            if not node:
                continue

            affected_nodes.append({
                'id': str(node_id),
                'name': node.name,
                'type': node.node_type.value,
                'criticality': node.criticality.value,
                'hops': hops,
                'propagation_factor': prop,
                'impact_score': prop * (
                    10 if node.criticality == NodeCriticality.CRITICAL else
                    5 if node.criticality == NodeCriticality.HIGH else
                    2 if node.criticality == NodeCriticality.MEDIUM else 1
                ),
            })

            # Count by type
            type_key = node.node_type.value
            impact_by_type[type_key] = impact_by_type.get(type_key, 0) + 1

            # Count by hop
            impact_by_hop[hops] = impact_by_hop.get(hops, 0) + 1

            # Count critical assets
            if node.is_critical and node.node_type == NodeType.ASSET:
                critical_count += 1

        # Sort by impact score
        affected_nodes.sort(key=lambda x: x['impact_score'], reverse=True)

        # Calculate overall risk score
        risk_score = sum(n['impact_score'] for n in affected_nodes)

        # Generate recommendations
        recommendations = self._generate_recommendations(
            source_node, affected_nodes, critical_count
        )

        return BlastRadiusResult(
            source_node_id=source_node_id,
            source_node_name=source_node.name,
            affected_nodes=affected_nodes,
            total_affected=len(affected_nodes),
            direct_impact=impact_by_hop.get(1, 0),
            indirect_impact=sum(v for k, v in impact_by_hop.items() if k > 1),
            risk_score=risk_score,
            critical_assets_affected=critical_count,
            impact_by_type=impact_by_type,
            impact_by_hop=impact_by_hop,
            recommendations=recommendations,
        )

    def find_attack_paths(
        self,
        graph: SecurityGraph,
        entry_point_id: UUID,
        target_id: UUID,
        max_paths: int = 5,
    ) -> List[AttackPath]:
        """
        Find potential attack paths between two nodes.

        Args:
            graph: The security graph
            entry_point_id: Starting node (attacker entry)
            target_id: Target node (valuable asset)
            max_paths: Maximum number of paths to return

        Returns:
            List of attack paths
        """
        paths = []
        visited_paths = set()

        def dfs(current: UUID, target: UUID, path: List[UUID], depth: int):
            if depth > self.max_hops:
                return

            if current == target and len(path) > 1:
                path_tuple = tuple(path)
                if path_tuple not in visited_paths:
                    visited_paths.add(path_tuple)

                    # Build path info
                    path_nodes = []
                    edge_types = []

                    for i, node_id in enumerate(path):
                        node = graph.get_node(node_id)
                        path_nodes.append(node.name if node else str(node_id))

                        if i > 0:
                            edge = graph.get_edge(path[i-1], node_id)
                            edge_types.append(edge.edge_type.value if edge else 'unknown')

                    # Calculate risk score
                    risk_score = self._calculate_path_risk(graph, path)

                    paths.append(AttackPath(
                        path=list(path),
                        path_nodes=path_nodes,
                        total_length=len(path) - 1,
                        risk_score=risk_score,
                        entry_point=entry_point_id,
                        target=target_id,
                        edge_types=edge_types,
                    ))
                return

            for neighbor in graph.get_neighbors(current, direction='outgoing'):
                if neighbor not in path:
                    path.append(neighbor)
                    dfs(neighbor, target, path, depth + 1)
                    path.pop()

        dfs(entry_point_id, target_id, [entry_point_id], 0)

        # Sort by risk score and return top paths
        paths.sort(key=lambda p: p.risk_score, reverse=True)
        return paths[:max_paths]

    def identify_critical_paths(
        self,
        graph: SecurityGraph,
    ) -> List[AttackPath]:
        """
        Identify the most critical attack paths in the graph.

        Focuses on paths leading to critical assets from external entry points.

        Args:
            graph: The security graph

        Returns:
            List of critical attack paths
        """
        critical_paths = []

        # Find potential entry points (threats, external systems)
        entry_points = [
            node for node in graph.nodes.values()
            if node.node_type in [NodeType.THREAT, NodeType.THIRD_PARTY]
        ]

        # Find critical targets
        critical_targets = [
            node for node in graph.nodes.values()
            if node.is_critical and node.node_type == NodeType.ASSET
        ]

        # Find paths from entry points to critical targets
        for entry in entry_points:
            for target in critical_targets:
                paths = self.find_attack_paths(
                    graph, entry.id, target.id, max_paths=2
                )
                critical_paths.extend(paths)

        # Sort by risk and deduplicate
        critical_paths.sort(key=lambda p: p.risk_score, reverse=True)

        # Keep top 10 unique paths
        seen = set()
        unique_paths = []
        for path in critical_paths:
            key = (path.entry_point, path.target, path.total_length)
            if key not in seen:
                seen.add(key)
                unique_paths.append(path)
                if len(unique_paths) >= 10:
                    break

        return unique_paths

    def calculate_node_blast_scores(self, graph: SecurityGraph) -> None:
        """
        Calculate blast radius scores for all nodes in the graph.

        Updates nodes in place with blast_radius_score.

        Args:
            graph: The security graph to analyze
        """
        for node_id in graph.nodes:
            result = self.analyze_blast_radius(
                graph, node_id, propagation_threshold=0.2
            )
            graph.nodes[node_id].blast_radius_score = result.risk_score

    def get_impact_summary(
        self,
        graph: SecurityGraph,
        compromised_nodes: List[UUID],
    ) -> Dict[str, Any]:
        """
        Get a summary of impact if multiple nodes are compromised.

        Args:
            graph: The security graph
            compromised_nodes: List of compromised node IDs

        Returns:
            Summary of combined impact
        """
        all_affected = set()
        total_risk = 0.0
        critical_affected = set()

        for node_id in compromised_nodes:
            result = self.analyze_blast_radius(graph, node_id)

            for affected in result.affected_nodes:
                all_affected.add(affected['id'])
                if affected['criticality'] == 'critical':
                    critical_affected.add(affected['id'])

            total_risk += result.risk_score

        return {
            'compromised_count': len(compromised_nodes),
            'total_affected': len(all_affected),
            'critical_affected': len(critical_affected),
            'combined_risk_score': total_risk,
            'average_blast_radius': total_risk / len(compromised_nodes) if compromised_nodes else 0,
        }

    def _calculate_path_risk(self, graph: SecurityGraph, path: List[UUID]) -> float:
        """Calculate risk score for a path."""
        if len(path) < 2:
            return 0.0

        risk = 0.0

        # Factor 1: Path length (shorter is riskier)
        risk += 10.0 / len(path)

        # Factor 2: Node criticality along path
        for node_id in path:
            node = graph.get_node(node_id)
            if node:
                if node.criticality == NodeCriticality.CRITICAL:
                    risk += 10
                elif node.criticality == NodeCriticality.HIGH:
                    risk += 5
                elif node.criticality == NodeCriticality.MEDIUM:
                    risk += 2

        # Factor 3: Edge types (exploits and threatens are riskier)
        for i in range(len(path) - 1):
            edge = graph.get_edge(path[i], path[i + 1])
            if edge:
                if edge.edge_type in [EdgeType.EXPLOITS, EdgeType.THREATENS]:
                    risk += 5
                elif edge.is_risk_relationship:
                    risk += 3

        return risk

    def _generate_recommendations(
        self,
        source_node: SecurityNode,
        affected_nodes: List[Dict[str, Any]],
        critical_count: int,
    ) -> List[str]:
        """Generate recommendations based on blast radius analysis."""
        recommendations = []

        # High blast radius
        if len(affected_nodes) > 10:
            recommendations.append(
                f"High blast radius detected ({len(affected_nodes)} nodes affected). "
                "Consider implementing network segmentation."
            )

        # Critical assets at risk
        if critical_count > 0:
            recommendations.append(
                f"{critical_count} critical asset(s) in blast radius. "
                "Review and strengthen access controls for these assets."
            )

        # Source is a hub
        if source_node.is_hub:
            recommendations.append(
                f"{source_node.name} is a hub node with high connectivity. "
                "Prioritize security controls for this node."
            )

        # Many direct impacts
        direct_count = sum(1 for n in affected_nodes if n['hops'] == 1)
        if direct_count > 5:
            recommendations.append(
                f"{direct_count} directly connected nodes. "
                "Consider reducing coupling or implementing isolation."
            )

        if not recommendations:
            recommendations.append(
                "Blast radius is within acceptable limits. "
                "Continue monitoring for changes."
            )

        return recommendations


# Singleton instance
_blast_radius_analyzer: Optional[BlastRadiusAnalyzer] = None


def get_blast_radius_analyzer() -> BlastRadiusAnalyzer:
    """Get or create the blast radius analyzer instance."""
    global _blast_radius_analyzer
    if _blast_radius_analyzer is None:
        _blast_radius_analyzer = BlastRadiusAnalyzer()
    return _blast_radius_analyzer
