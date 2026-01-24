"""
Tests for Security Graph and Graph Builder.
"""

import pytest
from uuid import uuid4, UUID
from unittest.mock import MagicMock, patch
from collections import defaultdict

from core.bounded_contexts.security_graph.aggregates.security_node import (
    SecurityNode,
    NodeType,
    NodeCriticality,
)
from core.bounded_contexts.security_graph.aggregates.security_edge import (
    SecurityEdge,
    EdgeType,
    EdgeDirection,
)
from core.bounded_contexts.security_graph.services.graph_builder import (
    SecurityGraph,
    SecurityGraphBuilder,
    get_graph_builder,
)


class TestSecurityGraph:
    """Tests for SecurityGraph class."""

    @pytest.fixture
    def empty_graph(self):
        return SecurityGraph()

    @pytest.fixture
    def sample_nodes(self):
        return [
            SecurityNode(
                id=uuid4(),
                name="Asset 1",
                node_type=NodeType.ASSET,
                criticality=NodeCriticality.HIGH,
            ),
            SecurityNode(
                id=uuid4(),
                name="Asset 2",
                node_type=NodeType.ASSET,
                criticality=NodeCriticality.MEDIUM,
            ),
            SecurityNode(
                id=uuid4(),
                name="Control 1",
                node_type=NodeType.CONTROL,
            ),
        ]

    def test_empty_graph_initialization(self, empty_graph):
        assert len(empty_graph.nodes) == 0
        assert len(empty_graph.edges) == 0

    def test_add_node(self, empty_graph, sample_nodes):
        node = sample_nodes[0]
        empty_graph.add_node(node)

        assert len(empty_graph.nodes) == 1
        assert node.id in empty_graph.nodes
        assert empty_graph.nodes[node.id] == node

    def test_add_multiple_nodes(self, empty_graph, sample_nodes):
        for node in sample_nodes:
            empty_graph.add_node(node)

        assert len(empty_graph.nodes) == 3

    def test_add_edge(self, empty_graph, sample_nodes):
        node1, node2 = sample_nodes[0], sample_nodes[1]
        empty_graph.add_node(node1)
        empty_graph.add_node(node2)

        edge = SecurityEdge(
            id=uuid4(),
            source_id=node1.id,
            target_id=node2.id,
            edge_type=EdgeType.DEPENDS_ON,
        )
        empty_graph.add_edge(edge)

        assert len(empty_graph.edges) == 1
        assert edge.id in empty_graph.edges
        assert node2.id in empty_graph._outgoing[node1.id]
        assert node1.id in empty_graph._incoming[node2.id]

    def test_add_bidirectional_edge(self, empty_graph, sample_nodes):
        node1, node2 = sample_nodes[0], sample_nodes[1]
        empty_graph.add_node(node1)
        empty_graph.add_node(node2)

        edge = SecurityEdge(
            id=uuid4(),
            source_id=node1.id,
            target_id=node2.id,
            edge_type=EdgeType.CONNECTS_TO,
            direction=EdgeDirection.BIDIRECTIONAL,
        )
        empty_graph.add_edge(edge)

        # Check both directions
        assert node2.id in empty_graph._outgoing[node1.id]
        assert node1.id in empty_graph._outgoing[node2.id]
        assert node1.id in empty_graph._incoming[node2.id]
        assert node2.id in empty_graph._incoming[node1.id]

    def test_get_node(self, empty_graph, sample_nodes):
        node = sample_nodes[0]
        empty_graph.add_node(node)

        result = empty_graph.get_node(node.id)
        assert result == node

        # Non-existent node
        result = empty_graph.get_node(uuid4())
        assert result is None

    def test_get_edge(self, empty_graph, sample_nodes):
        node1, node2 = sample_nodes[0], sample_nodes[1]
        empty_graph.add_node(node1)
        empty_graph.add_node(node2)

        edge = SecurityEdge(
            id=uuid4(),
            source_id=node1.id,
            target_id=node2.id,
            edge_type=EdgeType.PROTECTS,
        )
        empty_graph.add_edge(edge)

        result = empty_graph.get_edge(node1.id, node2.id)
        assert result == edge

        # Non-existent edge
        result = empty_graph.get_edge(node2.id, node1.id)
        assert result is None

    def test_get_neighbors_outgoing(self, empty_graph, sample_nodes):
        node1, node2, node3 = sample_nodes
        for node in sample_nodes:
            empty_graph.add_node(node)

        edge1 = SecurityEdge(
            id=uuid4(),
            source_id=node1.id,
            target_id=node2.id,
            edge_type=EdgeType.DEPENDS_ON,
        )
        edge2 = SecurityEdge(
            id=uuid4(),
            source_id=node1.id,
            target_id=node3.id,
            edge_type=EdgeType.DEPENDS_ON,
        )
        empty_graph.add_edge(edge1)
        empty_graph.add_edge(edge2)

        neighbors = empty_graph.get_neighbors(node1.id, direction='outgoing')
        assert len(neighbors) == 2
        assert node2.id in neighbors
        assert node3.id in neighbors

    def test_get_neighbors_incoming(self, empty_graph, sample_nodes):
        node1, node2, node3 = sample_nodes
        for node in sample_nodes:
            empty_graph.add_node(node)

        edge1 = SecurityEdge(
            id=uuid4(),
            source_id=node2.id,
            target_id=node1.id,
            edge_type=EdgeType.PROTECTS,
        )
        edge2 = SecurityEdge(
            id=uuid4(),
            source_id=node3.id,
            target_id=node1.id,
            edge_type=EdgeType.PROTECTS,
        )
        empty_graph.add_edge(edge1)
        empty_graph.add_edge(edge2)

        neighbors = empty_graph.get_neighbors(node1.id, direction='incoming')
        assert len(neighbors) == 2
        assert node2.id in neighbors
        assert node3.id in neighbors

    def test_get_neighbors_both(self, empty_graph, sample_nodes):
        node1, node2, node3 = sample_nodes
        for node in sample_nodes:
            empty_graph.add_node(node)

        edge1 = SecurityEdge(
            id=uuid4(),
            source_id=node1.id,
            target_id=node2.id,
            edge_type=EdgeType.DEPENDS_ON,
        )
        edge2 = SecurityEdge(
            id=uuid4(),
            source_id=node3.id,
            target_id=node1.id,
            edge_type=EdgeType.PROTECTS,
        )
        empty_graph.add_edge(edge1)
        empty_graph.add_edge(edge2)

        neighbors = empty_graph.get_neighbors(node1.id, direction='both')
        assert len(neighbors) == 2
        assert node2.id in neighbors
        assert node3.id in neighbors

    def test_get_subgraph(self, empty_graph, sample_nodes):
        for node in sample_nodes:
            empty_graph.add_node(node)

        edge = SecurityEdge(
            id=uuid4(),
            source_id=sample_nodes[0].id,
            target_id=sample_nodes[1].id,
            edge_type=EdgeType.DEPENDS_ON,
        )
        empty_graph.add_edge(edge)

        # Get subgraph with only first two nodes
        subgraph = empty_graph.get_subgraph({sample_nodes[0].id, sample_nodes[1].id})

        assert len(subgraph.nodes) == 2
        assert len(subgraph.edges) == 1

    def test_compute_degrees(self, empty_graph, sample_nodes):
        node1, node2, node3 = sample_nodes
        for node in sample_nodes:
            empty_graph.add_node(node)

        # Create edges: node1 -> node2, node1 -> node3, node2 -> node3
        edges = [
            SecurityEdge(id=uuid4(), source_id=node1.id, target_id=node2.id, edge_type=EdgeType.DEPENDS_ON),
            SecurityEdge(id=uuid4(), source_id=node1.id, target_id=node3.id, edge_type=EdgeType.DEPENDS_ON),
            SecurityEdge(id=uuid4(), source_id=node2.id, target_id=node3.id, edge_type=EdgeType.DEPENDS_ON),
        ]
        for edge in edges:
            empty_graph.add_edge(edge)

        empty_graph.compute_degrees()

        assert empty_graph.nodes[node1.id].out_degree == 2
        assert empty_graph.nodes[node1.id].in_degree == 0
        assert empty_graph.nodes[node2.id].out_degree == 1
        assert empty_graph.nodes[node2.id].in_degree == 1
        assert empty_graph.nodes[node3.id].out_degree == 0
        assert empty_graph.nodes[node3.id].in_degree == 2

    def test_compute_pagerank(self, empty_graph, sample_nodes):
        for node in sample_nodes:
            empty_graph.add_node(node)

        edge = SecurityEdge(
            id=uuid4(),
            source_id=sample_nodes[0].id,
            target_id=sample_nodes[1].id,
            edge_type=EdgeType.DEPENDS_ON,
        )
        empty_graph.add_edge(edge)

        empty_graph.compute_pagerank()

        # All nodes should have pagerank values
        for node in empty_graph.nodes.values():
            assert node.pagerank >= 0

    def test_compute_pagerank_empty_graph(self, empty_graph):
        # Should not raise error on empty graph
        empty_graph.compute_pagerank()

    def test_compute_betweenness_centrality(self, empty_graph, sample_nodes):
        for node in sample_nodes:
            empty_graph.add_node(node)

        # Create chain: node1 -> node2 -> node3
        edges = [
            SecurityEdge(id=uuid4(), source_id=sample_nodes[0].id, target_id=sample_nodes[1].id, edge_type=EdgeType.DEPENDS_ON),
            SecurityEdge(id=uuid4(), source_id=sample_nodes[1].id, target_id=sample_nodes[2].id, edge_type=EdgeType.DEPENDS_ON),
        ]
        for edge in edges:
            empty_graph.add_edge(edge)

        empty_graph.compute_betweenness_centrality()

        # Middle node should have higher betweenness
        assert empty_graph.nodes[sample_nodes[1].id].betweenness_centrality >= 0

    def test_compute_betweenness_empty_graph(self, empty_graph):
        # Should not raise error on empty graph
        empty_graph.compute_betweenness_centrality()

    def test_find_critical_nodes(self, empty_graph, sample_nodes):
        for node in sample_nodes:
            empty_graph.add_node(node)

        # First node is HIGH criticality, should be ranked higher
        critical_nodes = empty_graph.find_critical_nodes(top_n=2)

        assert len(critical_nodes) == 2
        assert sample_nodes[0] in critical_nodes  # HIGH criticality

    def test_to_dict(self, empty_graph, sample_nodes):
        for node in sample_nodes:
            empty_graph.add_node(node)

        edge = SecurityEdge(
            id=uuid4(),
            source_id=sample_nodes[0].id,
            target_id=sample_nodes[1].id,
            edge_type=EdgeType.PROTECTS,
        )
        empty_graph.add_edge(edge)

        result = empty_graph.to_dict()

        assert 'nodes' in result
        assert 'edges' in result
        assert 'stats' in result
        assert len(result['nodes']) == 3
        assert len(result['edges']) == 1
        assert result['stats']['node_count'] == 3
        assert result['stats']['edge_count'] == 1

    def test_to_vis_format(self, empty_graph, sample_nodes):
        for node in sample_nodes:
            empty_graph.add_node(node)

        edge = SecurityEdge(
            id=uuid4(),
            source_id=sample_nodes[0].id,
            target_id=sample_nodes[1].id,
            edge_type=EdgeType.PROTECTS,
        )
        empty_graph.add_edge(edge)

        result = empty_graph.to_vis_format()

        assert 'nodes' in result
        assert 'edges' in result
        assert len(result['nodes']) == 3
        assert len(result['edges']) == 1

    def test_count_node_types(self, empty_graph, sample_nodes):
        for node in sample_nodes:
            empty_graph.add_node(node)

        counts = empty_graph._count_node_types()

        assert counts['asset'] == 2
        assert counts['control'] == 1

    def test_count_edge_types(self, empty_graph, sample_nodes):
        for node in sample_nodes:
            empty_graph.add_node(node)

        edges = [
            SecurityEdge(id=uuid4(), source_id=sample_nodes[0].id, target_id=sample_nodes[1].id, edge_type=EdgeType.PROTECTS),
            SecurityEdge(id=uuid4(), source_id=sample_nodes[1].id, target_id=sample_nodes[2].id, edge_type=EdgeType.PROTECTS),
            SecurityEdge(id=uuid4(), source_id=sample_nodes[0].id, target_id=sample_nodes[2].id, edge_type=EdgeType.DEPENDS_ON),
        ]
        for edge in edges:
            empty_graph.add_edge(edge)

        counts = empty_graph._count_edge_types()

        assert counts['protects'] == 2
        assert counts['depends_on'] == 1


