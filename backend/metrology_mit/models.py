# MIT License - See LICENSE-MIT.txt in repository root
"""
Metrology Models - Clean-room MIT implementation

Provides metrics and dashboard functionality for GRC analytics including:
- Custom metric definitions and instances
- Built-in metric snapshots for assessments
- Configurable dashboards with various widget types
"""

import uuid
from datetime import timedelta
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class MetricDefinition(models.Model):
    """
    Template defining how a metric is structured and measured.

    Metrics can be qualitative (levels/choices) or quantitative (numeric values).
    Definitions can be shared across multiple metric instances.
    """

    class Category(models.TextChoices):
        """Type of metric measurement."""
        QUALITATIVE = 'qualitative', _('Qualitative (Level)')
        QUANTITATIVE = 'quantitative', _('Quantitative (Number)')

    # Primary key
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # Identification
    ref_id = models.CharField(
        max_length=100,
        blank=True,
        verbose_name=_('Reference ID')
    )
    name = models.CharField(
        max_length=200,
        verbose_name=_('Name')
    )
    description = models.TextField(
        blank=True,
        verbose_name=_('Description')
    )

    # Metric type
    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        default=Category.QUANTITATIVE,
        verbose_name=_('Category')
    )

    # Unit of measurement (for quantitative)
    unit = models.CharField(
        max_length=50,
        blank=True,
        verbose_name=_('Unit'),
        help_text=_('Unit of measurement (e.g., count, percentage, hours)')
    )

    # Choices (for qualitative)
    choices_definition = models.JSONField(
        blank=True,
        null=True,
        verbose_name=_('Choices Definition'),
        help_text=_('Ordered list of choices: [{"name": "Low", "description": "..."}, ...]')
    )

    # Interpretation
    higher_is_better = models.BooleanField(
        default=True,
        verbose_name=_('Higher is Better'),
        help_text=_('If true, increase is positive (e.g., compliance score)')
    )
    default_target = models.FloatField(
        blank=True,
        null=True,
        verbose_name=_('Default Target'),
        help_text=_('Default target value for instances')
    )

    # Status
    is_published = models.BooleanField(
        default=True,
        verbose_name=_('Published')
    )

    # Library reference
    library_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name=_('Library')
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Folder scoping
    folder_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name=_('Folder')
    )

    class Meta:
        ordering = ['name']
        verbose_name = _('Metric Definition')
        verbose_name_plural = _('Metric Definitions')

    def __str__(self):
        return f"{self.ref_id} - {self.name}" if self.ref_id else self.name

    @property
    def choice_count(self) -> int:
        """Return number of choices for qualitative metrics."""
        if self.choices_definition and isinstance(self.choices_definition, list):
            return len(self.choices_definition)
        return 0

    def get_choice_label(self, index: int) -> str:
        """Get label for a choice by index (1-based)."""
        if not self.choices_definition or not isinstance(self.choices_definition, list):
            return str(index)
        array_index = index - 1
        if 0 <= array_index < len(self.choices_definition):
            return self.choices_definition[array_index].get('name', str(index))
        return str(index)

    @property
    def is_deletable(self) -> bool:
        """Check if this definition can be deleted."""
        return not self.instances.exists()


