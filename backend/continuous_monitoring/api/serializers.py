"""
ConMon API Serializers

Provides serializers for ConMon models following existing patterns.
"""

from rest_framework import serializers
from continuous_monitoring.models import (
    ConMonProfile,
    ConMonActivityConfig,
    ConMonExecution,
    ConMonMetric,
)


class ConMonProfileWriteSerializer(serializers.ModelSerializer):
    """Write serializer for ConMonProfile model."""

    class Meta:
        model = ConMonProfile
        fields = [
            'id',
            'name',
            'description',
            'profile_type',
            'status',
            'base_framework',
            'compliance_assessment',
            'implementation_groups',
            'notification_lead_days',
            'notification_enabled',
            'assigned_actors',
            'folder',
        ]
        read_only_fields = ['id']


class ConMonProfileReadSerializer(ConMonProfileWriteSerializer):
    """Read serializer for ConMonProfile model."""

    profile_type_display = serializers.CharField(
        source='get_profile_type_display',
        read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True
    )
    base_framework_name = serializers.CharField(
        source='base_framework.name',
        read_only=True,
        allow_null=True
    )
    total_activities = serializers.SerializerMethodField()
    enabled_activities = serializers.SerializerMethodField()

    class Meta(ConMonProfileWriteSerializer.Meta):
        fields = ConMonProfileWriteSerializer.Meta.fields + [
            'profile_type_display',
            'status_display',
            'base_framework_name',
            'total_activities',
            'enabled_activities',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_total_activities(self, obj):
        return obj.activity_configs.count()

    def get_enabled_activities(self, obj):
        return obj.activity_configs.filter(enabled=True).count()


# Alias for backward compatibility
ConMonProfileSerializer = ConMonProfileReadSerializer


class ConMonProfileListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for profile lists."""

    profile_type_display = serializers.CharField(
        source='get_profile_type_display',
        read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True
    )
    health_score = serializers.SerializerMethodField()

    class Meta:
        model = ConMonProfile
        fields = [
            'id',
            'name',
            'profile_type',
            'profile_type_display',
            'status',
            'status_display',
            'health_score',
            'folder',
        ]

    def get_health_score(self, obj):
        # Calculate simplified health score
        from continuous_monitoring.services import ConMonService
        service = ConMonService(profile_id=str(obj.id))
        health = service._calculate_overall_health(obj)
        return health.get('score', 0)


class ConMonActivityConfigWriteSerializer(serializers.ModelSerializer):
    """Write serializer for ConMonActivityConfig model."""

    class Meta:
        model = ConMonActivityConfig
        fields = [
            'id',
            'profile',
            'requirement_urn',
            'ref_id',
            'name',
            'enabled',
            'frequency_override',
            'custom_schedule',
            'assigned_actors',
            'evidence_rules',
            'applied_controls',
            'task_template',
            'notes',
            'folder',
        ]
        read_only_fields = ['id']


class ConMonActivityConfigReadSerializer(ConMonActivityConfigWriteSerializer):
    """Read serializer for ConMonActivityConfig model."""

    frequency_override_display = serializers.CharField(
        source='get_frequency_override_display',
        read_only=True
    )
    status = serializers.SerializerMethodField()
    last_completed = serializers.SerializerMethodField()
    next_due = serializers.SerializerMethodField()

    class Meta(ConMonActivityConfigWriteSerializer.Meta):
        fields = ConMonActivityConfigWriteSerializer.Meta.fields + [
            'frequency_override_display',
            'status',
            'last_completed',
            'next_due',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_status(self, obj):
        from continuous_monitoring.services import ConMonService
        service = ConMonService()
        return service._get_activity_status(obj)

    def get_last_completed(self, obj):
        from continuous_monitoring.services import ConMonService
        service = ConMonService()
        last = service._get_last_completed(obj)
        return last.isoformat() if last else None

    def get_next_due(self, obj):
        from continuous_monitoring.services import ConMonService
        service = ConMonService()
        next_date = service._get_next_due(obj)
        return next_date.isoformat() if next_date else None


# Alias for backward compatibility
ConMonActivityConfigSerializer = ConMonActivityConfigReadSerializer


class ConMonActivityConfigListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for activity lists."""

    status = serializers.SerializerMethodField()

    class Meta:
        model = ConMonActivityConfig
        fields = [
            'id',
            'ref_id',
            'name',
            'enabled',
            'frequency_override',
            'status',
        ]

    def get_status(self, obj):
        from continuous_monitoring.services import ConMonService
        service = ConMonService()
        return service._get_activity_status(obj)


class ConMonExecutionWriteSerializer(serializers.ModelSerializer):
    """Write serializer for ConMonExecution model."""

    class Meta:
        model = ConMonExecution
        fields = [
            'id',
            'activity_config',
            'period_start',
            'period_end',
            'due_date',
            'status',
            'result',
            'completed_date',
            'completed_by',
            'task_node',
            'evidences',
            'findings',
            'observations',
            'folder',
        ]
        read_only_fields = ['id']


class ConMonExecutionReadSerializer(ConMonExecutionWriteSerializer):
    """Read serializer for ConMonExecution model."""

    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True
    )
    result_display = serializers.CharField(
        source='get_result_display',
        read_only=True
    )
    activity_ref_id = serializers.CharField(
        source='activity_config.ref_id',
        read_only=True
    )
    activity_name = serializers.CharField(
        source='activity_config.name',
        read_only=True
    )
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta(ConMonExecutionWriteSerializer.Meta):
        fields = ConMonExecutionWriteSerializer.Meta.fields + [
            'status_display',
            'result_display',
            'activity_ref_id',
            'activity_name',
            'is_overdue',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


# Alias for backward compatibility
ConMonExecutionSerializer = ConMonExecutionReadSerializer


class ConMonExecutionListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for execution lists."""

    activity_ref_id = serializers.CharField(
        source='activity_config.ref_id',
        read_only=True
    )
    activity_name = serializers.CharField(
        source='activity_config.name',
        read_only=True
    )
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = ConMonExecution
        fields = [
            'id',
            'activity_ref_id',
            'activity_name',
            'due_date',
            'status',
            'result',
            'is_overdue',
        ]


class ConMonMetricWriteSerializer(serializers.ModelSerializer):
    """Write serializer for ConMonMetric model."""

    class Meta:
        model = ConMonMetric
        fields = [
            'id',
            'profile',
            'metric_type',
            'period_start',
            'period_end',
            'value',
            'target',
            'unit',
            'trend',
            'trend_value',
            'breakdown',
            'folder',
        ]
        read_only_fields = ['id']


class ConMonMetricReadSerializer(ConMonMetricWriteSerializer):
    """Read serializer for ConMonMetric model."""

    metric_type_display = serializers.CharField(
        source='get_metric_type_display',
        read_only=True
    )
    trend_display = serializers.CharField(
        source='get_trend_display',
        read_only=True
    )
    status = serializers.CharField(read_only=True)

    class Meta(ConMonMetricWriteSerializer.Meta):
        fields = ConMonMetricWriteSerializer.Meta.fields + [
            'metric_type_display',
            'trend_display',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


# Alias for backward compatibility
ConMonMetricSerializer = ConMonMetricReadSerializer


class ConMonDashboardSerializer(serializers.Serializer):
    """Serializer for dashboard data."""

    profile_summary = serializers.DictField()
    overall_health = serializers.DictField()
    activities_by_frequency = serializers.DictField()
    metrics = serializers.ListField()
    upcoming_activities = serializers.ListField()
    overdue_activities = serializers.ListField()
    recent_completions = serializers.ListField()
    compliance_by_frequency = serializers.DictField()


class ConMonSetupSerializer(serializers.Serializer):
    """Serializer for ConMon setup request."""

    framework_urn = serializers.CharField(
        help_text="URN of the framework to use (e.g., 'urn:ciso:risk:framework:conmon-schedule')"
    )
    profile_name = serializers.CharField(
        help_text="Name for the new ConMon profile"
    )
    profile_type = serializers.ChoiceField(
        choices=ConMonProfile.ProfileType.choices,
        default='custom',
        help_text="Type of profile"
    )
    implementation_groups = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=True,
        help_text="Implementation groups to include (e.g., ['L', 'M', 'H'] or ['BASIC', 'STANDARD'])"
    )
    generate_tasks = serializers.BooleanField(
        default=True,
        help_text="Whether to generate TaskTemplates and TaskNodes"
    )


class ConMonSetupResponseSerializer(serializers.Serializer):
    """Serializer for ConMon setup response."""

    profile_id = serializers.UUIDField()
    activities_created = serializers.IntegerField()
    tasks_created = serializers.IntegerField()
    task_nodes_created = serializers.IntegerField()
    errors = serializers.ListField()