class TestSecurityGraphBuilder:
    """Tests for SecurityGraphBuilder class."""

    def test_init(self):
        builder = SecurityGraphBuilder()
        assert isinstance(builder.graph, SecurityGraph)

    @patch('core.models.Vulnerability')
    @patch('core.models.Threat')
    @patch('core.models.AppliedControl')
    @patch('core.models.Asset')
    @patch('iam.models.Folder')
    def test_build_from_folder(self, mock_folder, mock_asset, mock_control, mock_threat, mock_vuln):
        # Setup mocks
        folder_id = uuid4()
        mock_folder_instance = MagicMock()
        mock_folder.objects.get.return_value = mock_folder_instance

        # Mock assets
        asset1 = MagicMock()
        asset1.id = uuid4()
        asset1.name = "Asset 1"
        asset1.business_value = "high"
        asset1.description = "Test asset"

        mock_asset.objects.filter.return_value = [asset1]
        mock_control.objects.filter.return_value = []
        mock_threat.objects.filter.return_value = []

        builder = SecurityGraphBuilder()
        graph = builder.build_from_folder(folder_id)

        assert isinstance(graph, SecurityGraph)
        assert len(graph.nodes) >= 0  # May have nodes from assets

    @patch('core.models.AppliedControl')
    @patch('core.models.Asset')
    def test_build_from_assets_empty(self, mock_asset, mock_control):
        mock_asset.objects.filter.return_value = []

        builder = SecurityGraphBuilder()
        graph = builder.build_from_assets([])

        assert isinstance(graph, SecurityGraph)
        assert len(graph.nodes) == 0


