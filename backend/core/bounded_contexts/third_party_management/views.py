"""
API Views for ThirdPartyManagement bounded context
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .aggregates.third_party import ThirdParty
from .serializers import ThirdPartySerializer


class ThirdPartyViewSet(viewsets.ModelViewSet):
    """ViewSet for ThirdParty aggregates"""

    queryset = ThirdParty.objects.all()
    serializer_class = ThirdPartySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['lifecycle_state', 'criticality', 'entity_type']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a third party"""
        third_party = self.get_object()
        third_party.activate()
        third_party.save()
        return Response({'status': 'activated'})
    
    @action(detail=True, methods=['post'])
    def start_offboarding(self, request, pk=None):
        """Start offboarding a third party"""
        third_party = self.get_object()
        third_party.start_offboarding()
        third_party.save()
        return Response({'status': 'offboarding_started'})
    
    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        """Archive a third party"""
        third_party = self.get_object()
        third_party.archive()
        third_party.save()
        return Response({'status': 'archived'})

    @action(detail=True, methods=['post'])
    def add_service(self, request, pk=None):
        """Add a service to a third party"""
        third_party = self.get_object()
        service_id = request.data.get('service_id')
        if service_id:
            import uuid
            third_party.add_service(uuid.UUID(service_id))
            third_party.save()
            return Response({'status': 'service added'})
        return Response({'error': 'service_id required'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def add_contract(self, request, pk=None):
        """Add a contract to a third party"""
        third_party = self.get_object()
        contract_id = request.data.get('contract_id')
        if contract_id:
            import uuid
            third_party.add_contract(uuid.UUID(contract_id))
            third_party.save()
            return Response({'status': 'contract added'})
        return Response({'error': 'contract_id required'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def add_risk(self, request, pk=None):
        """Add a risk to a third party"""
        third_party = self.get_object()
        risk_id = request.data.get('risk_id')
        if risk_id:
            import uuid
            third_party.add_risk(uuid.UUID(risk_id))
            third_party.save()
            return Response({'status': 'risk added'})
        return Response({'error': 'risk_id required'}, status=status.HTTP_400_BAD_REQUEST)

