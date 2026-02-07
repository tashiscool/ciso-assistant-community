"""
Vendor Questionnaire Template Service

Provides pre-built vendor assessment questionnaire templates based on
common security and compliance frameworks (SOC 2, ISO 27001, NIST CSF, SIG Lite).
Handles template instantiation and mapping to the existing Questionnaire/Question models.
"""

import uuid
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from datetime import datetime

from django.utils import timezone

from ..models.questionnaire import Questionnaire
from ..models.question import Question


@dataclass
class QuestionSpec:
    """Specification for a single question within a template."""
    text: str
    type: str  # yes_no, text, choice, single_choice, number, date, file_upload
    required: bool = True
    help_text: str = ""
    options: Optional[List[str]] = None
    scoring_weight: int = 1

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "text": self.text,
            "type": self.type,
            "required": self.required,
            "help_text": self.help_text,
            "scoring_weight": self.scoring_weight,
        }
        if self.options:
            result["options"] = self.options
        return result


@dataclass
class CategorySpec:
    """Specification for a category/section of questions."""
    name: str
    description: str = ""
    questions: List[QuestionSpec] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "questions": [q.to_dict() for q in self.questions],
        }


@dataclass
class QuestionnaireTemplate:
    """Complete questionnaire template definition."""
    name: str
    framework: str
    description: str
    version: str = "1.0"
    estimated_duration_minutes: int = 60
    categories: List[CategorySpec] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "framework": self.framework,
            "description": self.description,
            "version": self.version,
            "estimated_duration_minutes": self.estimated_duration_minutes,
            "categories": [c.to_dict() for c in self.categories],
            "total_questions": sum(len(c.questions) for c in self.categories),
        }

    @property
    def total_questions(self) -> int:
        return sum(len(c.questions) for c in self.categories)


# ---------------------------------------------------------------------------
# Pre-built Templates
# ---------------------------------------------------------------------------

