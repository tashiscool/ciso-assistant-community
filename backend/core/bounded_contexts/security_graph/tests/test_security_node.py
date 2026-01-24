"""
Tests for Security Node aggregate.
"""

import pytest
from uuid import uuid4, UUID
from datetime import datetime
from unittest.mock import MagicMock

from core.bounded_contexts.security_graph.aggregates.security_node import (
    SecurityNode,
    NodeType,
    NodeCriticality,
)


class TestNodeType:
    """Tests for NodeType enum."""

    def test_node_type_values(self):
        assert NodeType.ASSET.value == 'asset'
        assert NodeType.CONTROL.value == 'control'
        assert NodeType.RISK.value == 'risk'
        assert NodeType.THREAT.value == 'threat'
        assert NodeType.VULNERABILITY.value == 'vulnerability'
        assert NodeType.USER.value == 'user'
        assert NodeType.SYSTEM.value == 'system'
        assert NodeType.DATA.value == 'data'
        assert NodeType.NETWORK.value == 'network'
        assert NodeType.APPLICATION.value == 'application'
        assert NodeType.PROCESS.value == 'process'
        assert NodeType.THIRD_PARTY.value == 'third_party'


class TestNodeCriticality:
    """Tests for NodeCriticality enum."""

    def test_criticality_values(self):
        assert NodeCriticality.CRITICAL.value == 'critical'
        assert NodeCriticality.HIGH.value == 'high'
        assert NodeCriticality.MEDIUM.value == 'medium'
        assert NodeCriticality.LOW.value == 'low'
        assert NodeCriticality.INFORMATIONAL.value == 'informational'


class TestSecurityNode:
    """Tests for SecurityNode dataclass."""

    def test_node_creation_minimal(self):
        node_id = uuid4()
        node = SecurityNode(
            id=node_id,
            name="Test Asset",
            node_type=NodeType.ASSET,
        )
        assert node.id == node_id
        assert node.name == "Test Asset"
        assert node.node_type == NodeType.ASSET
        assert node.criticality == NodeCriticality.MEDIUM

    def test_node_creation_full(self):
        node_id = uuid4()
        source_id = uuid4()
        node = SecurityNode(
            id=node_id,
            name="Critical Server",
            node_type=NodeType.SYSTEM,
            criticality=NodeCriticality.CRITICAL,
            source_type='Asset',
            source_id=source_id,
            description="Production database server",
            tags=['production', 'database'],
            metadata={'owner': 'IT Team'},
            in_degree=5,
            out_degree=3,
            betweenness_centrality=0.15,
            pagerank=0.02,
            inherent_risk_score=8.5,
            residual_risk_score=4.2,
            blast_radius_score=7.0,
        )
        assert node.id == node_id
        assert node.criticality == NodeCriticality.CRITICAL
        assert node.source_type == 'Asset'
        assert node.source_id == source_id
        assert len(node.tags) == 2
        assert node.metadata['owner'] == 'IT Team'
        assert node.blast_radius_score == 7.0

    def test_node_post_init_string_id(self):
        node_id = uuid4()
        node = SecurityNode(
            id=str(node_id),  # Pass as string
            name="Test",
            node_type="asset",  # Pass as string
            criticality="high",  # Pass as string
        )
        assert isinstance(node.id, UUID)
        assert node.id == node_id
        assert node.node_type == NodeType.ASSET
        assert node.criticality == NodeCriticality.HIGH

    def test_degree_property(self):
        node = SecurityNode(
            id=uuid4(),
            name="Test",
            node_type=NodeType.ASSET,
            in_degree=5,
            out_degree=3,
        )
        assert node.degree == 8

    def test_is_critical_property(self):
        critical_node = SecurityNode(
            id=uuid4(),
            name="Critical",
            node_type=NodeType.ASSET,
            criticality=NodeCriticality.CRITICAL,
        )
        assert critical_node.is_critical is True

        high_node = SecurityNode(
            id=uuid4(),
            name="High",
            node_type=NodeType.ASSET,
            criticality=NodeCriticality.HIGH,
        )
        assert high_node.is_critical is True

        medium_node = SecurityNode(
            id=uuid4(),
            name="Medium",
            node_type=NodeType.ASSET,
            criticality=NodeCriticality.MEDIUM,
        )
        assert medium_node.is_critical is False

    def test_is_hub_property_by_degree(self):
        hub_node = SecurityNode(
            id=uuid4(),
            name="Hub",
            node_type=NodeType.ASSET,
            in_degree=8,
            out_degree=5,  # Total degree > 10
        )
        assert hub_node.is_hub is True

        non_hub_node = SecurityNode(
            id=uuid4(),
            name="Non-Hub",
            node_type=NodeType.ASSET,
            in_degree=2,
            out_degree=3,
        )
        assert non_hub_node.is_hub is False

    def test_is_hub_property_by_centrality(self):
        hub_node = SecurityNode(
            id=uuid4(),
            name="Hub",
            node_type=NodeType.ASSET,
            betweenness_centrality=0.15,  # > 0.1
        )
        assert hub_node.is_hub is True

    def test_to_dict(self):
        node_id = uuid4()
        source_id = uuid4()
        node = SecurityNode(
            id=node_id,
            name="Test Asset",
            node_type=NodeType.ASSET,
            criticality=NodeCriticality.HIGH,
            source_type='Asset',
            source_id=source_id,
            description="Test description",
            tags=['test'],
            in_degree=5,
            out_degree=3,
            pagerank=0.02,
            betweenness_centrality=0.05,
            inherent_risk_score=6.0,
            residual_risk_score=3.0,
            blast_radius_score=5.0,
        )

        result = node.to_dict()

        assert result['id'] == str(node_id)
        assert result['name'] == "Test Asset"
        assert result['node_type'] == 'asset'
        assert result['criticality'] == 'high'
        assert result['source_type'] == 'Asset'
        assert result['source_id'] == str(source_id)
        assert result['description'] == "Test description"
        assert result['tags'] == ['test']
        assert result['metrics']['in_degree'] == 5
        assert result['metrics']['out_degree'] == 3
        assert result['metrics']['degree'] == 8
        assert result['metrics']['pagerank'] == 0.02
        assert result['risk']['blast_radius_score'] == 5.0
        assert result['is_critical'] is True
        assert result['is_hub'] is False

    def test_to_vis_node(self):
        node = SecurityNode(
            id=uuid4(),
            name="Production Database",
            node_type=NodeType.ASSET,
            criticality=NodeCriticality.CRITICAL,
            blast_radius_score=7.5,
        )

        result = node.to_vis_node()

        assert result['label'] == "Production Database"
        assert result['group'] == 'asset'
        assert result['color'] == '#4CAF50'  # Asset color
        assert result['size'] == 30  # Critical size
        assert 'Production Database' in result['title']
        assert result['criticality'] == 'critical'
        assert result['risk_score'] == 7.5

    def test_to_vis_node_different_types(self):
        # Test different node types have different colors
        types_and_colors = [
            (NodeType.ASSET, '#4CAF50'),
            (NodeType.CONTROL, '#2196F3'),
            (NodeType.RISK, '#F44336'),
            (NodeType.THREAT, '#FF9800'),
            (NodeType.VULNERABILITY, '#9C27B0'),
        ]

        for node_type, expected_color in types_and_colors:
            node = SecurityNode(
                id=uuid4(),
                name=f"Test {node_type.value}",
                node_type=node_type,
            )
            result = node.to_vis_node()
            assert result['color'] == expected_color

    def test_to_vis_node_criticality_sizes(self):
        # Test different criticality levels have different sizes
        criticality_and_sizes = [
            (NodeCriticality.CRITICAL, 30),
            (NodeCriticality.HIGH, 25),
            (NodeCriticality.MEDIUM, 20),
            (NodeCriticality.LOW, 15),
            (NodeCriticality.INFORMATIONAL, 10),
        ]

        for criticality, expected_size in criticality_and_sizes:
            node = SecurityNode(
                id=uuid4(),
                name="Test",
                node_type=NodeType.ASSET,
                criticality=criticality,
            )
            result = node.to_vis_node()
            assert result['size'] == expected_size


