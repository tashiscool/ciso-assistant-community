"""
Compliance Views - MIT Licensed

Clean-room implementation of compliance API views.
Copyright (c) 2026 Tash
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, Avg, Q
from django.utils import timezone

from ..models_mit import (
    ComplianceRequirement,
    RequirementAssessment,
    Audit,
    Finding,
    Evidence,
    ComplianceException,
)
from ..serializers_mit import (
    ComplianceRequirementSerializer,
    RequirementAssessmentSerializer,
    AuditSerializer,
    AuditListSerializer,
    FindingSerializer,
    FindingListSerializer,
    EvidenceSerializer,
    ComplianceExceptionSerializer,
)


class IsAdminOrReadOnly(permissions.BasePermission):
    """Allow read-only for authenticated, write for admins."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_staff


class ComplianceRequirementViewSet(viewsets.ModelViewSet):
    """
    API endpoint for compliance requirement management.
    """
    queryset = ComplianceRequirement.objects.all()
    serializer_class = ComplianceRequirementSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        framework_id = self.request.query_params.get('framework_id')
        if framework_id:
            queryset = queryset.filter(framework_id=framework_id)
        req_type = self.request.query_params.get('type')
        if req_type:
            queryset = queryset.filter(requirement_type=req_type)
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(requirement_id__icontains=search) |
                Q(name__icontains=search) |
                Q(requirement_text__icontains=search)
            )
        return queryset.order_by('order')


class RequirementAssessmentViewSet(viewsets.ModelViewSet):
    """
    API endpoint for requirement assessment management.
    """
    queryset = RequirementAssessment.objects.all()
    serializer_class = RequirementAssessmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        requirement_id = self.request.query_params.get('requirement_id')
        if requirement_id:
            queryset = queryset.filter(requirement_id=requirement_id)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get compliance statistics."""
        queryset = self.get_queryset()
        stats = {
            'total': queryset.count(),
            'by_status': list(
                queryset.values('status')
                .annotate(count=Count('id'))
            ),
            'avg_score': queryset.aggregate(avg=Avg('compliance_score'))['avg'],
            'compliant': queryset.filter(status='compliant').count(),
            'non_compliant': queryset.filter(status='non_compliant').count(),
        }
        return Response(stats)

    @action(detail=False, methods=['get'])
    def gaps(self, request):
        """Get requirements with gaps identified."""
        queryset = self.get_queryset()
        with_gaps = queryset.exclude(
            Q(gaps_identified='') | Q(gaps_identified__isnull=True)
        )
        serializer = RequirementAssessmentSerializer(with_gaps, many=True)
        return Response(serializer.data)


class AuditViewSet(viewsets.ModelViewSet):
    """
    API endpoint for audit management.
    """
    queryset = Audit.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return AuditListSerializer
        return AuditSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        audit_type = self.request.query_params.get('type')
        if audit_type:
            queryset = queryset.filter(audit_type=audit_type)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Start an audit."""
        audit = self.get_object()
        audit.status = 'in_progress'
        audit.actual_start_date = timezone.now().date()
        audit.save()
        return Response({'message': 'Audit started'})

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Complete an audit."""
        audit = self.get_object()
        audit.status = 'completed'
        audit.actual_end_date = timezone.now().date()
        audit.save()
        return Response({'message': 'Audit completed'})

    @action(detail=True, methods=['get'])
    def findings(self, request, pk=None):
        """Get all findings for this audit."""
        audit = self.get_object()
        findings = audit.findings.all()
        serializer = FindingListSerializer(findings, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Get upcoming audits."""
        queryset = self.get_queryset()
        today = timezone.now().date()
        upcoming = queryset.filter(
            planned_start_date__gte=today,
            status='planned'
        ).order_by('planned_start_date')[:10]
        serializer = AuditListSerializer(upcoming, many=True)
        return Response(serializer.data)