_SOC2_TEMPLATE = QuestionnaireTemplate(
    name="SOC 2 Type II Vendor Assessment",
    framework="soc2",
    description="Comprehensive vendor assessment based on SOC 2 Trust Services Criteria covering Security, Availability, Processing Integrity, Confidentiality, and Privacy.",
    version="2.0",
    estimated_duration_minutes=90,
    categories=[
        CategorySpec(
            name="Security",
            description="Controls related to protection of systems and data against unauthorized access.",
            questions=[
                QuestionSpec(
                    text="Do you have a documented information security policy that is reviewed at least annually?",
                    type="yes_no",
                    help_text="Provide a reference to your information security policy and its most recent review date.",
                ),
                QuestionSpec(
                    text="Describe your access control procedures, including user provisioning and de-provisioning processes.",
                    type="text",
                    help_text="Include details on role-based access, least-privilege enforcement, and access review frequency.",
                ),
                QuestionSpec(
                    text="Do you perform regular vulnerability assessments and penetration tests?",
                    type="yes_no",
                    help_text="Specify frequency and whether tests are conducted by an independent third party.",
                ),
                QuestionSpec(
                    text="Describe your incident response process, including escalation procedures and notification timelines.",
                    type="text",
                    help_text="Include roles, communication plans, and post-incident review processes.",
                ),
                QuestionSpec(
                    text="Do you encrypt data at rest and in transit using industry-standard algorithms?",
                    type="yes_no",
                    help_text="Specify encryption standards (e.g., AES-256, TLS 1.2+).",
                ),
                QuestionSpec(
                    text="Do you maintain a formal change management process for production systems?",
                    type="yes_no",
                    help_text="Describe approval workflows, testing requirements, and rollback procedures.",
                ),
                QuestionSpec(
                    text="How do you manage and monitor privileged access to critical systems?",
                    type="text",
                    help_text="Include details on privileged access workstations, session recording, and MFA requirements.",
                ),
            ],
        ),
        CategorySpec(
            name="Availability",
            description="Controls ensuring systems are available for operation and use as committed.",
            questions=[
                QuestionSpec(
                    text="What is your guaranteed uptime SLA?",
                    type="single_choice",
                    options=["99.0%", "99.5%", "99.9%", "99.95%", "99.99%", "Other"],
                ),
                QuestionSpec(
                    text="Describe your disaster recovery plan, including geographic redundancy.",
                    type="text",
                    help_text="Include details on failover sites, data replication strategy, and DR testing schedule.",
                ),
                QuestionSpec(
                    text="What is your Recovery Time Objective (RTO)?",
                    type="single_choice",
                    options=["< 1 hour", "1-4 hours", "4-8 hours", "8-24 hours", "> 24 hours"],
                ),
                QuestionSpec(
                    text="What is your Recovery Point Objective (RPO)?",
                    type="single_choice",
                    options=["Zero (synchronous replication)", "< 1 hour", "1-4 hours", "4-24 hours", "> 24 hours"],
                ),
                QuestionSpec(
                    text="How often do you test your disaster recovery and business continuity plans?",
                    type="single_choice",
                    options=["Monthly", "Quarterly", "Semi-annually", "Annually", "Never"],
                ),
            ],
        ),
        CategorySpec(
            name="Confidentiality",
            description="Controls protecting confidential information throughout its lifecycle.",
            questions=[
                QuestionSpec(
                    text="Do you have a data classification policy?",
                    type="yes_no",
                    help_text="Describe classification levels and handling requirements for each level.",
                ),
                QuestionSpec(
                    text="How do you ensure secure disposal of data and media when no longer needed?",
                    type="text",
                    help_text="Include details on data sanitization methods and certificates of destruction.",
                ),
                QuestionSpec(
                    text="Do you have confidentiality agreements in place with all employees and contractors?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Describe your data loss prevention (DLP) controls.",
                    type="text",
                    help_text="Include network DLP, endpoint DLP, and cloud DLP capabilities.",
                ),
                QuestionSpec(
                    text="Do you restrict and monitor the use of removable media?",
                    type="yes_no",
                ),
            ],
        ),
        CategorySpec(
            name="Processing Integrity",
            description="Controls ensuring system processing is complete, valid, accurate, and authorized.",
            questions=[
                QuestionSpec(
                    text="Do you have input validation controls to ensure data accuracy?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Describe your quality assurance and testing processes before production deployments.",
                    type="text",
                ),
                QuestionSpec(
                    text="Do you maintain audit trails for data processing activities?",
                    type="yes_no",
                    help_text="Include details on log retention periods and tamper-proofing measures.",
                ),
                QuestionSpec(
                    text="How do you detect and correct processing errors?",
                    type="text",
                ),
                QuestionSpec(
                    text="Do you perform reconciliation checks between systems?",
                    type="yes_no",
                ),
            ],
        ),
        CategorySpec(
            name="Privacy",
            description="Controls related to personal information collection, use, retention, and disposal.",
            questions=[
                QuestionSpec(
                    text="Do you have a published privacy policy that complies with applicable regulations?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Describe how you handle data subject access requests (DSARs).",
                    type="text",
                    help_text="Include process, timelines, and verification procedures.",
                ),
                QuestionSpec(
                    text="Do you conduct privacy impact assessments for new systems or changes?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="How do you ensure third-party sub-processors meet your privacy obligations?",
                    type="text",
                ),
                QuestionSpec(
                    text="Do you have mechanisms for obtaining and managing user consent?",
                    type="yes_no",
                ),
            ],
        ),
    ],
)