class MetricInstance(models.Model):
    """
    Active instance of a metric being tracked.

    Each instance tracks a specific metric with its own target,
    collection frequency, and sample history.
    """

    class Status(models.TextChoices):
        """Status of the metric instance."""
        DRAFT = 'draft', _('Draft')
        ACTIVE = 'active', _('Active')
        STALE = 'stale', _('Stale')
        DEPRECATED = 'deprecated', _('Deprecated')

    class Frequency(models.TextChoices):
        """Expected collection frequency."""
        REALTIME = 'realtime', _('Real-time')
        HOURLY = 'hourly', _('Hourly')
        DAILY = 'daily', _('Daily')
        WEEKLY = 'weekly', _('Weekly')
        MONTHLY = 'monthly', _('Monthly')
        QUARTERLY = 'quarterly', _('Quarterly')
        YEARLY = 'yearly', _('Yearly')

    # Primary key
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # Identification
    ref_id = models.CharField(
        max_length=100,
        blank=True,
        verbose_name=_('Reference ID')
    )
    name = models.CharField(
        max_length=200,
        verbose_name=_('Name')
    )
    description = models.TextField(
        blank=True,
        verbose_name=_('Description')
    )

    # Definition reference
    metric_definition = models.ForeignKey(
        MetricDefinition,
        on_delete=models.PROTECT,
        related_name='instances',
        verbose_name=_('Metric Definition')
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        verbose_name=_('Status'),
        db_index=True
    )

    # Target
    target_value = models.FloatField(
        blank=True,
        null=True,
        verbose_name=_('Target Value'),
        help_text=_('Target or optimal value for this metric')
    )

    # Collection
    collection_frequency = models.CharField(
        max_length=20,
        choices=Frequency.choices,
        blank=True,
        verbose_name=_('Collection Frequency')
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Folder scoping
    folder_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name=_('Folder')
    )

    class Meta:
        ordering = ['name']
        verbose_name = _('Metric Instance')
        verbose_name_plural = _('Metric Instances')

    def __str__(self):
        return f"{self.name} ({self.get_status_display()})"

    def save(self, *args, **kwargs):
        """Inherit default target if not set."""
        if self.target_value is None and self.metric_definition_id:
            if self.metric_definition.default_target is not None:
                self.target_value = self.metric_definition.default_target
        super().save(*args, **kwargs)

    @property
    def latest_sample(self):
        """Get the most recent sample."""
        return self.samples.first()

    @property
    def last_refresh(self):
        """Timestamp of the last sample."""
        sample = self.latest_sample
        return sample.timestamp if sample else None

    @property
    def current_value(self):
        """Get the current value from the latest sample."""
        sample = self.latest_sample
        if sample:
            return sample.display_value
        return None

    @property
    def raw_value(self):
        """Get the raw numeric value from the latest sample."""
        sample = self.latest_sample
        if sample:
            return sample.raw_value
        return None

    @property
    def unit(self) -> str:
        """Return the unit from the definition."""
        return self.metric_definition.unit if self.metric_definition else ''

    @property
    def is_stale(self) -> bool:
        """Check if metric is stale based on collection frequency."""
        if not self.collection_frequency:
            return False

        sample = self.latest_sample
        if not sample:
            return self.status == self.Status.ACTIVE

        now = timezone.now()
        time_since = now - sample.timestamp

        thresholds = {
            self.Frequency.REALTIME: timedelta(minutes=15),
            self.Frequency.HOURLY: timedelta(hours=2),
            self.Frequency.DAILY: timedelta(hours=36),
            self.Frequency.WEEKLY: timedelta(days=8),
            self.Frequency.MONTHLY: timedelta(days=32),
            self.Frequency.QUARTERLY: timedelta(days=95),
            self.Frequency.YEARLY: timedelta(days=370),
        }

        threshold = thresholds.get(self.collection_frequency)
        return threshold and time_since > threshold

    def activate(self):
        """Activate this metric instance."""
        self.status = self.Status.ACTIVE
        self.save(update_fields=['status', 'updated_at'])

    def deprecate(self):
        """Deprecate this metric instance."""
        self.status = self.Status.DEPRECATED
        self.save(update_fields=['status', 'updated_at'])


class MetricSample(models.Model):
    """
    Individual metric measurement record.

    Stores timestamped values for metric instances, supporting
    both quantitative and qualitative measurements.
    """

    # Primary key
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # Instance reference
    metric_instance = models.ForeignKey(
        MetricInstance,
        on_delete=models.CASCADE,
        related_name='samples',
        verbose_name=_('Metric Instance')
    )

    # Measurement
    timestamp = models.DateTimeField(
        verbose_name=_('Timestamp'),
        db_index=True
    )
    value = models.JSONField(
        default=dict,
        verbose_name=_('Value'),
        help_text=_('Measurement value as JSON')
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)

    # Folder scoping
    folder_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name=_('Folder')
    )

    class Meta:
        ordering = ['-timestamp']
        verbose_name = _('Metric Sample')
        verbose_name_plural = _('Metric Samples')
        indexes = [
            models.Index(fields=['metric_instance', 'timestamp']),
        ]

    def __str__(self):
        return f"{self.metric_instance.name} - {self.timestamp}"

    @property
    def raw_value(self):
        """Extract raw numeric/index value from the sample."""
        if not self.value:
            return None

        definition = self.metric_instance.metric_definition

        if definition.category == MetricDefinition.Category.QUALITATIVE:
            return self.value.get('choice_index')
        elif definition.category == MetricDefinition.Category.QUANTITATIVE:
            return self.value.get('result')

        return None

    @property
    def display_value(self) -> str:
        """Format value for display with unit."""
        if not self.value:
            return "N/A"

        definition = self.metric_instance.metric_definition

        if definition.category == MetricDefinition.Category.QUALITATIVE:
            index = self.value.get('choice_index')
            if index is not None:
                label = definition.get_choice_label(index)
                return f"[{index}] {label}"
            return "N/A"

        elif definition.category == MetricDefinition.Category.QUANTITATIVE:
            result = self.value.get('result')
            if result is not None:
                unit = definition.unit
                if unit:
                    if unit == 'percentage':
                        return f"{result}%"
                    return f"{result} {unit}"
                return str(result)
            return "N/A"

        return "N/A"

    def save(self, *args, **kwargs):
        """Update parent metric instance timestamp."""
        super().save(*args, **kwargs)
        self.metric_instance.save(update_fields=['updated_at'])


