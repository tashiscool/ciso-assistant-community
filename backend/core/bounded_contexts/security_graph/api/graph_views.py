"""
Security Graph API Views

Provides REST API endpoints for security graph operations.
"""

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from uuid import UUID
import logging

from ..services import (
    get_graph_builder,
    get_blast_radius_analyzer,
    SecurityGraph,
)

logger = logging.getLogger(__name__)


def _get_accessible_domain_folder_ids(user, limit=None):
    """
    Resolve domain folders visible to the requesting user.

    Returns an empty list when no IAM scope is available.
    """
    from iam.models import Folder, RoleAssignment

    root_folder = Folder.get_root_folder()
    if not root_folder:
        return []

    folder_ids = list(
        RoleAssignment.get_accessible_folder_ids(
            root_folder,
            user,
            Folder.ContentType.DOMAIN,
        )
    )
    if limit is not None:
        return folder_ids[:limit]
    return folder_ids


def _user_can_access_domain_folder(user, folder_id):
    """Return True when a domain folder is inside the user's IAM scope."""
    return folder_id in set(_get_accessible_domain_folder_ids(user, limit=None))


def _parse_folder_uuid(folder_id):
    """Parse a folder identifier and return None when invalid."""
    try:
        return UUID(str(folder_id))
    except (TypeError, ValueError):
        return None


def _build_combined_graph_from_folder_ids(builder, folder_ids):
    """Build a merged graph from a sequence of domain folder IDs."""
    combined_graph = SecurityGraph()
    for folder_id in folder_ids:
        folder_graph = builder.build_from_folder(folder_id)
        for node in folder_graph.nodes.values():
            combined_graph.add_node(node)
        for edge in folder_graph.edges.values():
            combined_graph.add_edge(edge)
    return combined_graph


def _build_user_scoped_graph_or_none(user, builder=None):
    """
    Build a combined graph from IAM-accessible domain folders.

    Returns None when the user has no accessible domain folders.
    """
    folder_ids = _get_accessible_domain_folder_ids(user, limit=None)
    if not folder_ids:
        return None
    graph_builder = builder or get_graph_builder()
    return _build_combined_graph_from_folder_ids(graph_builder, folder_ids)