_ISO27001_TEMPLATE = QuestionnaireTemplate(
    name="ISO 27001 Vendor Assessment",
    framework="iso27001",
    description="Vendor security assessment aligned with ISO/IEC 27001:2022 Annex A controls for information security management.",
    version="2022",
    estimated_duration_minutes=75,
    categories=[
        CategorySpec(
            name="Information Security Policies (A.5)",
            description="Management direction and support for information security.",
            questions=[
                QuestionSpec(
                    text="Do you have a set of information security policies approved by management?",
                    type="yes_no",
                    help_text="Reference ISO 27001 A.5.1",
                ),
                QuestionSpec(
                    text="How often are your information security policies reviewed and updated?",
                    type="single_choice",
                    options=["Quarterly", "Semi-annually", "Annually", "Every 2 years", "No regular review"],
                ),
                QuestionSpec(
                    text="Are information security responsibilities clearly defined and assigned?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Do you maintain contact with relevant authorities and special interest groups for security intelligence?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Describe how information security is addressed in project management.",
                    type="text",
                ),
            ],
        ),
        CategorySpec(
            name="Access Control (A.9)",
            description="Controls for limiting access to information and information processing facilities.",
            questions=[
                QuestionSpec(
                    text="Do you have a formal access control policy?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Describe your user registration and de-registration process.",
                    type="text",
                    help_text="Include identity verification and access provisioning workflows.",
                ),
                QuestionSpec(
                    text="Do you enforce multi-factor authentication for all remote and privileged access?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="How frequently do you perform access rights reviews?",
                    type="single_choice",
                    options=["Monthly", "Quarterly", "Semi-annually", "Annually", "No regular review"],
                ),
                QuestionSpec(
                    text="Do you implement network segregation to separate critical systems?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Describe your password policy requirements.",
                    type="text",
                    help_text="Include minimum length, complexity, rotation, and history requirements.",
                ),
            ],
        ),
        CategorySpec(
            name="Cryptography (A.10)",
            description="Controls for proper and effective use of cryptography.",
            questions=[
                QuestionSpec(
                    text="Do you have a cryptographic key management policy?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="What encryption standards do you use for data at rest?",
                    type="text",
                    help_text="Specify algorithms and key lengths (e.g., AES-256).",
                ),
                QuestionSpec(
                    text="What TLS versions do you support for data in transit?",
                    type="single_choice",
                    options=["TLS 1.3 only", "TLS 1.2 and 1.3", "TLS 1.1+", "Mixed/Unknown"],
                ),
                QuestionSpec(
                    text="How do you manage cryptographic key lifecycle (generation, storage, rotation, destruction)?",
                    type="text",
                ),
                QuestionSpec(
                    text="Do you use hardware security modules (HSMs) for critical key storage?",
                    type="yes_no",
                ),
            ],
        ),
        CategorySpec(
            name="Operations Security (A.12)",
            description="Controls ensuring correct and secure operations of information processing.",
            questions=[
                QuestionSpec(
                    text="Do you have documented operating procedures for critical systems?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Describe your malware protection strategy.",
                    type="text",
                    help_text="Include endpoint protection, email security, and detection/response capabilities.",
                ),
                QuestionSpec(
                    text="Do you perform regular backups and test restoration procedures?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Do you maintain audit logs and monitor them for security events?",
                    type="yes_no",
                    help_text="Include details on SIEM usage, log retention, and monitoring coverage.",
                ),
                QuestionSpec(
                    text="How do you manage technical vulnerabilities (patching cadence and process)?",
                    type="text",
                ),
            ],
        ),
        CategorySpec(
            name="Supplier Relationships (A.15)",
            description="Controls for managing security in supplier and third-party relationships.",
            questions=[
                QuestionSpec(
                    text="Do you have a supplier security policy and assessment process?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="How do you monitor and review supplier security performance?",
                    type="text",
                ),
                QuestionSpec(
                    text="Do your supplier agreements include information security requirements?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Do you maintain an inventory of all sub-processors and fourth parties?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Describe your process for managing changes in the supplier chain.",
                    type="text",
                ),
            ],
        ),
    ],
)