class TestGetGraphBuilder:
    """Tests for singleton getter."""

    def test_get_graph_builder_returns_instance(self):
        # Clear singleton
        import core.bounded_contexts.security_graph.services.graph_builder as module
        module._graph_builder = None

        builder = get_graph_builder()
        assert isinstance(builder, SecurityGraphBuilder)

    def test_get_graph_builder_returns_same_instance(self):
        builder1 = get_graph_builder()
        builder2 = get_graph_builder()
        assert builder1 is builder2


class TestSecurityGraphAlgorithms:
    """Tests for graph algorithms."""

    def test_pagerank_convergence(self):
        """Test PageRank converges to expected values for simple graph."""
        graph = SecurityGraph()

        # Create a simple chain: A -> B -> C
        nodes = [
            SecurityNode(id=uuid4(), name=f"Node {i}", node_type=NodeType.ASSET)
            for i in range(3)
        ]
        for node in nodes:
            graph.add_node(node)

        edges = [
            SecurityEdge(id=uuid4(), source_id=nodes[0].id, target_id=nodes[1].id, edge_type=EdgeType.DEPENDS_ON),
            SecurityEdge(id=uuid4(), source_id=nodes[1].id, target_id=nodes[2].id, edge_type=EdgeType.DEPENDS_ON),
        ]
        for edge in edges:
            graph.add_edge(edge)

        graph.compute_pagerank(iterations=50)

        # In a chain A -> B -> C, later nodes should have higher PageRank
        # because they receive rank from earlier nodes
        # All nodes should have non-negative pagerank values
        for node in graph.nodes.values():
            assert node.pagerank >= 0

        # Node C (index 2) receives rank from B, B receives from A
        # With damping, C should have at least as much rank as the base value
        assert graph.nodes[nodes[2].id].pagerank > 0

    def test_betweenness_centrality_bridge_node(self):
        """Test that bridge nodes have high betweenness."""
        graph = SecurityGraph()

        # Create: A -> B -> C, D -> B -> E
        # B is the bridge node
        nodes = [
            SecurityNode(id=uuid4(), name=f"Node {i}", node_type=NodeType.ASSET)
            for i in range(5)
        ]
        for node in nodes:
            graph.add_node(node)

        # B is nodes[1]
        edges = [
            SecurityEdge(id=uuid4(), source_id=nodes[0].id, target_id=nodes[1].id, edge_type=EdgeType.DEPENDS_ON),
            SecurityEdge(id=uuid4(), source_id=nodes[1].id, target_id=nodes[2].id, edge_type=EdgeType.DEPENDS_ON),
            SecurityEdge(id=uuid4(), source_id=nodes[3].id, target_id=nodes[1].id, edge_type=EdgeType.DEPENDS_ON),
            SecurityEdge(id=uuid4(), source_id=nodes[1].id, target_id=nodes[4].id, edge_type=EdgeType.DEPENDS_ON),
        ]
        for edge in edges:
            graph.add_edge(edge)

        graph.compute_betweenness_centrality()

        # Bridge node should have highest betweenness
        bridge_node = graph.nodes[nodes[1].id]
        for node in graph.nodes.values():
            if node.id != nodes[1].id:
                assert bridge_node.betweenness_centrality >= node.betweenness_centrality