class BuiltinMetricSnapshot(models.Model):
    """
    System-computed metric snapshot for GRC objects.

    Stores daily snapshots of metrics computed for assessments,
    folders, and other GRC objects for trend analysis.
    """

    # Primary key
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # Object reference (generic)
    object_type = models.CharField(
        max_length=100,
        verbose_name=_('Object Type'),
        help_text=_('Type name of the measured object')
    )
    object_id = models.UUIDField(
        verbose_name=_('Object ID'),
        db_index=True
    )

    # Snapshot timing
    date = models.DateField(
        verbose_name=_('Date'),
        db_index=True
    )

    # Computed metrics
    metrics = models.JSONField(
        default=dict,
        verbose_name=_('Metrics'),
        help_text=_('Computed metrics snapshot')
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']
        verbose_name = _('Builtin Metric Snapshot')
        verbose_name_plural = _('Builtin Metric Snapshots')
        constraints = [
            models.UniqueConstraint(
                fields=['object_type', 'object_id', 'date'],
                name='unique_snapshot_per_object_per_day'
            )
        ]
        indexes = [
            models.Index(fields=['object_type', 'object_id', 'date']),
        ]

    def __str__(self):
        return f"{self.object_type} {self.object_id} - {self.date}"

    @classmethod
    def create_snapshot(cls, obj, metrics: dict, date=None):
        """
        Create or update a snapshot for an object.

        Args:
            obj: The object to snapshot (must have id attribute)
            metrics: Dictionary of computed metrics
            date: Optional date, defaults to today

        Returns:
            BuiltinMetricSnapshot instance
        """
        if date is None:
            date = timezone.now().date()

        snapshot, created = cls.objects.update_or_create(
            object_type=obj.__class__.__name__,
            object_id=obj.id,
            date=date,
            defaults={'metrics': metrics}
        )
        return snapshot

    def get_metric(self, key: str, default=None):
        """Get a specific metric value."""
        return self.metrics.get(key, default)


class Dashboard(models.Model):
    """
    Dashboard configuration for displaying metrics and widgets.

    Supports configurable layouts with multiple widget types.
    """

    # Primary key
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # Identification
    ref_id = models.CharField(
        max_length=100,
        blank=True,
        verbose_name=_('Reference ID')
    )
    name = models.CharField(
        max_length=200,
        verbose_name=_('Name')
    )
    description = models.TextField(
        blank=True,
        verbose_name=_('Description')
    )

    # Configuration
    dashboard_definition = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Dashboard Definition'),
        help_text=_('Layout and global filter configuration')
    )

    # Status
    is_published = models.BooleanField(
        default=False,
        verbose_name=_('Published')
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Folder scoping
    folder_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name=_('Folder')
    )

    class Meta:
        ordering = ['name']
        verbose_name = _('Dashboard')
        verbose_name_plural = _('Dashboards')

    def __str__(self):
        return self.name

    @property
    def widget_count(self) -> int:
        """Number of widgets in this dashboard."""
        return self.widgets.count()

    @property
    def layout_columns(self) -> int:
        """Get configured column count."""
        return self.dashboard_definition.get('layout', {}).get('columns', 12)

    @property
    def time_range(self) -> str:
        """Get global time range setting."""
        return self.dashboard_definition.get('global_filters', {}).get('time_range', 'last_30_days')

    def publish(self):
        """Publish this dashboard."""
        self.is_published = True
        self.save(update_fields=['is_published', 'updated_at'])


