"""
API Views for Privacy bounded context
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .aggregates.data_asset import DataAsset
from .aggregates.data_flow import DataFlow
from .serializers import (
    DataAssetSerializer,
    DataFlowSerializer,
    ConsentRecordSerializer,
    DataSubjectRightSerializer,
)
from privacy.models.consent_record import ConsentRecord
from privacy.models.data_subject_right import DataSubjectRight


class ConsentRecordViewSet(viewsets.ModelViewSet):
    """ViewSet for ConsentRecord aggregates"""

    queryset = ConsentRecord.objects.all()
    serializer_class = ConsentRecordSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'consent_method', 'data_subject_type']
    search_fields = ['data_subject_id', 'consent_id']
    ordering_fields = ['consent_date', 'created_at', 'valid_until']
    ordering = ['-consent_date']

    @action(detail=True, methods=['post'])
    def withdraw(self, request, pk=None):
        """Withdraw consent"""
        record = self.get_object()
        withdrawal_method = request.data.get('withdrawal_method', 'digital_request')
        withdrawal_reason = request.data.get('withdrawal_reason')
        record.withdraw_consent(withdrawal_method, withdrawal_reason)
        record.save()
        return Response({'status': 'withdrawn'})

    @action(detail=True, methods=['post'])
    def add_processing_purpose(self, request, pk=None):
        """Add a processing purpose to this consent"""
        record = self.get_object()
        purpose = request.data.get('purpose')
        if purpose:
            if not record.processing_purposes:
                record.processing_purposes = []
            record.processing_purposes.append(purpose)
            record.save()
            return Response({'status': 'purpose added'})
        return Response({'error': 'purpose required'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def add_data_asset(self, request, pk=None):
        """Add a data asset to this consent"""
        record = self.get_object()
        data_asset_id = request.data.get('data_asset_id')
        if data_asset_id:
            if not record.related_data_assets:
                record.related_data_assets = []
            record.related_data_assets.append(data_asset_id)
            record.save()
            return Response({'status': 'data asset added'})
        return Response({'error': 'data_asset_id required'}, status=status.HTTP_400_BAD_REQUEST)


class DataSubjectRightViewSet(viewsets.ModelViewSet):
    """ViewSet for DataSubjectRight aggregates"""

    queryset = DataSubjectRight.objects.all()
    serializer_class = DataSubjectRightSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'primary_right', 'priority']
    search_fields = ['request_id', 'data_subject_id', 'contact_email']
    ordering_fields = ['received_date', 'due_date', 'created_at']
    ordering = ['-received_date']

    @action(detail=True, methods=['post'])
    def start_processing(self, request, pk=None):
        """Start processing the request"""
        import uuid
        dsr = self.get_object()
        assigned_to_user_id = request.data.get('assigned_to_user_id')
        assigned_to_username = request.data.get('assigned_to_username', '')
        if assigned_to_user_id:
            dsr.assign_processor(uuid.UUID(assigned_to_user_id), assigned_to_username)
        dsr.status = 'processing'
        dsr.save()
        return Response({'status': 'processing'})

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Complete the request"""
        dsr = self.get_object()
        response_summary = request.data.get('response_summary', '')
        response_method = request.data.get('response_method', 'email')
        dsr.fulfill_request(response_summary, response_method)
        dsr.save()
        return Response({'status': 'completed'})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject the request"""
        dsr = self.get_object()
        rejection_reason = request.data.get('rejection_reason')
        if rejection_reason:
            dsr.reject_request(rejection_reason)
            dsr.save()
            return Response({'status': 'rejected'})
        return Response({'error': 'rejection_reason required'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel the request"""
        dsr = self.get_object()
        dsr.status = 'rejected'
        dsr.rejection_reason = 'Cancelled by user'
        dsr.save()
        return Response({'status': 'cancelled'})

    @action(detail=True, methods=['post'])
    def add_data_asset(self, request, pk=None):
        """Add a data asset to this request"""
        dsr = self.get_object()
        data_asset_id = request.data.get('data_asset_id')
        if data_asset_id:
            if not dsr.related_data_assets:
                dsr.related_data_assets = []
            dsr.related_data_assets.append(data_asset_id)
            dsr.save()
            return Response({'status': 'data asset added'})
        return Response({'error': 'data_asset_id required'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def add_evidence(self, request, pk=None):
        """Add evidence to this request"""
        dsr = self.get_object()
        evidence_id = request.data.get('evidence_id')
        if evidence_id:
            if not dsr.data_located:
                dsr.data_located = []
            dsr.data_located.append({'evidence_id': evidence_id})
            dsr.save()
            return Response({'status': 'evidence added'})
        return Response({'error': 'evidence_id required'}, status=status.HTTP_400_BAD_REQUEST)


class DataAssetViewSet(viewsets.ModelViewSet):
    """ViewSet for DataAsset aggregates"""

    queryset = DataAsset.objects.all()
    serializer_class = DataAssetSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['lifecycle_state', 'contains_personal_data']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a data asset"""
        asset = self.get_object()
        asset.activate()
        asset.save()
        return Response({'status': 'activated'})
    
    @action(detail=True, methods=['post'])
    def retire(self, request, pk=None):
        """Retire a data asset"""
        asset = self.get_object()
        asset.retire()
        asset.save()
        return Response({'status': 'retired'})
    
    @action(detail=True, methods=['post'])
    def add_data_category(self, request, pk=None):
        """Add a data category"""
        asset = self.get_object()
        category = request.data.get('category')
        if category:
            asset.add_data_category(category)
            asset.save()
            return Response({'status': 'category added'})
        return Response({'error': 'category required'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def add_asset(self, request, pk=None):
        """Add an asset to a data asset"""
        data_asset = self.get_object()
        asset_id = request.data.get('asset_id')
        if asset_id:
            data_asset.add_asset(asset_id)
            data_asset.save()
            return Response({'status': 'asset added'})
        return Response({'error': 'asset_id required'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def assign_owner(self, request, pk=None):
        """Assign an owner to a data asset"""
        data_asset = self.get_object()
        org_unit_id = request.data.get('org_unit_id')
        if org_unit_id:
            data_asset.assign_owner(org_unit_id)
            data_asset.save()
            return Response({'status': 'owner assigned'})
        return Response({'error': 'org_unit_id required'}, status=status.HTTP_400_BAD_REQUEST)


class DataFlowViewSet(viewsets.ModelViewSet):
    """ViewSet for DataFlow aggregates"""

    queryset = DataFlow.objects.all()
    serializer_class = DataFlowSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['lifecycle_state', 'encryption_in_transit']
    search_fields = ['name', 'description', 'purpose']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a data flow"""
        flow = self.get_object()
        flow.activate()
        flow.save()
        return Response({'status': 'activated'})
    
    @action(detail=True, methods=['post'])
    def retire(self, request, pk=None):
        """Retire a data flow"""
        flow = self.get_object()
        flow.retire()
        flow.save()
        return Response({'status': 'retired'})
    
    @action(detail=True, methods=['post'])
    def change(self, request, pk=None):
        """Change a data flow"""
        flow = self.get_object()
        changes = request.data.get('changes', {})
        if changes:
            flow.change(changes)
            flow.save()
            return Response({'status': 'changed'})
        return Response({'error': 'changes required'}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def add_data_asset(self, request, pk=None):
        """Add a data asset to a flow"""
        flow = self.get_object()
        data_asset_id = request.data.get('data_asset_id')
        if data_asset_id:
            flow.add_data_asset(data_asset_id)
            flow.save()
            return Response({'status': 'data asset added'})
        return Response({'error': 'data_asset_id required'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def add_third_party(self, request, pk=None):
        """Add a third party to a data flow"""
        flow = self.get_object()
        third_party_id = request.data.get('third_party_id')
        if third_party_id:
            flow.add_third_party(third_party_id)
            flow.save()
            return Response({'status': 'third party added'})
        return Response({'error': 'third_party_id required'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def add_control_implementation(self, request, pk=None):
        """Add a control implementation to a data flow"""
        flow = self.get_object()
        control_implementation_id = request.data.get('control_implementation_id')
        if control_implementation_id:
            flow.add_control_implementation(control_implementation_id)
            flow.save()
            return Response({'status': 'control implementation added'})
        return Response({'error': 'control_implementation_id required'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def add_privacy_risk(self, request, pk=None):
        """Add a privacy risk to a data flow"""
        flow = self.get_object()
        risk_id = request.data.get('risk_id')
        if risk_id:
            flow.add_privacy_risk(risk_id)
            flow.save()
            return Response({'status': 'privacy risk added'})
        return Response({'error': 'risk_id required'}, status=status.HTTP_400_BAD_REQUEST)