_NIST_CSF_TEMPLATE = QuestionnaireTemplate(
    name="NIST Cybersecurity Framework Vendor Assessment",
    framework="nist_csf",
    description="Vendor assessment based on the NIST Cybersecurity Framework (CSF) 2.0 core functions: Govern, Identify, Protect, Detect, Respond, and Recover.",
    version="2.0",
    estimated_duration_minutes=80,
    categories=[
        CategorySpec(
            name="Govern (GV)",
            description="Establishing and monitoring the organization's cybersecurity risk management strategy, expectations, and policy.",
            questions=[
                QuestionSpec(
                    text="Does your organization have a cybersecurity risk management strategy approved by senior leadership?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Describe your cybersecurity governance structure, including roles and responsibilities.",
                    type="text",
                ),
                QuestionSpec(
                    text="Do you have a cybersecurity risk appetite statement?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="How do you ensure cybersecurity requirements are integrated into enterprise risk management?",
                    type="text",
                ),
                QuestionSpec(
                    text="Do you have a cybersecurity supply chain risk management policy?",
                    type="yes_no",
                ),
            ],
        ),
        CategorySpec(
            name="Identify (ID)",
            description="Understanding organizational context, assets, risks, and improvement opportunities.",
            questions=[
                QuestionSpec(
                    text="Do you maintain a comprehensive asset inventory (hardware, software, data)?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Describe your risk assessment methodology and frequency.",
                    type="text",
                    help_text="Include threat modeling, vulnerability assessment, and risk quantification approaches.",
                ),
                QuestionSpec(
                    text="Do you identify and document data flows, especially for sensitive information?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="How do you identify critical business processes and their cybersecurity dependencies?",
                    type="text",
                ),
                QuestionSpec(
                    text="Do you maintain awareness of current cyber threats relevant to your industry?",
                    type="yes_no",
                    help_text="Describe threat intelligence sources and consumption processes.",
                ),
            ],
        ),
        CategorySpec(
            name="Protect (PR)",
            description="Safeguards to manage cybersecurity risks.",
            questions=[
                QuestionSpec(
                    text="Do you provide cybersecurity awareness training to all personnel?",
                    type="yes_no",
                    help_text="Specify frequency and topics covered.",
                ),
                QuestionSpec(
                    text="Describe your identity management and access control approach.",
                    type="text",
                    help_text="Include authentication mechanisms, authorization models, and identity lifecycle.",
                ),
                QuestionSpec(
                    text="Do you implement data security controls appropriate to classification levels?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Describe your platform and infrastructure security hardening practices.",
                    type="text",
                    help_text="Include secure configuration baselines, CIS benchmarks, or equivalent.",
                ),
                QuestionSpec(
                    text="Do you have resilience mechanisms in place (redundancy, failover, load balancing)?",
                    type="yes_no",
                ),
            ],
        ),
        CategorySpec(
            name="Detect (DE)",
            description="Activities to identify the occurrence of cybersecurity events.",
            questions=[
                QuestionSpec(
                    text="Do you have continuous monitoring capabilities for cybersecurity events?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Describe your security event detection and analysis capabilities.",
                    type="text",
                    help_text="Include SIEM, EDR, NDR, and SOC capabilities.",
                ),
                QuestionSpec(
                    text="What is your mean time to detect (MTTD) for security incidents?",
                    type="single_choice",
                    options=["< 1 hour", "1-4 hours", "4-24 hours", "1-7 days", "> 7 days", "Unknown"],
                ),
                QuestionSpec(
                    text="Do you perform regular threat hunting activities?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="How do you correlate events across different security tools and data sources?",
                    type="text",
                ),
            ],
        ),
        CategorySpec(
            name="Respond (RS)",
            description="Activities to take action regarding a detected cybersecurity incident.",
            questions=[
                QuestionSpec(
                    text="Do you have a documented incident response plan?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="How quickly do you notify affected parties after confirming a data breach?",
                    type="single_choice",
                    options=["Within 24 hours", "Within 48 hours", "Within 72 hours", "As required by law", "No defined timeline"],
                ),
                QuestionSpec(
                    text="Do you conduct post-incident reviews and implement lessons learned?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Describe your incident containment and eradication procedures.",
                    type="text",
                ),
                QuestionSpec(
                    text="Do you have cyber insurance coverage?",
                    type="yes_no",
                ),
            ],
        ),
        CategorySpec(
            name="Recover (RC)",
            description="Activities to restore capabilities or services impaired by a cybersecurity incident.",
            questions=[
                QuestionSpec(
                    text="Do you have a recovery plan that is tested regularly?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Describe your communication plan for recovery operations.",
                    type="text",
                    help_text="Include internal and external stakeholder communication processes.",
                ),
                QuestionSpec(
                    text="How do you incorporate improvements from incidents and recovery exercises?",
                    type="text",
                ),
                QuestionSpec(
                    text="What is your target recovery time for critical services?",
                    type="single_choice",
                    options=["< 1 hour", "1-4 hours", "4-8 hours", "8-24 hours", "> 24 hours"],
                ),
                QuestionSpec(
                    text="Do you validate the integrity of restored systems and data after recovery?",
                    type="yes_no",
                ),
            ],
        ),
    ],
)