class FindingViewSet(viewsets.ModelViewSet):
    """
    API endpoint for finding management.
    """
    queryset = Finding.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return FindingListSerializer
        return FindingSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        audit_id = self.request.query_params.get('audit_id')
        if audit_id:
            queryset = queryset.filter(audit_id=audit_id)
        finding_type = self.request.query_params.get('type')
        if finding_type:
            queryset = queryset.filter(finding_type=finding_type)
        severity = self.request.query_params.get('severity')
        if severity:
            queryset = queryset.filter(severity=severity)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    @action(detail=True, methods=['post'])
    def remediate(self, request, pk=None):
        """Mark finding as remediated."""
        finding = self.get_object()
        finding.status = 'remediated'
        finding.remediation_date = timezone.now().date()
        finding.remediation_notes = request.data.get('notes', '')
        finding.save()
        return Response({'message': 'Finding marked as remediated'})

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """Verify finding closure."""
        finding = self.get_object()
        finding.status = 'verified'
        finding.verification_date = timezone.now().date()
        finding.save()
        return Response({'message': 'Finding verified as closed'})

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get overdue findings."""
        queryset = self.get_queryset()
        today = timezone.now().date()
        overdue = queryset.filter(
            due_date__lt=today,
            status__in=['open', 'in_progress']
        ).order_by('due_date')
        serializer = FindingListSerializer(overdue, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get finding statistics."""
        queryset = self.get_queryset()
        stats = {
            'total': queryset.count(),
            'open': queryset.filter(status='open').count(),
            'by_status': list(
                queryset.values('status')
                .annotate(count=Count('id'))
            ),
            'by_severity': list(
                queryset.values('severity')
                .annotate(count=Count('id'))
            ),
            'by_type': list(
                queryset.values('finding_type')
                .annotate(count=Count('id'))
            ),
        }
        return Response(stats)


class EvidenceViewSet(viewsets.ModelViewSet):
    """
    API endpoint for evidence management.
    """
    queryset = Evidence.objects.all()
    serializer_class = EvidenceSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        evidence_type = self.request.query_params.get('type')
        if evidence_type:
            queryset = queryset.filter(evidence_type=evidence_type)
        return queryset

    @action(detail=False, methods=['get'])
    def expiring(self, request):
        """Get evidence expiring soon."""
        queryset = self.get_queryset()
        today = timezone.now().date()
        from datetime import timedelta
        expiring_soon = queryset.filter(
            valid_until__lte=today + timedelta(days=30),
            valid_until__gte=today
        ).order_by('valid_until')
        serializer = EvidenceSerializer(expiring_soon, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def expired(self, request):
        """Get expired evidence."""
        queryset = self.get_queryset()
        today = timezone.now().date()
        expired = queryset.filter(valid_until__lt=today).order_by('-valid_until')
        serializer = EvidenceSerializer(expired, many=True)
        return Response(serializer.data)


class ComplianceExceptionViewSet(viewsets.ModelViewSet):
    """
    API endpoint for compliance exception management.
    """
    queryset = ComplianceException.objects.all()
    serializer_class = ComplianceExceptionSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    def perform_create(self, serializer):
        serializer.save(requester=self.request.user)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve an exception."""
        exception = self.get_object()
        exception.status = 'approved'
        exception.approval_date = timezone.now().date()
        exception.approver = request.user
        exception.save()
        return Response({'message': 'Exception approved'})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject an exception."""
        exception = self.get_object()
        exception.status = 'rejected'
        exception.save()
        return Response({'message': 'Exception rejected'})

    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        """Revoke an approved exception."""
        exception = self.get_object()
        exception.status = 'revoked'
        exception.save()
        return Response({'message': 'Exception revoked'})

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get pending exceptions."""
        queryset = self.get_queryset()
        pending = queryset.filter(status='pending').order_by('-requested_date')
        serializer = ComplianceExceptionSerializer(pending, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def expiring(self, request):
        """Get exceptions expiring soon."""
        queryset = self.get_queryset()
        today = timezone.now().date()
        from datetime import timedelta
        expiring = queryset.filter(
            status='approved',
            expiration_date__lte=today + timedelta(days=30),
            expiration_date__gte=today
        ).order_by('expiration_date')
        serializer = ComplianceExceptionSerializer(expiring, many=True)
        return Response(serializer.data)