class SecurityGraphView(APIView):
    """Get the complete security graph."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Get the security graph for the user's accessible folders.

        Query parameters:
        - format: 'full' (default) or 'vis' (visualization format)
        - include_metrics: 'true' to include computed metrics
        """
        try:
            output_format = request.query_params.get('format', 'full')
            include_metrics = request.query_params.get('include_metrics', 'true') == 'true'

            # Build graph from the requesting user's IAM-scoped folders only.
            combined_graph = _build_user_scoped_graph_or_none(request.user)
            if combined_graph is None:
                empty_graph = SecurityGraph()
                if output_format == 'vis':
                    return Response(empty_graph.to_vis_format())
                return Response(empty_graph.to_dict())

            if include_metrics:
                combined_graph.compute_degrees()
                combined_graph.compute_pagerank()
                combined_graph.compute_betweenness_centrality()

            if output_format == 'vis':
                return Response(combined_graph.to_vis_format())
            return Response(combined_graph.to_dict())

        except Exception as e:
            logger.error(f"Error getting security graph: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SecurityGraphFromFolderView(APIView):
    """Build security graph from a specific folder."""
    permission_classes = [IsAuthenticated]

    def get(self, request, folder_id):
        """
        Build security graph from entities in a folder.

        Query parameters:
        - format: 'full' (default) or 'vis' (visualization format)
        """
        try:
            output_format = request.query_params.get('format', 'full')
            folder_uuid = _parse_folder_uuid(folder_id)
            if folder_uuid is None:
                return Response(
                    {'error': 'Invalid folder_id'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not _user_can_access_domain_folder(request.user, folder_uuid):
                return Response(
                    {'error': 'Access denied for requested folder'},
                    status=status.HTTP_403_FORBIDDEN,
                )

            builder = get_graph_builder()
            graph = builder.build_from_folder(folder_uuid)

            # Compute metrics
            graph.compute_degrees()
            graph.compute_pagerank()
            graph.compute_betweenness_centrality()

            if output_format == 'vis':
                return Response(graph.to_vis_format())
            return Response(graph.to_dict())

        except Exception as e:
            logger.error(f"Error building graph from folder: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SecurityGraphFromAssetsView(APIView):
    """Build security graph from specific assets."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Build security graph from specified assets.

        Request body:
        {
            "asset_ids": ["uuid1", "uuid2", ...],
            "include_related": true,
            "format": "full" or "vis"
        }
        """
        try:
            asset_ids = request.data.get('asset_ids', [])
            output_format = request.data.get('format', 'full')

            if not asset_ids:
                return Response(
                    {'error': 'asset_ids required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            builder = get_graph_builder()
            graph = builder.build_from_assets([UUID(aid) for aid in asset_ids])

            # Compute metrics
            graph.compute_degrees()
            graph.compute_pagerank()

            if output_format == 'vis':
                return Response(graph.to_vis_format())
            return Response(graph.to_dict())

        except Exception as e:
            logger.error(f"Error building graph from assets: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RiskGraphView(APIView):
    """Build risk-focused security graph."""
    permission_classes = [IsAuthenticated]

    def get(self, request, risk_assessment_id):
        """
        Build risk graph from a risk assessment.

        Query parameters:
        - format: 'full' (default) or 'vis' (visualization format)
        """
        try:
            output_format = request.query_params.get('format', 'full')

            builder = get_graph_builder()
            graph = builder.build_risk_graph(UUID(risk_assessment_id))

            # Compute metrics
            graph.compute_degrees()
            graph.compute_pagerank()
            graph.compute_betweenness_centrality()

            if output_format == 'vis':
                return Response(graph.to_vis_format())
            return Response(graph.to_dict())

        except Exception as e:
            logger.error(f"Error building risk graph: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class BlastRadiusView(APIView):
    """Analyze blast radius from a node."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Analyze blast radius from a source node.

        Request body:
        {
            "source_node_id": "uuid",
            "folder_id": "uuid" (optional - context for graph),
            "max_hops": 5,
            "propagation_threshold": 0.1
        }
        """
        try:
            source_node_id = request.data.get('source_node_id')
            folder_id = request.data.get('folder_id')
            max_hops = request.data.get('max_hops', 5)
            propagation_threshold = request.data.get('propagation_threshold', 0.1)

            if not source_node_id:
                return Response(
                    {'error': 'source_node_id required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Build graph context
            if folder_id:
                folder_uuid = _parse_folder_uuid(folder_id)
                if folder_uuid is None:
                    return Response(
                        {'error': 'Invalid folder_id'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if not _user_can_access_domain_folder(request.user, folder_uuid):
                    return Response(
                        {'error': 'Access denied for requested folder'},
                        status=status.HTTP_403_FORBIDDEN,
                    )
                builder = get_graph_builder()
                graph = builder.build_from_folder(folder_uuid)
            else:
                # Try to determine context from node
                from core.models import Asset
                try:
                    asset = Asset.objects.get(id=source_node_id)
                    if not _user_can_access_domain_folder(request.user, asset.folder_id):
                        return Response(
                            {'error': 'Access denied for requested folder'},
                            status=status.HTTP_403_FORBIDDEN,
                        )
                    builder = get_graph_builder()
                    graph = builder.build_from_folder(asset.folder_id)
                except Asset.DoesNotExist:
                    return Response(
                        {'error': 'Could not determine graph context. Provide folder_id.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # Analyze blast radius
            analyzer = get_blast_radius_analyzer()
            analyzer.max_hops = max_hops

            result = analyzer.analyze_blast_radius(
                graph,
                UUID(source_node_id),
                propagation_threshold=propagation_threshold,
            )

            return Response(result.to_dict())

        except Exception as e:
            logger.error(f"Error analyzing blast radius: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AttackPathsView(APIView):
    """Find attack paths between nodes."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Find potential attack paths between two nodes.

        Request body:
        {
            "entry_point_id": "uuid",
            "target_id": "uuid",
            "folder_id": "uuid" (optional),
            "max_paths": 5
        }
        """
        try:
            entry_point_id = request.data.get('entry_point_id')
            target_id = request.data.get('target_id')
            folder_id = request.data.get('folder_id')
            max_paths = request.data.get('max_paths', 5)

            if not entry_point_id or not target_id:
                return Response(
                    {'error': 'entry_point_id and target_id required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Build graph
            if folder_id:
                folder_uuid = _parse_folder_uuid(folder_id)
                if folder_uuid is None:
                    return Response(
                        {'error': 'Invalid folder_id'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if not _user_can_access_domain_folder(request.user, folder_uuid):
                    return Response(
                        {'error': 'Access denied for requested folder'},
                        status=status.HTTP_403_FORBIDDEN,
                    )
                builder = get_graph_builder()
                graph = builder.build_from_folder(folder_uuid)
            else:
                # Build graph from the requesting user's IAM-scoped folders only.
                graph = _build_user_scoped_graph_or_none(request.user)
                if graph is None:
                    return Response(
                        {'error': 'No accessible domain folders found'},
                        status=status.HTTP_403_FORBIDDEN,
                    )

            # Find attack paths
            analyzer = get_blast_radius_analyzer()
            paths = analyzer.find_attack_paths(
                graph,
                UUID(entry_point_id),
                UUID(target_id),
                max_paths=max_paths,
            )

            return Response({
                'paths': [p.to_dict() for p in paths],
                'total_paths': len(paths),
            })

        except Exception as e:
            logger.error(f"Error finding attack paths: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CriticalPathsView(APIView):
    """Identify critical attack paths in the graph."""
    permission_classes = [IsAuthenticated]

    def get(self, request, folder_id):
        """
        Identify the most critical attack paths in a folder's graph.

        Focuses on paths from threats/external systems to critical assets.
        """
        try:
            folder_uuid = _parse_folder_uuid(folder_id)
            if folder_uuid is None:
                return Response(
                    {'error': 'Invalid folder_id'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not _user_can_access_domain_folder(request.user, folder_uuid):
                return Response(
                    {'error': 'Access denied for requested folder'},
                    status=status.HTTP_403_FORBIDDEN,
                )

            builder = get_graph_builder()
            graph = builder.build_from_folder(folder_uuid)

            # Compute metrics needed for analysis
            graph.compute_degrees()
            graph.compute_pagerank()

            analyzer = get_blast_radius_analyzer()
            critical_paths = analyzer.identify_critical_paths(graph)

            return Response({
                'critical_paths': [p.to_dict() for p in critical_paths],
                'total_critical_paths': len(critical_paths),
            })

        except Exception as e:
            logger.error(f"Error identifying critical paths: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CriticalNodesView(APIView):
    """Find the most critical nodes in the graph."""
    permission_classes = [IsAuthenticated]

    def get(self, request, folder_id):
        """
        Find the most critical nodes in a folder's graph.

        Query parameters:
        - top_n: Number of nodes to return (default 10)
        - include_blast_radius: Calculate blast radius scores (default true)
        """
        try:
            top_n = int(request.query_params.get('top_n', 10))
            include_blast_radius = request.query_params.get('include_blast_radius', 'true') == 'true'
            folder_uuid = _parse_folder_uuid(folder_id)
            if folder_uuid is None:
                return Response(
                    {'error': 'Invalid folder_id'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not _user_can_access_domain_folder(request.user, folder_uuid):
                return Response(
                    {'error': 'Access denied for requested folder'},
                    status=status.HTTP_403_FORBIDDEN,
                )

            builder = get_graph_builder()
            graph = builder.build_from_folder(folder_uuid)

            # Compute all metrics
            graph.compute_degrees()
            graph.compute_pagerank()
            graph.compute_betweenness_centrality()

            if include_blast_radius:
                analyzer = get_blast_radius_analyzer()
                analyzer.calculate_node_blast_scores(graph)

            critical_nodes = graph.find_critical_nodes(top_n=top_n)

            return Response({
                'critical_nodes': [node.to_dict() for node in critical_nodes],
                'total_nodes': len(graph.nodes),
            })

        except Exception as e:
            logger.error(f"Error finding critical nodes: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ImpactSummaryView(APIView):
    """Get impact summary for multiple compromised nodes."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Get combined impact summary if multiple nodes are compromised.

        Request body:
        {
            "compromised_node_ids": ["uuid1", "uuid2", ...],
            "folder_id": "uuid"
        }
        """
        try:
            compromised_ids = request.data.get('compromised_node_ids', [])
            folder_id = request.data.get('folder_id')

            if not compromised_ids:
                return Response(
                    {'error': 'compromised_node_ids required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if not folder_id:
                return Response(
                    {'error': 'folder_id required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            folder_uuid = _parse_folder_uuid(folder_id)
            if folder_uuid is None:
                return Response(
                    {'error': 'Invalid folder_id'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not _user_can_access_domain_folder(request.user, folder_uuid):
                return Response(
                    {'error': 'Access denied for requested folder'},
                    status=status.HTTP_403_FORBIDDEN,
                )

            builder = get_graph_builder()
            graph = builder.build_from_folder(folder_uuid)

            analyzer = get_blast_radius_analyzer()
            summary = analyzer.get_impact_summary(
                graph,
                [UUID(nid) for nid in compromised_ids]
            )

            return Response(summary)

        except Exception as e:
            logger.error(f"Error getting impact summary: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GraphStatisticsView(APIView):
    """Get statistics about the security graph."""
    permission_classes = [IsAuthenticated]

    def get(self, request, folder_id):
        """
        Get detailed statistics about a folder's security graph.
        """
        try:
            folder_uuid = _parse_folder_uuid(folder_id)
            if folder_uuid is None:
                return Response(
                    {'error': 'Invalid folder_id'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not _user_can_access_domain_folder(request.user, folder_uuid):
                return Response(
                    {'error': 'Access denied for requested folder'},
                    status=status.HTTP_403_FORBIDDEN,
                )

            builder = get_graph_builder()
            graph = builder.build_from_folder(folder_uuid)

            # Compute all metrics
            graph.compute_degrees()
            graph.compute_pagerank()
            graph.compute_betweenness_centrality()

            # Calculate statistics
            node_count = len(graph.nodes)
            edge_count = len(graph.edges)

            # Degree distribution
            degrees = [n.degree for n in graph.nodes.values()]
            avg_degree = sum(degrees) / len(degrees) if degrees else 0
            max_degree = max(degrees) if degrees else 0

            # Centrality stats
            pageranks = [n.pagerank for n in graph.nodes.values()]
            betweenness = [n.betweenness_centrality for n in graph.nodes.values()]

            # Hub and critical counts
            hub_count = sum(1 for n in graph.nodes.values() if n.is_hub)
            critical_count = sum(1 for n in graph.nodes.values() if n.is_critical)

            return Response({
                'node_count': node_count,
                'edge_count': edge_count,
                'node_types': graph._count_node_types(),
                'edge_types': graph._count_edge_types(),
                'degree_stats': {
                    'average': avg_degree,
                    'max': max_degree,
                    'distribution': {str(i): degrees.count(i) for i in set(degrees)},
                },
                'centrality_stats': {
                    'max_pagerank': max(pageranks) if pageranks else 0,
                    'max_betweenness': max(betweenness) if betweenness else 0,
                },
                'hub_count': hub_count,
                'critical_node_count': critical_count,
                'density': (2 * edge_count) / (node_count * (node_count - 1)) if node_count > 1 else 0,
            })

        except Exception as e:
            logger.error(f"Error getting graph statistics: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