class TestSecurityNodeFactoryMethods:
    """Tests for SecurityNode factory methods."""

    def test_from_asset(self):
        mock_asset = MagicMock()
        mock_asset.id = uuid4()
        mock_asset.name = "Production Server"
        mock_asset.business_value = "high"
        mock_asset.description = "Main production server"
        mock_asset.tags = ['production', 'critical']

        node = SecurityNode.from_asset(mock_asset)

        assert node.id == mock_asset.id
        assert node.name == "Production Server"
        assert node.node_type == NodeType.ASSET
        assert node.criticality == NodeCriticality.HIGH
        assert node.source_type == 'Asset'
        assert node.source_id == mock_asset.id
        assert node.description == "Main production server"

    def test_from_asset_medium_criticality(self):
        mock_asset = MagicMock()
        mock_asset.id = uuid4()
        mock_asset.name = "Test Server"
        mock_asset.business_value = "medium"
        mock_asset.description = None
        del mock_asset.tags  # No tags attribute

        node = SecurityNode.from_asset(mock_asset)

        assert node.criticality == NodeCriticality.MEDIUM
        assert node.tags == []

    def test_from_control(self):
        mock_control = MagicMock()
        mock_control.id = uuid4()
        mock_control.name = "Access Control Policy"
        mock_control.description = "Policy for access management"

        node = SecurityNode.from_control(mock_control)

        assert node.id == mock_control.id
        assert node.name == "Access Control Policy"
        assert node.node_type == NodeType.CONTROL
        assert node.criticality == NodeCriticality.MEDIUM
        assert node.source_type == 'AppliedControl'

    def test_from_risk(self):
        mock_risk = MagicMock()
        mock_risk.id = uuid4()
        mock_risk.name = "Data Breach Risk"
        mock_risk.description = "Risk of data exposure"

        node = SecurityNode.from_risk(mock_risk)

        assert node.id == mock_risk.id
        assert node.name == "Data Breach Risk"
        assert node.node_type == NodeType.RISK
        assert node.criticality == NodeCriticality.HIGH
        assert node.source_type == 'RiskScenario'

    def test_from_threat(self):
        mock_threat = MagicMock()
        mock_threat.id = uuid4()
        mock_threat.name = "Ransomware Attack"
        mock_threat.description = "Ransomware threat"

        node = SecurityNode.from_threat(mock_threat)

        assert node.id == mock_threat.id
        assert node.name == "Ransomware Attack"
        assert node.node_type == NodeType.THREAT
        assert node.criticality == NodeCriticality.HIGH
        assert node.source_type == 'Threat'
