# Generated migration for Significant Change Request and Security Incident aggregates

import uuid
from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("rmf_operations", "0002_fedramp_20x_models"),
    ]

    operations = [
        migrations.CreateModel(
            name="SignificantChangeRequest",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "version",
                    models.IntegerField(
                        default=0, help_text="Optimistic locking version"
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.UUIDField(
                        blank=True, help_text="User who created this record", null=True
                    ),
                ),
                (
                    "updated_by",
                    models.UUIDField(
                        blank=True,
                        help_text="User who last updated this record",
                        null=True,
                    ),
                ),
                (
                    "cloud_service_offering_id",
                    models.UUIDField(
                        db_index=True,
                        help_text="Cloud Service Offering this change applies to",
                    ),
                ),
                (
                    "change_number",
                    models.CharField(
                        blank=True,
                        help_text="Unique change request number (e.g., SCR-2026-001)",
                        max_length=50,
                        null=True,
                        unique=True,
                    ),
                ),
                (
                    "title",
                    models.CharField(
                        help_text="Brief title describing the change",
                        max_length=255,
                    ),
                ),
                (
                    "description",
                    models.TextField(
                        help_text="Detailed description of the proposed change",
                    ),
                ),
                (
                    "change_type",
                    models.CharField(
                        choices=[
                            ("boundary", "Authorization Boundary Change"),
                            ("technology", "Technology/Architecture Change"),
                            ("personnel", "Key Personnel Change"),
                            ("process", "Process/Procedure Change"),
                            ("vendor", "Third-Party Vendor Change"),
                            ("data_flow", "Data Flow Change"),
                            ("encryption", "Encryption Change"),
                            ("authentication", "Authentication/Access Control Change"),
                            ("network", "Network Architecture Change"),
                            ("storage", "Data Storage Change"),
                            ("interconnection", "Interconnection Change"),
                            ("physical", "Physical Security Change"),
                            ("incident_response", "Incident Response Change"),
                            ("contingency", "Contingency Planning Change"),
                            ("other", "Other Change"),
                        ],
                        db_index=True,
                        default="other",
                        help_text="Type of change",
                        max_length=30,
                    ),
                ),
                (
                    "scn_category",
                    models.CharField(
                        choices=[
                            ("cat1_boundary", "Category 1: Authorization Boundary"),
                            ("cat2_services", "Category 2: Services/Features"),
                            ("cat3_architecture", "Category 3: Architecture"),
                            ("cat4_interconnections", "Category 4: Interconnections"),
                            ("cat5_encryption", "Category 5: Cryptographic Modules"),
                            ("cat6_controls", "Category 6: Control Implementation"),
                            ("cat7_personnel", "Category 7: Key Personnel"),
                            ("cat8_physical", "Category 8: Physical Environment"),
                            ("not_applicable", "Not Applicable"),
                        ],
                        default="not_applicable",
                        help_text="FedRAMP SCN category if applicable",
                        max_length=30,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("draft", "Draft"),
                            ("submitted", "Submitted for Review"),
                            ("impact_analysis", "Impact Analysis In Progress"),
                            ("impact_assessed", "Impact Assessed"),
                            ("scn_required", "SCN Required"),
                            ("scn_not_required", "SCN Not Required"),
                            ("scn_submitted", "SCN Submitted to FedRAMP"),
                            ("scn_acknowledged", "SCN Acknowledged by FedRAMP"),
                            ("approved", "Change Approved"),
                            ("rejected", "Change Rejected"),
                            ("implemented", "Change Implemented"),
                            ("withdrawn", "Withdrawn"),
                        ],
                        db_index=True,
                        default="draft",
                        help_text="Current status of the change request",
                        max_length=30,
                    ),
                ),
                (
                    "requested_date",
                    models.DateTimeField(
                        auto_now_add=True,
                        help_text="Date the change was requested",
                    ),
                ),
                (
                    "planned_implementation_date",
                    models.DateField(
                        blank=True,
                        help_text="Planned date for implementing the change",
                        null=True,
                    ),
                ),
                (
                    "actual_implementation_date",
                    models.DateField(
                        blank=True,
                        help_text="Actual date the change was implemented",
                        null=True,
                    ),
                ),
                (
                    "requestor_name",
                    models.CharField(
                        help_text="Name of person requesting the change",
                        max_length=255,
                    ),
                ),
                (
                    "requestor_email",
                    models.EmailField(
                        blank=True,
                        help_text="Email of requestor",
                        null=True,
                        max_length=254,
                    ),
                ),
                (
                    "requestor_organization",
                    models.CharField(
                        blank=True,
                        help_text="Organization of requestor",
                        max_length=255,
                        null=True,
                    ),
                ),
                (
                    "impact_level",
                    models.CharField(
                        choices=[
                            ("none", "No Impact"),
                            ("low", "Low Impact"),
                            ("moderate", "Moderate Impact"),
                            ("high", "High Impact"),
                            ("critical", "Critical Impact"),
                        ],
                        default="none",
                        help_text="Assessed impact level of the change",
                        max_length=20,
                    ),
                ),
                (
                    "impact_analysis",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text="Detailed impact analysis",
                    ),
                ),
                (
                    "impact_analysis_date",
                    models.DateTimeField(
                        blank=True,
                        help_text="Date impact analysis was completed",
                        null=True,
                    ),
                ),
                (
                    "impact_analyst",
                    models.CharField(
                        blank=True,
                        help_text="Person who performed impact analysis",
                        max_length=255,
                        null=True,
                    ),
                ),
                (
                    "affected_components",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="List of affected system components",
                    ),
                ),
                (
                    "affected_ksi_ids",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="List of affected KSI reference IDs",
                    ),
                ),
                (
                    "affected_control_ids",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="List of affected NIST control IDs",
                    ),
                ),
                (
                    "affected_data_types",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="Types of data affected by the change",
                    ),
                ),
                (
                    "risk_before_change",
                    models.TextField(
                        blank=True,
                        help_text="Risk assessment before the change",
                        null=True,
                    ),
                ),
                (
                    "risk_after_change",
                    models.TextField(
                        blank=True,
                        help_text="Risk assessment after the change",
                        null=True,
                    ),
                ),
                (
                    "risk_delta",
                    models.CharField(
                        choices=[
                            ("decreased", "Risk Decreased"),
                            ("unchanged", "Risk Unchanged"),
                            ("increased", "Risk Increased"),
                            ("unknown", "Unknown"),
                        ],
                        default="unknown",
                        help_text="How the change affects overall risk",
                        max_length=20,
                    ),
                ),
                (
                    "mitigation_measures",
                    models.TextField(
                        blank=True,
                        help_text="Mitigation measures for any increased risk",
                        null=True,
                    ),
                ),
                (
                    "scn_required",
                    models.BooleanField(
                        default=False,
                        help_text="Whether this change requires FedRAMP SCN",
                    ),
                ),
                (
                    "scn_determination_rationale",
                    models.TextField(
                        blank=True,
                        help_text="Rationale for SCN determination",
                        null=True,
                    ),
                ),
                (
                    "scn_determination_date",
                    models.DateTimeField(
                        blank=True,
                        help_text="Date SCN determination was made",
                        null=True,
                    ),
                ),
                (
                    "scn_submission_date",
                    models.DateTimeField(
                        blank=True,
                        help_text="Date SCN was submitted to FedRAMP",
                        null=True,
                    ),
                ),
                (
                    "scn_reference_number",
                    models.CharField(
                        blank=True,
                        help_text="FedRAMP SCN reference number",
                        max_length=100,
                        null=True,
                    ),
                ),
                (
                    "scn_acknowledgment_date",
                    models.DateTimeField(
                        blank=True,
                        help_text="Date FedRAMP acknowledged the SCN",
                        null=True,
                    ),
                ),
                (
                    "scn_response",
                    models.TextField(
                        blank=True,
                        help_text="FedRAMP response to SCN",
                        null=True,
                    ),
                ),
                (
                    "security_review_required",
                    models.BooleanField(
                        default=True,
                        help_text="Whether security team review is required",
                    ),
                ),
                (
                    "security_review_completed",
                    models.BooleanField(
                        default=False,
                        help_text="Whether security review has been completed",
                    ),
                ),
                (
                    "security_reviewer",
                    models.CharField(
                        blank=True,
                        help_text="Security reviewer name",
                        max_length=255,
                        null=True,
                    ),
                ),
                (
                    "security_review_date",
                    models.DateTimeField(
                        blank=True,
                        help_text="Date of security review",
                        null=True,
                    ),
                ),
                (
                    "security_review_notes",
                    models.TextField(
                        blank=True,
                        help_text="Notes from security review",
                        null=True,
                    ),
                ),
                (
                    "approver_name",
                    models.CharField(
                        blank=True,
                        help_text="Name of person who approved/rejected",
                        max_length=255,
                        null=True,
                    ),
                ),
                (
                    "approval_date",
                    models.DateTimeField(
                        blank=True,
                        help_text="Date of approval/rejection",
                        null=True,
                    ),
                ),
                (
                    "approval_notes",
                    models.TextField(
                        blank=True,
                        help_text="Notes from approver",
                        null=True,
                    ),
                ),
                (
                    "rejection_reason",
                    models.TextField(
                        blank=True,
                        help_text="Reason for rejection",
                        null=True,
                    ),
                ),
                (
                    "withdrawal_reason",
                    models.TextField(
                        blank=True,
                        help_text="Reason for withdrawal",
                        null=True,
                    ),
                ),
                (
                    "implementation_plan",
                    models.TextField(
                        blank=True,
                        help_text="Plan for implementing the change",
                        null=True,
                    ),
                ),
                (
                    "rollback_plan",
                    models.TextField(
                        blank=True,
                        help_text="Plan for rolling back if issues occur",
                        null=True,
                    ),
                ),
                (
                    "implementation_notes",
                    models.TextField(
                        blank=True,
                        help_text="Notes from implementation",
                        null=True,
                    ),
                ),
                (
                    "verification_completed",
                    models.BooleanField(
                        default=False,
                        help_text="Whether post-implementation verification is complete",
                    ),
                ),
                (
                    "verification_date",
                    models.DateTimeField(
                        blank=True,
                        help_text="Date of post-implementation verification",
                        null=True,
                    ),
                ),
                (
                    "verification_notes",
                    models.TextField(
                        blank=True,
                        help_text="Notes from verification",
                        null=True,
                    ),
                ),
                (
                    "related_incident_ids",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="IDs of related security incidents",
                    ),
                ),
                (
                    "related_poam_ids",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="IDs of related POA&M items",
                    ),
                ),
                (
                    "related_change_ids",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="IDs of related change requests",
                    ),
                ),
                (
                    "attachments",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="List of attachment references",
                    ),
                ),
                (
                    "reported_in_oar_id",
                    models.UUIDField(
                        blank=True,
                        help_text="OAR where this change was reported",
                        null=True,
                    ),
                ),
                (
                    "audit_trail",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="Audit trail of status changes",
                    ),
                ),
                (
                    "tags",
                    models.JSONField(blank=True, default=list),
                ),
                (
                    "metadata",
                    models.JSONField(blank=True, default=dict),
                ),
            ],
            options={
                "verbose_name": "Significant Change Request",
                "verbose_name_plural": "Significant Change Requests",
                "db_table": "fedramp_significant_change_requests",
                "ordering": ["-requested_date"],
                "indexes": [
                    models.Index(
                        fields=["cloud_service_offering_id", "status"],
                        name="fedramp_scr_cso_status_idx",
                    ),
                    models.Index(
                        fields=["status", "scn_required"],
                        name="fedramp_scr_status_scn_idx",
                    ),
                    models.Index(
                        fields=["change_type", "status"],
                        name="fedramp_scr_type_status_idx",
                    ),
                    models.Index(
                        fields=["planned_implementation_date"],
                        name="fedramp_scr_planned_date_idx",
                    ),
                    models.Index(
                        fields=["created_at"],
                        name="fedramp_scr_created_idx",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="SecurityIncident",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "version",
                    models.IntegerField(
                        default=0, help_text="Optimistic locking version"
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.UUIDField(
                        blank=True, help_text="User who created this record", null=True
                    ),
                ),
                (
                    "updated_by",
                    models.UUIDField(
                        blank=True,
                        help_text="User who last updated this record",
                        null=True,
                    ),
                ),
                (
                    "cloud_service_offering_id",
                    models.UUIDField(
                        db_index=True,
                        help_text="Cloud Service Offering affected by this incident",
                    ),
                ),
                (
                    "incident_number",
                    models.CharField(
                        help_text="Unique incident identifier (e.g., INC-2026-001)",
                        max_length=50,
                        unique=True,
                    ),
                ),
                (
                    "title",
                    models.CharField(
                        help_text="Brief title describing the incident",
                        max_length=255,
                    ),
                ),
                (
                    "description",
                    models.TextField(
                        help_text="Detailed description of the incident",
                    ),
                ),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("unauthorized_access", "Unauthorized Access"),
                            ("denial_of_service", "Denial of Service"),
                            ("malicious_code", "Malicious Code/Malware"),
                            ("improper_usage", "Improper Usage"),
                            ("scans_probes", "Scans/Probes/Attempted Access"),
                            ("data_breach", "Data Breach/Exfiltration"),
                            ("data_loss", "Data Loss"),
                            ("phishing", "Phishing/Social Engineering"),
                            ("ransomware", "Ransomware"),
                            ("supply_chain", "Supply Chain Compromise"),
                            ("insider_threat", "Insider Threat"),
                            ("configuration_error", "Configuration/Implementation Error"),
                            ("physical", "Physical Security Incident"),
                            ("other", "Other"),
                        ],
                        db_index=True,
                        default="other",
                        help_text="Incident category",
                        max_length=30,
                    ),
                ),
                (
                    "subcategory",
                    models.CharField(
                        blank=True,
                        help_text="More specific subcategory",
                        max_length=100,
                        null=True,
                    ),
                ),
                (
                    "severity",
                    models.CharField(
                        choices=[
                            ("critical", "Critical (Report within 1 hour)"),
                            ("high", "High (Report within 24 hours)"),
                            ("moderate", "Moderate (Report within 72 hours)"),
                            ("low", "Low (Report within 7 days)"),
                            ("informational", "Informational (No mandatory reporting)"),
                        ],
                        db_index=True,
                        default="moderate",
                        help_text="Incident severity level",
                        max_length=20,
                    ),
                ),
                (
                    "data_classification",
                    models.CharField(
                        choices=[
                            ("unclassified", "Unclassified"),
                            ("cui", "Controlled Unclassified Information"),
                            ("pii", "Personally Identifiable Information"),
                            ("phi", "Protected Health Information"),
                            ("fti", "Federal Tax Information"),
                            ("classified", "Classified"),
                            ("unknown", "Unknown/Under Investigation"),
                        ],
                        default="unknown",
                        help_text="Classification of data potentially affected",
                        max_length=20,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("detected", "Detected"),
                            ("reported", "Reported Internally"),
                            ("analyzing", "Analysis In Progress"),
                            ("contained", "Contained"),
                            ("eradicating", "Eradication In Progress"),
                            ("eradicated", "Eradicated"),
                            ("recovering", "Recovery In Progress"),
                            ("recovered", "Recovered"),
                            ("lessons_learned", "Lessons Learned Review"),
                            ("closed", "Closed"),
                        ],
                        db_index=True,
                        default="detected",
                        help_text="Current incident status",
                        max_length=20,
                    ),
                ),
                (
                    "detected_at",
                    models.DateTimeField(
                        help_text="When the incident was first detected",
                    ),
                ),
                (
                    "detection_method",
                    models.CharField(
                        blank=True,
                        help_text="How the incident was detected",
                        max_length=100,
                        null=True,
                    ),
                ),
                (
                    "detected_by",
                    models.CharField(
                        blank=True,
                        help_text="Who/what detected the incident",
                        max_length=255,
                        null=True,
                    ),
                ),
                (
                    "reported_internally_at",
                    models.DateTimeField(
                        blank=True,
                        help_text="When incident was reported to internal security team",
                        null=True,
                    ),
                ),
                (
                    "analysis_started_at",
                    models.DateTimeField(
                        blank=True,
                        help_text="When incident analysis began",
                        null=True,
                    ),
                ),
                (
                    "contained_at",
                    models.DateTimeField(
                        blank=True,
                        help_text="When incident was contained",
                        null=True,
                    ),
                ),
                (
                    "eradicated_at",
                    models.DateTimeField(
                        blank=True,
                        help_text="When threat was eradicated",
                        null=True,
                    ),
                ),
                (
                    "recovery_started_at",
                    models.DateTimeField(
                        blank=True,
                        help_text="When recovery operations began",
                        null=True,
                    ),
                ),
                (
                    "recovered_at",
                    models.DateTimeField(
                        blank=True,
                        help_text="When systems were fully recovered",
                        null=True,
                    ),
                ),
                (
                    "closed_at",
                    models.DateTimeField(
                        blank=True,
                        help_text="When incident was officially closed",
                        null=True,
                    ),
                ),
                (
                    "impact_description",
                    models.TextField(
                        blank=True,
                        help_text="Description of incident impact",
                        null=True,
                    ),
                ),
                (
                    "affected_systems",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="List of affected systems/components",
                    ),
                ),
                (
                    "affected_users_count",
                    models.IntegerField(
                        default=0,
                        help_text="Number of users affected",
                    ),
                ),
                (
                    "affected_records_count",
                    models.IntegerField(
                        default=0,
                        help_text="Number of records potentially affected",
                    ),
                ),
                (
                    "data_exfiltrated",
                    models.BooleanField(
                        default=False,
                        help_text="Whether data was confirmed exfiltrated",
                    ),
                ),
                (
                    "service_disruption",
                    models.BooleanField(
                        default=False,
                        help_text="Whether there was service disruption",
                    ),
                ),
                (
                    "service_disruption_duration_hours",
                    models.DecimalField(
                        decimal_places=2,
                        default=0,
                        help_text="Duration of service disruption in hours",
                        max_digits=10,
                    ),
                ),
                (
                    "financial_impact",
                    models.DecimalField(
                        blank=True,
                        decimal_places=2,
                        help_text="Estimated financial impact",
                        max_digits=15,
                        null=True,
                    ),
                ),
                (
                    "attack_vector",
                    models.CharField(
                        blank=True,
                        help_text="Initial attack vector",
                        max_length=255,
                        null=True,
                    ),
                ),
                (
                    "threat_actor",
                    models.CharField(
                        blank=True,
                        help_text="Identified or suspected threat actor",
                        max_length=255,
                        null=True,
                    ),
                ),
                (
                    "indicators_of_compromise",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="List of IOCs",
                    ),
                ),
                (
                    "mitre_attack_techniques",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="MITRE ATT&CK techniques identified",
                    ),
                ),
                (
                    "malware_identified",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="Malware samples/families identified",
                    ),
                ),
                (
                    "uscert_reporting_status",
                    models.CharField(
                        choices=[
                            ("not_required", "Reporting Not Required"),
                            ("pending", "Report Pending"),
                            ("submitted", "Initial Report Submitted"),
                            ("update_required", "Update Required"),
                            ("update_submitted", "Update Submitted"),
                            ("final_submitted", "Final Report Submitted"),
                            ("closed", "Reporting Complete"),
                        ],
                        default="not_required",
                        help_text="US-CERT reporting status",
                        max_length=20,
                    ),
                ),
                (
                    "uscert_reporting_deadline",
                    models.DateTimeField(
                        blank=True,
                        help_text="Deadline for US-CERT initial report",
                        null=True,
                    ),
                ),
                (
                    "uscert_case_number",
                    models.CharField(
                        blank=True,
                        help_text="US-CERT/CISA case number",
                        max_length=100,
                        null=True,
                    ),
                ),
                (
                    "uscert_initial_report_date",
                    models.DateTimeField(
                        blank=True,
                        help_text="Date initial report was submitted",
                        null=True,
                    ),
                ),
                (
                    "uscert_updates",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="List of update submissions",
                    ),
                ),
                (
                    "uscert_final_report_date",
                    models.DateTimeField(
                        blank=True,
                        help_text="Date final report was submitted",
                        null=True,
                    ),
                ),
                (
                    "fedramp_notified",
                    models.BooleanField(
                        default=False,
                        help_text="Whether FedRAMP PMO was notified",
                    ),
                ),
                (
                    "fedramp_notification_date",
                    models.DateTimeField(
                        blank=True,
                        help_text="Date FedRAMP was notified",
                        null=True,
                    ),
                ),
                (
                    "agencies_notified",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="List of agencies notified",
                    ),
                ),
                (
                    "incident_commander",
                    models.CharField(
                        blank=True,
                        help_text="Incident commander/lead",
                        max_length=255,
                        null=True,
                    ),
                ),
                (
                    "response_team",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="List of response team members",
                    ),
                ),
                (
                    "containment_actions",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="Containment actions taken",
                    ),
                ),
                (
                    "containment_effectiveness",
                    models.CharField(
                        choices=[
                            ("effective", "Effective"),
                            ("partial", "Partially Effective"),
                            ("ineffective", "Ineffective"),
                            ("unknown", "Unknown"),
                        ],
                        default="unknown",
                        help_text="Effectiveness of containment",
                        max_length=20,
                    ),
                ),
                (
                    "eradication_actions",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="Eradication actions taken",
                    ),
                ),
                (
                    "root_cause",
                    models.TextField(
                        blank=True,
                        help_text="Root cause analysis",
                        null=True,
                    ),
                ),
                (
                    "recovery_actions",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="Recovery actions taken",
                    ),
                ),
                (
                    "recovery_verification",
                    models.TextField(
                        blank=True,
                        help_text="How recovery was verified",
                        null=True,
                    ),
                ),
                (
                    "lessons_learned",
                    models.TextField(
                        blank=True,
                        help_text="Lessons learned from the incident",
                        null=True,
                    ),
                ),
                (
                    "recommendations",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="Recommendations for improvement",
                    ),
                ),
                (
                    "lessons_learned_date",
                    models.DateTimeField(
                        blank=True,
                        help_text="Date of lessons learned review",
                        null=True,
                    ),
                ),
                (
                    "requires_remediation",
                    models.BooleanField(
                        default=False,
                        help_text="Whether remediation is required",
                    ),
                ),
                (
                    "remediation_plan",
                    models.TextField(
                        blank=True,
                        help_text="Remediation plan",
                        null=True,
                    ),
                ),
                (
                    "poam_id",
                    models.UUIDField(
                        blank=True,
                        help_text="ID of POA&M item if created",
                        null=True,
                    ),
                ),
                (
                    "related_change_request_ids",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="IDs of related change requests",
                    ),
                ),
                (
                    "related_incident_ids",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="IDs of related incidents",
                    ),
                ),
                (
                    "affected_ksi_ids",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="KSIs affected by this incident",
                    ),
                ),
                (
                    "evidence_ids",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="IDs of collected evidence",
                    ),
                ),
                (
                    "evidence_preservation_notes",
                    models.TextField(
                        blank=True,
                        help_text="Notes on evidence preservation",
                        null=True,
                    ),
                ),
                (
                    "reported_in_oar_id",
                    models.UUIDField(
                        blank=True,
                        help_text="OAR where this incident was reported",
                        null=True,
                    ),
                ),
                (
                    "timeline",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="Detailed timeline of incident events",
                    ),
                ),
                (
                    "tags",
                    models.JSONField(blank=True, default=list),
                ),
                (
                    "metadata",
                    models.JSONField(blank=True, default=dict),
                ),
            ],
            options={
                "verbose_name": "Security Incident",
                "verbose_name_plural": "Security Incidents",
                "db_table": "fedramp_security_incidents",
                "ordering": ["-detected_at"],
                "indexes": [
                    models.Index(
                        fields=["cloud_service_offering_id", "status"],
                        name="fedramp_inc_cso_status_idx",
                    ),
                    models.Index(
                        fields=["severity", "status"],
                        name="fedramp_inc_sev_status_idx",
                    ),
                    models.Index(
                        fields=["category", "status"],
                        name="fedramp_inc_cat_status_idx",
                    ),
                    models.Index(
                        fields=["uscert_reporting_status"],
                        name="fedramp_inc_uscert_idx",
                    ),
                    models.Index(
                        fields=["detected_at"],
                        name="fedramp_inc_detected_idx",
                    ),
                    models.Index(
                        fields=["uscert_reporting_deadline"],
                        name="fedramp_inc_deadline_idx",
                    ),
                    models.Index(
                        fields=["created_at"],
                        name="fedramp_inc_created_idx",
                    ),
                ],
            },
        ),
    ]