_SIG_LITE_TEMPLATE = QuestionnaireTemplate(
    name="SIG Lite Vendor Assessment",
    framework="sig_lite",
    description="Standardized Information Gathering (SIG) Lite questionnaire for third-party risk assessment, covering key domains of enterprise security governance.",
    version="2024",
    estimated_duration_minutes=60,
    categories=[
        CategorySpec(
            name="Enterprise Risk Management",
            description="Organizational approach to managing information security risks.",
            questions=[
                QuestionSpec(
                    text="Does your organization have a formal information security program?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Is there an executive-level role responsible for information security (e.g., CISO)?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Do you carry out formal risk assessments at least annually?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Do you have a risk treatment plan that addresses identified risks?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Do you maintain security certifications or attestations (e.g., SOC 2, ISO 27001)?",
                    type="text",
                    help_text="List all current certifications, their scope, and most recent audit dates.",
                ),
            ],
        ),
        CategorySpec(
            name="Security Policy",
            description="Documented security policies and procedures.",
            questions=[
                QuestionSpec(
                    text="Do you have documented information security policies available to all personnel?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Are security policies reviewed and updated at least annually?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Do you have an acceptable use policy for information assets?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Is there a formal disciplinary process for security policy violations?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Do employees acknowledge and sign security policies upon hire and annually thereafter?",
                    type="yes_no",
                ),
            ],
        ),
        CategorySpec(
            name="Human Resource Security",
            description="Security considerations for employees and contractors.",
            questions=[
                QuestionSpec(
                    text="Do you conduct background checks on employees with access to sensitive data?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Do you provide security awareness training to all employees?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="How frequently is security awareness training conducted?",
                    type="single_choice",
                    options=["Monthly", "Quarterly", "Semi-annually", "Annually", "At hire only"],
                ),
                QuestionSpec(
                    text="Do you have a process for revoking access upon employee termination?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Are contractors and temporary workers subject to the same security requirements as employees?",
                    type="yes_no",
                ),
            ],
        ),
        CategorySpec(
            name="Network Security",
            description="Controls for protecting network infrastructure.",
            questions=[
                QuestionSpec(
                    text="Do you use firewalls and intrusion detection/prevention systems?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Do you segment your network to isolate sensitive environments?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Do you perform regular network vulnerability scans?",
                    type="yes_no",
                    help_text="Specify scanning frequency and tools used.",
                ),
                QuestionSpec(
                    text="Do you monitor network traffic for anomalous activity?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Do you restrict remote access and require VPN or equivalent secure connectivity?",
                    type="yes_no",
                ),
            ],
        ),
        CategorySpec(
            name="Physical Security",
            description="Controls for physical facility and equipment protection.",
            questions=[
                QuestionSpec(
                    text="Are data centers and server rooms protected with physical access controls?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Do you have environmental controls (fire suppression, climate control, UPS)?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Is visitor access to sensitive areas logged and escorted?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Do you use video surveillance in critical areas?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Describe your clean desk and secure disposal policies.",
                    type="text",
                ),
            ],
        ),
        CategorySpec(
            name="Business Continuity & Incident Response",
            description="Preparedness for disruptions and security incidents.",
            questions=[
                QuestionSpec(
                    text="Do you have a documented business continuity plan?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="Do you have a documented incident response plan?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="How often do you test your business continuity and incident response plans?",
                    type="single_choice",
                    options=["Quarterly", "Semi-annually", "Annually", "Every 2+ years", "Never"],
                ),
                QuestionSpec(
                    text="Do you have a defined process for notifying clients of security incidents?",
                    type="yes_no",
                ),
                QuestionSpec(
                    text="What is your target notification timeline for data breaches affecting client data?",
                    type="single_choice",
                    options=["Within 24 hours", "Within 48 hours", "Within 72 hours", "As required by contract", "No defined timeline"],
                ),
            ],
        ),
    ],
)


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class VendorQuestionnaireService:
    """
    Service for managing vendor questionnaire templates.

    Provides access to pre-built templates for common security frameworks
    and handles creating Questionnaire/Question model instances from
    template definitions.
    """

    TEMPLATES: Dict[str, QuestionnaireTemplate] = {
        "soc2": _SOC2_TEMPLATE,
        "iso27001": _ISO27001_TEMPLATE,
        "nist_csf": _NIST_CSF_TEMPLATE,
        "sig_lite": _SIG_LITE_TEMPLATE,
    }

    def get_template(self, template_id: str) -> Optional[QuestionnaireTemplate]:
        """
        Retrieve a specific questionnaire template by ID.

        Args:
            template_id: Template identifier (e.g., 'soc2', 'iso27001').

        Returns:
            QuestionnaireTemplate or None if not found.
        """
        return self.TEMPLATES.get(template_id)

    def list_templates(self) -> List[Dict[str, Any]]:
        """
        List all available questionnaire templates with summary information.

        Returns:
            List of template summaries (id, name, framework, question count, duration).
        """
        summaries = []
        for template_id, template in self.TEMPLATES.items():
            summaries.append({
                "id": template_id,
                "name": template.name,
                "framework": template.framework,
                "description": template.description,
                "version": template.version,
                "total_questions": template.total_questions,
                "categories": len(template.categories),
                "estimated_duration_minutes": template.estimated_duration_minutes,
            })
        return summaries

    def create_questionnaire_from_template(
        self,
        template_id: str,
        entity_id: Optional[str] = None,
        custom_title: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Create a full Questionnaire with Question objects from a template.

        Instantiates the Questionnaire and Question Django model instances
        persisted to the database, suitable for a vendor assessment workflow.

        Args:
            template_id: Template identifier.
            entity_id: UUID of the vendor Entity this questionnaire targets.
            custom_title: Optional override for the questionnaire title.

        Returns:
            Dictionary with created questionnaire ID and question IDs, or None.
        """
        template = self.get_template(template_id)
        if template is None:
            return None

        # Create the Questionnaire model instance
        questionnaire = Questionnaire()
        title = custom_title or f"{template.name}"
        if entity_id:
            title = f"{title} - Vendor {entity_id[:8]}"

        questionnaire.create_questionnaire(
            title=title,
            questionnaire_type="assessment",
            description=template.description,
            category=f"vendor_assessment:{template.framework}",
            tags=["vendor-assessment", template.framework, "tprm"],
        )
        questionnaire.questionnaire_version = template.version
        questionnaire.estimated_duration_minutes = template.estimated_duration_minutes
        questionnaire.show_progress_bar = True
        questionnaire.enable_scoring = True
        questionnaire.requires_authentication = False  # Vendor portal uses token auth
        questionnaire.save()

        question_ids: List[str] = []
        order_counter = 0

        for category in template.categories:
            for q_spec in category.questions:
                question = Question()
                question_type = self._map_question_type(q_spec.type)
                options = self._build_options(q_spec) if q_spec.options else []

                question.create_question(
                    text=q_spec.text,
                    question_type=question_type,
                    help_text=q_spec.help_text or None,
                    options=options,
                    is_required=q_spec.required,
                    tags=[template.framework, category.name.lower()],
                )
                question.section = category.name
                question.order = order_counter
                question.enable_scoring = True
                question.points = q_spec.scoring_weight
                question.save()

                questionnaire.add_question(str(question.id))
                question_ids.append(str(question.id))
                order_counter += 1

        questionnaire.save()

        return {
            "questionnaire_id": str(questionnaire.id),
            "template_id": template_id,
            "framework": template.framework,
            "entity_id": entity_id,
            "title": questionnaire.title,
            "question_ids": question_ids,
            "total_questions": len(question_ids),
        }

    def generate_from_framework(self, framework_id: str) -> Optional[QuestionnaireTemplate]:
        """
        Generate a questionnaire template based on a loaded compliance framework.

        This is a placeholder for dynamic template generation from frameworks
        stored in the CISO Assistant library system. For now, it returns the
        matching pre-built template if one exists.

        Args:
            framework_id: Framework identifier.

        Returns:
            QuestionnaireTemplate or None.
        """
        # Map common framework references to our pre-built templates
        framework_map = {
            "soc2": "soc2",
            "soc-2": "soc2",
            "iso27001": "iso27001",
            "iso-27001": "iso27001",
            "nist-csf": "nist_csf",
            "nist_csf": "nist_csf",
            "nistcsf": "nist_csf",
            "sig": "sig_lite",
            "sig_lite": "sig_lite",
            "sig-lite": "sig_lite",
        }
        mapped_id = framework_map.get(framework_id.lower())
        if mapped_id:
            return self.get_template(mapped_id)
        return None

    def get_template_preview(self, template_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a detailed preview of a template including all questions.

        Args:
            template_id: Template identifier.

        Returns:
            Full template data as a dictionary or None.
        """
        template = self.get_template(template_id)
        if template is None:
            return None
        return template.to_dict()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _map_question_type(spec_type: str) -> str:
        """Map template question types to Django model question types."""
        mapping = {
            "yes_no": "yes_no",
            "text": "textarea",
            "choice": "single_choice",
            "single_choice": "single_choice",
            "multiple_choice": "multiple_choice",
            "number": "number",
            "date": "date",
            "file_upload": "file_upload",
            "rating": "rating",
        }
        return mapping.get(spec_type, "text")

    @staticmethod
    def _build_options(q_spec: QuestionSpec) -> List[Dict[str, Any]]:
        """Build options list from a QuestionSpec's options strings."""
        if not q_spec.options:
            return []
        return [
            {
                "value": opt.lower().replace(" ", "_").replace("/", "_").replace("%", "pct"),
                "label": opt,
                "score": 0,
                "order": idx,
            }
            for idx, opt in enumerate(q_spec.options)
        ]