class DashboardWidget(models.Model):
    """
    Individual widget configuration for dashboards.

    Supports various chart types and can display custom metrics,
    builtin metrics, or static text content.
    """

    class ChartType(models.TextChoices):
        """Available widget visualization types."""
        KPI_CARD = 'kpi_card', _('KPI Card')
        DONUT = 'donut', _('Donut Chart')
        PIE = 'pie', _('Pie Chart')
        BAR = 'bar', _('Bar Chart')
        LINE = 'line', _('Line Chart')
        AREA = 'area', _('Area Chart')
        GAUGE = 'gauge', _('Gauge')
        SPARKLINE = 'sparkline', _('Sparkline')
        TABLE = 'table', _('Table')
        TEXT = 'text', _('Text')

    class TimeRange(models.TextChoices):
        """Time range options for data display."""
        LAST_HOUR = 'last_hour', _('Last Hour')
        LAST_24_HOURS = 'last_24_hours', _('Last 24 Hours')
        LAST_7_DAYS = 'last_7_days', _('Last 7 Days')
        LAST_30_DAYS = 'last_30_days', _('Last 30 Days')
        LAST_90_DAYS = 'last_90_days', _('Last 90 Days')
        LAST_YEAR = 'last_year', _('Last Year')
        ALL_TIME = 'all_time', _('All Time')

    class Aggregation(models.TextChoices):
        """Aggregation methods for time series data."""
        NONE = 'none', _('None (Raw)')
        AVG = 'avg', _('Average')
        SUM = 'sum', _('Sum')
        MIN = 'min', _('Minimum')
        MAX = 'max', _('Maximum')
        COUNT = 'count', _('Count')
        LAST = 'last', _('Last Value')

    # Primary key
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # Dashboard reference
    dashboard = models.ForeignKey(
        Dashboard,
        on_delete=models.CASCADE,
        related_name='widgets',
        verbose_name=_('Dashboard')
    )

    # Custom metric reference (option 1)
    metric_instance = models.ForeignKey(
        MetricInstance,
        on_delete=models.CASCADE,
        related_name='dashboard_widgets',
        null=True,
        blank=True,
        verbose_name=_('Metric Instance'),
        help_text=_('For custom metric widgets')
    )

    # Builtin metric reference (option 2)
    target_object_type = models.CharField(
        max_length=100,
        blank=True,
        verbose_name=_('Target Object Type')
    )
    target_object_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name=_('Target Object ID')
    )
    metric_key = models.CharField(
        max_length=100,
        blank=True,
        verbose_name=_('Metric Key')
    )

    # Text content (option 3)
    text_content = models.TextField(
        blank=True,
        verbose_name=_('Text Content'),
        help_text=_('Markdown content for text widgets')
    )

    # Display
    title = models.CharField(
        max_length=200,
        blank=True,
        verbose_name=_('Title')
    )

    # Grid position (12-column grid)
    position_x = models.PositiveIntegerField(
        default=0,
        verbose_name=_('Position X')
    )
    position_y = models.PositiveIntegerField(
        default=0,
        verbose_name=_('Position Y')
    )
    width = models.PositiveIntegerField(
        default=6,
        verbose_name=_('Width')
    )
    height = models.PositiveIntegerField(
        default=2,
        verbose_name=_('Height')
    )

    # Visualization
    chart_type = models.CharField(
        max_length=20,
        choices=ChartType.choices,
        default=ChartType.KPI_CARD,
        verbose_name=_('Chart Type')
    )
    time_range = models.CharField(
        max_length=20,
        choices=TimeRange.choices,
        default=TimeRange.LAST_30_DAYS,
        verbose_name=_('Time Range')
    )
    aggregation = models.CharField(
        max_length=20,
        choices=Aggregation.choices,
        default=Aggregation.NONE,
        verbose_name=_('Aggregation')
    )

    # Display options
    show_target = models.BooleanField(
        default=True,
        verbose_name=_('Show Target')
    )
    show_legend = models.BooleanField(
        default=True,
        verbose_name=_('Show Legend')
    )

    # Additional configuration
    widget_config = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Widget Config')
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Folder scoping
    folder_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name=_('Folder')
    )

    class Meta:
        ordering = ['position_y', 'position_x']
        verbose_name = _('Dashboard Widget')
        verbose_name_plural = _('Dashboard Widgets')

    def __str__(self):
        return f"{self.display_title} ({self.get_chart_type_display()})"

    @property
    def display_title(self) -> str:
        """Get widget title with fallbacks."""
        if self.title:
            return self.title
        if self.chart_type == self.ChartType.TEXT:
            return ''
        if self.metric_instance:
            return self.metric_instance.name
        if self.metric_key:
            return self.metric_key.replace('_', ' ').title()
        return 'Untitled Widget'

    @property
    def is_custom_metric(self) -> bool:
        """Check if widget displays a custom metric."""
        return self.metric_instance is not None

    @property
    def is_builtin_metric(self) -> bool:
        """Check if widget displays a builtin metric."""
        return bool(self.target_object_type and self.metric_key)

    @property
    def is_text_widget(self) -> bool:
        """Check if widget displays text content."""
        return self.chart_type == self.ChartType.TEXT

    @property
    def grid_bounds(self) -> tuple:
        """Return (x, y, width, height) tuple."""
        return (self.position_x, self.position_y, self.width, self.height)

    def validate_grid_position(self) -> bool:
        """Validate that widget fits in grid."""
        if self.position_x < 0 or self.position_x > 11:
            return False
        if self.width < 1 or self.width > 12:
            return False
        if self.position_x + self.width > 12:
            return False
        if self.height < 1:
            return False
        return True
