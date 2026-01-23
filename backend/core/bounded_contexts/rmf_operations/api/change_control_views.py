"""
Change Control and Incident Response API Views

API endpoints for managing Significant Change Requests and Security Incidents.
"""

from uuid import UUID
from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes

from ..aggregates import SignificantChangeRequest, SecurityIncident


class SignificantChangeRequestViewSet(viewsets.ViewSet):
    """
    ViewSet for managing Significant Change Requests.

    Implements the FedRAMP managed change control workflow including
    impact analysis, SCN determination, and approval tracking.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="List Significant Change Requests",
        description="Retrieve a list of significant change requests, optionally filtered by CSO or status.",
        parameters=[
            OpenApiParameter(
                name='cso_id',
                description='Filter by Cloud Service Offering ID',
                required=False,
                type=OpenApiTypes.UUID,
            ),
            OpenApiParameter(
                name='status',
                description='Filter by status',
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name='scn_required',
                description='Filter by SCN requirement',
                required=False,
                type=bool,
            ),
        ],
        responses={200: dict},
        tags=['Change Control'],
    )
    def list(self, request):
        """List change requests."""
        cso_id = request.query_params.get('cso_id')
        status_filter = request.query_params.get('status')
        scn_required = request.query_params.get('scn_required')

        try:
            queryset = SignificantChangeRequest.objects.all()

            if cso_id:
                queryset = queryset.filter(cloud_service_offering_id=UUID(cso_id))
            if status_filter:
                queryset = queryset.filter(status=status_filter)
            if scn_required is not None:
                queryset = queryset.filter(scn_required=scn_required.lower() == 'true')

            changes = []
            for change in queryset[:100]:  # Limit to 100
                changes.append(change.get_status_summary())

            return Response({
                'success': True,
                'data': changes,
                'count': len(changes),
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @extend_schema(
        summary="Create Significant Change Request",
        description="Create a new significant change request.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'cso_id': {'type': 'string', 'format': 'uuid'},
                    'title': {'type': 'string'},
                    'description': {'type': 'string'},
                    'change_type': {'type': 'string'},
                    'requestor_name': {'type': 'string'},
                    'planned_implementation_date': {'type': 'string', 'format': 'date'},
                },
                'required': ['cso_id', 'title', 'description', 'change_type', 'requestor_name'],
            }
        },
        responses={201: dict},
        tags=['Change Control'],
    )
    def create(self, request):
        """Create a new change request."""
        try:
            data = request.data
            cso_id = UUID(data['cso_id'])

            from datetime import datetime
            planned_date = None
            if 'planned_implementation_date' in data and data['planned_implementation_date']:
                planned_date = datetime.strptime(data['planned_implementation_date'], '%Y-%m-%d').date()

            change = SignificantChangeRequest.create(
                cso_id=cso_id,
                title=data['title'],
                description=data['description'],
                change_type=data['change_type'],
                requestor_name=data['requestor_name'],
                planned_date=planned_date,
                created_by=request.user.id if hasattr(request, 'user') else None
            )
            change.save()

            return Response({
                'success': True,
                'data': {
                    'id': str(change.id),
                    'change_number': change.change_number,
                    **change.get_status_summary()
                }
            }, status=status.HTTP_201_CREATED)

        except KeyError as e:
            return Response({
                'success': False,
                'error': f'Missing required field: {str(e)}',
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @extend_schema(
        summary="Get Significant Change Request",
        description="Retrieve a specific significant change request by ID.",
        responses={200: dict},
        tags=['Change Control'],
    )
    def retrieve(self, request, pk=None):
        """Get a specific change request."""
        try:
            change = SignificantChangeRequest.objects.get(id=UUID(pk))
            return Response({
                'success': True,
                'data': {
                    'id': str(change.id),
                    'change_number': change.change_number,
                    'title': change.title,
                    'description': change.description,
                    'change_type': change.change_type,
                    'status': change.status,
                    'scn_category': change.scn_category,
                    'scn_required': change.scn_required,
                    'scn_reference_number': change.scn_reference_number,
                    'impact_level': change.impact_level,
                    'impact_analysis': change.impact_analysis,
                    'affected_ksi_ids': change.affected_ksi_ids,
                    'affected_control_ids': change.affected_control_ids,
                    'risk_delta': change.risk_delta,
                    'requestor_name': change.requestor_name,
                    'planned_implementation_date': str(change.planned_implementation_date) if change.planned_implementation_date else None,
                    'actual_implementation_date': str(change.actual_implementation_date) if change.actual_implementation_date else None,
                    'security_review_completed': change.security_review_completed,
                    'verification_completed': change.verification_completed,
                    'audit_trail': change.audit_trail,
                    'created_at': change.created_at.isoformat() if change.created_at else None,
                    'updated_at': change.updated_at.isoformat() if change.updated_at else None,
                }
            })

        except SignificantChangeRequest.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Change request not found',
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    @extend_schema(
        summary="Submit Change Request for Review",
        description="Submit the change request for impact analysis review.",
        tags=['Change Control'],
    )
    def submit(self, request, pk=None):
        """Submit change request for review."""
        try:
            change = SignificantChangeRequest.objects.get(id=UUID(pk))
            change.submit_for_review()
            change.save()

            return Response({
                'success': True,
                'data': change.get_status_summary()
            })

        except SignificantChangeRequest.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Change request not found',
            }, status=status.HTTP_404_NOT_FOUND)
        except ValueError as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    @extend_schema(
        summary="Complete Impact Analysis",
        description="Complete impact analysis for the change request.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'impact_level': {'type': 'string'},
                    'affected_components': {'type': 'array', 'items': {'type': 'string'}},
                    'affected_ksi_ids': {'type': 'array', 'items': {'type': 'string'}},
                    'affected_control_ids': {'type': 'array', 'items': {'type': 'string'}},
                    'analysis_details': {'type': 'object'},
                    'risk_before': {'type': 'string'},
                    'risk_after': {'type': 'string'},
                    'risk_delta': {'type': 'string'},
                    'mitigation': {'type': 'string'},
                    'analyst': {'type': 'string'},
                },
                'required': ['impact_level'],
            }
        },
        tags=['Change Control'],
    )
    def complete_impact_analysis(self, request, pk=None):
        """Complete impact analysis."""
        try:
            data = request.data
            change = SignificantChangeRequest.objects.get(id=UUID(pk))

            # Start impact analysis if not already started
            if change.status == SignificantChangeRequest.ChangeStatus.SUBMITTED:
                change.start_impact_analysis(analyst=data.get('analyst'))

            change.complete_impact_analysis(
                impact_level=data['impact_level'],
                affected_components=data.get('affected_components'),
                affected_ksi_ids=data.get('affected_ksi_ids'),
                affected_control_ids=data.get('affected_control_ids'),
                analysis_details=data.get('analysis_details'),
                risk_before=data.get('risk_before'),
                risk_after=data.get('risk_after'),
                risk_delta=data.get('risk_delta'),
                mitigation=data.get('mitigation'),
                analyst=data.get('analyst')
            )
            change.save()

            return Response({
                'success': True,
                'data': change.get_status_summary()
            })

        except SignificantChangeRequest.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Change request not found',
            }, status=status.HTTP_404_NOT_FOUND)
        except ValueError as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    @extend_schema(
        summary="Determine SCN Requirement",
        description="Determine whether SCN is required for the change.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'scn_required': {'type': 'boolean'},
                    'scn_category': {'type': 'string'},
                    'rationale': {'type': 'string'},
                },
                'required': ['scn_required'],
            }
        },
        tags=['Change Control'],
    )
    def determine_scn(self, request, pk=None):
        """Determine SCN requirement."""
        try:
            data = request.data
            change = SignificantChangeRequest.objects.get(id=UUID(pk))

            change.determine_scn_required(
                scn_required=data['scn_required'],
                scn_category=data.get('scn_category'),
                rationale=data.get('rationale')
            )
            change.save()

            return Response({
                'success': True,
                'data': change.get_status_summary()
            })

        except SignificantChangeRequest.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Change request not found',
            }, status=status.HTTP_404_NOT_FOUND)
        except ValueError as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    @extend_schema(
        summary="Submit SCN to FedRAMP",
        description="Record submission of SCN to FedRAMP.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'scn_reference': {'type': 'string'},
                },
            }
        },
        tags=['Change Control'],
    )
    def submit_scn(self, request, pk=None):
        """Submit SCN to FedRAMP."""
        try:
            data = request.data
            change = SignificantChangeRequest.objects.get(id=UUID(pk))

            change.submit_scn(scn_reference=data.get('scn_reference'))
            change.save()

            return Response({
                'success': True,
                'data': change.get_status_summary()
            })

        except SignificantChangeRequest.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Change request not found',
            }, status=status.HTTP_404_NOT_FOUND)
        except ValueError as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    @extend_schema(
        summary="Approve Change Request",
        description="Approve the change request for implementation.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'approver': {'type': 'string'},
                    'notes': {'type': 'string'},
                },
                'required': ['approver'],
            }
        },
        tags=['Change Control'],
    )
    def approve(self, request, pk=None):
        """Approve change request."""
        try:
            data = request.data
            change = SignificantChangeRequest.objects.get(id=UUID(pk))

            change.approve(
                approver=data['approver'],
                notes=data.get('notes')
            )
            change.save()

            return Response({
                'success': True,
                'data': change.get_status_summary()
            })

        except SignificantChangeRequest.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Change request not found',
            }, status=status.HTTP_404_NOT_FOUND)
        except ValueError as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    @extend_schema(
        summary="Mark Change as Implemented",
        description="Mark the change request as implemented.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'implementation_date': {'type': 'string', 'format': 'date'},
                    'notes': {'type': 'string'},
                },
            }
        },
        tags=['Change Control'],
    )
    def implement(self, request, pk=None):
        """Mark change as implemented."""
        try:
            data = request.data
            change = SignificantChangeRequest.objects.get(id=UUID(pk))

            from datetime import datetime
            impl_date = None
            if 'implementation_date' in data and data['implementation_date']:
                impl_date = datetime.strptime(data['implementation_date'], '%Y-%m-%d').date()

            change.mark_implemented(
                implementation_date=impl_date,
                notes=data.get('notes')
            )
            change.save()

            return Response({
                'success': True,
                'data': change.get_status_summary()
            })

        except SignificantChangeRequest.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Change request not found',
            }, status=status.HTTP_404_NOT_FOUND)
        except ValueError as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SecurityIncidentViewSet(viewsets.ViewSet):
    """
    ViewSet for managing Security Incidents.

    Implements the incident response lifecycle with US-CERT/CISA
    reporting tracking.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="List Security Incidents",
        description="Retrieve a list of security incidents, optionally filtered.",
        parameters=[
            OpenApiParameter(
                name='cso_id',
                description='Filter by Cloud Service Offering ID',
                required=False,
                type=OpenApiTypes.UUID,
            ),
            OpenApiParameter(
                name='status',
                description='Filter by status',
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name='severity',
                description='Filter by severity',
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name='open_only',
                description='Filter to only open incidents',
                required=False,
                type=bool,
            ),
        ],
        responses={200: dict},
        tags=['Incident Response'],
    )
    def list(self, request):
        """List incidents."""
        cso_id = request.query_params.get('cso_id')
        status_filter = request.query_params.get('status')
        severity = request.query_params.get('severity')
        open_only = request.query_params.get('open_only')

        try:
            queryset = SecurityIncident.objects.all()

            if cso_id:
                queryset = queryset.filter(cloud_service_offering_id=UUID(cso_id))
            if status_filter:
                queryset = queryset.filter(status=status_filter)
            if severity:
                queryset = queryset.filter(severity=severity)
            if open_only and open_only.lower() == 'true':
                queryset = queryset.exclude(status=SecurityIncident.IncidentStatus.CLOSED)

            incidents = []
            for incident in queryset[:100]:  # Limit to 100
                incidents.append(incident.get_status_summary())

            return Response({
                'success': True,
                'data': incidents,
                'count': len(incidents),
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @extend_schema(
        summary="Create Security Incident",
        description="Create a new security incident.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'cso_id': {'type': 'string', 'format': 'uuid'},
                    'title': {'type': 'string'},
                    'description': {'type': 'string'},
                    'category': {'type': 'string'},
                    'severity': {'type': 'string'},
                    'detected_at': {'type': 'string', 'format': 'date-time'},
                    'detection_method': {'type': 'string'},
                    'detected_by': {'type': 'string'},
                },
                'required': ['cso_id', 'title', 'description', 'category', 'severity'],
            }
        },
        responses={201: dict},
        tags=['Incident Response'],
    )
    def create(self, request):
        """Create a new incident."""
        try:
            data = request.data
            cso_id = UUID(data['cso_id'])

            from django.utils import timezone
            from datetime import datetime
            detected_at = None
            if 'detected_at' in data and data['detected_at']:
                detected_at = datetime.fromisoformat(data['detected_at'].replace('Z', '+00:00'))
            else:
                detected_at = timezone.now()

            incident = SecurityIncident.create(
                cso_id=cso_id,
                title=data['title'],
                description=data['description'],
                category=data['category'],
                severity=data['severity'],
                detected_at=detected_at,
                detection_method=data.get('detection_method'),
                detected_by=data.get('detected_by'),
                created_by=request.user.id if hasattr(request, 'user') else None
            )
            incident.save()

            return Response({
                'success': True,
                'data': {
                    'id': str(incident.id),
                    'incident_number': incident.incident_number,
                    'uscert_reporting_deadline': incident.uscert_reporting_deadline.isoformat() if incident.uscert_reporting_deadline else None,
                    **incident.get_status_summary()
                }
            }, status=status.HTTP_201_CREATED)

        except KeyError as e:
            return Response({
                'success': False,
                'error': f'Missing required field: {str(e)}',
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @extend_schema(
        summary="Get Security Incident",
        description="Retrieve a specific security incident by ID.",
        responses={200: dict},
        tags=['Incident Response'],
    )
    def retrieve(self, request, pk=None):
        """Get a specific incident."""
        try:
            incident = SecurityIncident.objects.get(id=UUID(pk))
            return Response({
                'success': True,
                'data': {
                    'id': str(incident.id),
                    'incident_number': incident.incident_number,
                    'title': incident.title,
                    'description': incident.description,
                    'category': incident.category,
                    'subcategory': incident.subcategory,
                    'severity': incident.severity,
                    'status': incident.status,
                    'data_classification': incident.data_classification,
                    'detected_at': incident.detected_at.isoformat() if incident.detected_at else None,
                    'detection_method': incident.detection_method,
                    'detected_by': incident.detected_by,
                    'contained_at': incident.contained_at.isoformat() if incident.contained_at else None,
                    'eradicated_at': incident.eradicated_at.isoformat() if incident.eradicated_at else None,
                    'recovered_at': incident.recovered_at.isoformat() if incident.recovered_at else None,
                    'closed_at': incident.closed_at.isoformat() if incident.closed_at else None,
                    'impact_description': incident.impact_description,
                    'affected_systems': incident.affected_systems,
                    'affected_users_count': incident.affected_users_count,
                    'affected_records_count': incident.affected_records_count,
                    'data_exfiltrated': incident.data_exfiltrated,
                    'service_disruption': incident.service_disruption,
                    'attack_vector': incident.attack_vector,
                    'threat_actor': incident.threat_actor,
                    'indicators_of_compromise': incident.indicators_of_compromise,
                    'mitre_attack_techniques': incident.mitre_attack_techniques,
                    'uscert_reporting_status': incident.uscert_reporting_status,
                    'uscert_reporting_deadline': incident.uscert_reporting_deadline.isoformat() if incident.uscert_reporting_deadline else None,
                    'uscert_case_number': incident.uscert_case_number,
                    'is_reporting_overdue': incident.is_reporting_overdue(),
                    'incident_commander': incident.incident_commander,
                    'response_team': incident.response_team,
                    'containment_actions': incident.containment_actions,
                    'eradication_actions': incident.eradication_actions,
                    'recovery_actions': incident.recovery_actions,
                    'root_cause': incident.root_cause,
                    'lessons_learned': incident.lessons_learned,
                    'recommendations': incident.recommendations,
                    'timeline': incident.timeline,
                    'time_to_contain_hours': incident.time_to_contain(),
                    'time_to_resolve_hours': incident.time_to_resolve(),
                    'created_at': incident.created_at.isoformat() if incident.created_at else None,
                }
            })

        except SecurityIncident.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Incident not found',
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    @extend_schema(
        summary="Begin Incident Analysis",
        description="Begin analysis of the incident.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'commander': {'type': 'string'},
                    'team': {'type': 'array', 'items': {'type': 'string'}},
                },
            }
        },
        tags=['Incident Response'],
    )
    def begin_analysis(self, request, pk=None):
        """Begin incident analysis."""
        try:
            data = request.data
            incident = SecurityIncident.objects.get(id=UUID(pk))

            incident.begin_analysis(
                commander=data.get('commander'),
                team=data.get('team')
            )
            incident.save()

            return Response({
                'success': True,
                'data': incident.get_status_summary()
            })

        except SecurityIncident.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Incident not found',
            }, status=status.HTTP_404_NOT_FOUND)
        except ValueError as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    @extend_schema(
        summary="Record Containment",
        description="Record that the incident has been contained.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'actions': {'type': 'array', 'items': {'type': 'string'}},
                    'effectiveness': {'type': 'string'},
                    'contained_by': {'type': 'string'},
                },
                'required': ['actions'],
            }
        },
        tags=['Incident Response'],
    )
    def contain(self, request, pk=None):
        """Record containment."""
        try:
            data = request.data
            incident = SecurityIncident.objects.get(id=UUID(pk))

            incident.record_containment(
                actions=data['actions'],
                effectiveness=data.get('effectiveness', 'unknown'),
                contained_by=data.get('contained_by')
            )
            incident.save()

            return Response({
                'success': True,
                'data': incident.get_status_summary()
            })

        except SecurityIncident.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Incident not found',
            }, status=status.HTTP_404_NOT_FOUND)
        except ValueError as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    @extend_schema(
        summary="Record Eradication",
        description="Record that the threat has been eradicated.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'actions': {'type': 'array', 'items': {'type': 'string'}},
                    'root_cause': {'type': 'string'},
                    'eradicated_by': {'type': 'string'},
                },
                'required': ['actions'],
            }
        },
        tags=['Incident Response'],
    )
    def eradicate(self, request, pk=None):
        """Record eradication."""
        try:
            data = request.data
            incident = SecurityIncident.objects.get(id=UUID(pk))

            incident.record_eradication(
                actions=data['actions'],
                root_cause=data.get('root_cause'),
                eradicated_by=data.get('eradicated_by')
            )
            incident.save()

            return Response({
                'success': True,
                'data': incident.get_status_summary()
            })

        except SecurityIncident.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Incident not found',
            }, status=status.HTTP_404_NOT_FOUND)
        except ValueError as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    @extend_schema(
        summary="Record Recovery",
        description="Record that systems have been recovered.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'actions': {'type': 'array', 'items': {'type': 'string'}},
                    'verification': {'type': 'string'},
                    'recovered_by': {'type': 'string'},
                },
                'required': ['actions'],
            }
        },
        tags=['Incident Response'],
    )
    def recover(self, request, pk=None):
        """Record recovery."""
        try:
            data = request.data
            incident = SecurityIncident.objects.get(id=UUID(pk))

            incident.record_recovery(
                actions=data['actions'],
                verification=data.get('verification'),
                recovered_by=data.get('recovered_by')
            )
            incident.save()

            return Response({
                'success': True,
                'data': incident.get_status_summary()
            })

        except SecurityIncident.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Incident not found',
            }, status=status.HTTP_404_NOT_FOUND)
        except ValueError as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    @extend_schema(
        summary="Submit US-CERT Initial Report",
        description="Record submission of initial report to US-CERT/CISA.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'case_number': {'type': 'string'},
                },
            }
        },
        tags=['Incident Response'],
    )
    def submit_uscert_report(self, request, pk=None):
        """Submit US-CERT report."""
        try:
            data = request.data
            incident = SecurityIncident.objects.get(id=UUID(pk))

            incident.submit_uscert_initial_report(
                case_number=data.get('case_number')
            )
            incident.save()

            return Response({
                'success': True,
                'data': incident.get_status_summary()
            })

        except SecurityIncident.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Incident not found',
            }, status=status.HTTP_404_NOT_FOUND)
        except ValueError as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    @extend_schema(
        summary="Close Incident",
        description="Close the security incident.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'closed_by': {'type': 'string'},
                    'notes': {'type': 'string'},
                },
            }
        },
        tags=['Incident Response'],
    )
    def close(self, request, pk=None):
        """Close incident."""
        try:
            data = request.data
            incident = SecurityIncident.objects.get(id=UUID(pk))

            incident.close(
                closed_by=data.get('closed_by'),
                notes=data.get('notes')
            )
            incident.save()

            return Response({
                'success': True,
                'data': incident.get_status_summary()
            })

        except SecurityIncident.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Incident not found',
            }, status=status.HTTP_404_NOT_FOUND)
        except ValueError as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class IncidentDashboardView(APIView):
    """Dashboard view for incident response metrics."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Incident Response Dashboard",
        description="Get incident response metrics and statistics.",
        parameters=[
            OpenApiParameter(
                name='cso_id',
                description='Filter by Cloud Service Offering ID',
                required=False,
                type=OpenApiTypes.UUID,
            ),
        ],
        responses={200: dict},
        tags=['Incident Response'],
    )
    def get(self, request):
        """Get incident dashboard data."""
        cso_id = request.query_params.get('cso_id')

        try:
            queryset = SecurityIncident.objects.all()
            if cso_id:
                queryset = queryset.filter(cloud_service_offering_id=UUID(cso_id))

            # Calculate metrics
            total = queryset.count()
            open_incidents = queryset.exclude(status=SecurityIncident.IncidentStatus.CLOSED).count()

            # By severity
            by_severity = {}
            for sev in SecurityIncident.IncidentSeverity.values:
                by_severity[sev] = queryset.filter(severity=sev).count()

            # By status
            by_status = {}
            for stat in SecurityIncident.IncidentStatus.values:
                by_status[stat] = queryset.filter(status=stat).count()

            # Overdue reporting
            overdue_reporting = []
            for incident in queryset.filter(
                uscert_reporting_status=SecurityIncident.ReportingStatus.PENDING
            ):
                if incident.is_reporting_overdue():
                    overdue_reporting.append({
                        'incident_number': incident.incident_number,
                        'title': incident.title,
                        'severity': incident.severity,
                        'deadline': incident.uscert_reporting_deadline.isoformat() if incident.uscert_reporting_deadline else None,
                    })

            # Calculate average metrics
            closed_incidents = queryset.filter(status=SecurityIncident.IncidentStatus.CLOSED)
            avg_time_to_contain = None
            avg_time_to_resolve = None

            contain_times = [i.time_to_contain() for i in closed_incidents if i.time_to_contain()]
            resolve_times = [i.time_to_resolve() for i in closed_incidents if i.time_to_resolve()]

            if contain_times:
                avg_time_to_contain = sum(contain_times) / len(contain_times)
            if resolve_times:
                avg_time_to_resolve = sum(resolve_times) / len(resolve_times)

            return Response({
                'success': True,
                'data': {
                    'total_incidents': total,
                    'open_incidents': open_incidents,
                    'by_severity': by_severity,
                    'by_status': by_status,
                    'overdue_uscert_reporting': overdue_reporting,
                    'overdue_count': len(overdue_reporting),
                    'avg_time_to_contain_hours': avg_time_to_contain,
                    'avg_time_to_resolve_hours': avg_time_to_resolve,
                }
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ChangeControlDashboardView(APIView):
    """Dashboard view for change control metrics."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Change Control Dashboard",
        description="Get change control metrics and statistics.",
        parameters=[
            OpenApiParameter(
                name='cso_id',
                description='Filter by Cloud Service Offering ID',
                required=False,
                type=OpenApiTypes.UUID,
            ),
        ],
        responses={200: dict},
        tags=['Change Control'],
    )
    def get(self, request):
        """Get change control dashboard data."""
        cso_id = request.query_params.get('cso_id')

        try:
            queryset = SignificantChangeRequest.objects.all()
            if cso_id:
                queryset = queryset.filter(cloud_service_offering_id=UUID(cso_id))

            # Calculate metrics
            total = queryset.count()

            # By status
            by_status = {}
            for stat in SignificantChangeRequest.ChangeStatus.values:
                by_status[stat] = queryset.filter(status=stat).count()

            # By change type
            by_type = {}
            for ctype in SignificantChangeRequest.ChangeType.values:
                by_type[ctype] = queryset.filter(change_type=ctype).count()

            # SCN metrics
            scn_required = queryset.filter(scn_required=True).count()
            scn_submitted = queryset.filter(
                status__in=[
                    SignificantChangeRequest.ChangeStatus.SCN_SUBMITTED,
                    SignificantChangeRequest.ChangeStatus.SCN_ACKNOWLEDGED,
                    SignificantChangeRequest.ChangeStatus.APPROVED,
                    SignificantChangeRequest.ChangeStatus.IMPLEMENTED,
                ]
            ).filter(scn_required=True).count()

            # Pending changes requiring action
            pending_review = queryset.filter(
                status__in=[
                    SignificantChangeRequest.ChangeStatus.SUBMITTED,
                    SignificantChangeRequest.ChangeStatus.IMPACT_ANALYSIS,
                ]
            ).count()

            pending_scn = queryset.filter(
                status=SignificantChangeRequest.ChangeStatus.SCN_REQUIRED
            ).count()

            pending_approval = queryset.filter(
                status__in=[
                    SignificantChangeRequest.ChangeStatus.IMPACT_ASSESSED,
                    SignificantChangeRequest.ChangeStatus.SCN_NOT_REQUIRED,
                    SignificantChangeRequest.ChangeStatus.SCN_ACKNOWLEDGED,
                ]
            ).count()

            return Response({
                'success': True,
                'data': {
                    'total_changes': total,
                    'by_status': by_status,
                    'by_type': by_type,
                    'scn_required_count': scn_required,
                    'scn_submitted_count': scn_submitted,
                    'pending_review': pending_review,
                    'pending_scn_submission': pending_scn,
                    'pending_approval': pending_approval,
                }
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
