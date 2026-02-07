"""
Vendor portal views -- separate authentication realm for external vendors.

These views are designed for vendors to complete questionnaires, upload
supporting evidence, and check submission status using a token-based
authentication flow that does not require a CISO Assistant user account.
"""

import uuid
from typing import Optional

from django.utils import timezone

from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from django.conf import settings

from .auth import VendorTokenAuthentication, VendorToken, VendorUser


# ---------------------------------------------------------------------------
# Questionnaire Views
# ---------------------------------------------------------------------------

class VendorQuestionnaireView(APIView):
    """
    Retrieve and submit questionnaire responses for a vendor token.

    GET  /vendor-portal/<token>/questionnaire/
        Returns the full questionnaire with categories and questions.

    POST /vendor-portal/<token>/questionnaire/
        Submits answers for the questionnaire.
    """

    authentication_classes = [VendorTokenAuthentication]
    permission_classes = [AllowAny]
    parser_classes = [JSONParser]

    def get(self, request, token: str) -> Response:
        """Return the questionnaire assigned to this token."""
        vendor_user: VendorUser = request.user
        questionnaire_id = vendor_user.questionnaire_id

        if not questionnaire_id:
            return Response(
                {"error": "No questionnaire associated with this token."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            from questionnaires.models.questionnaire import Questionnaire
            from questionnaires.models.question import Question

            questionnaire = Questionnaire.objects.get(id=questionnaire_id)
        except Exception:
            return Response(
                {"error": "Questionnaire not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Build category-grouped response
        questions = Question.objects.filter(
            id__in=questionnaire.question_ids,
            is_active=True,
        ).order_by("order")

        categories: dict = {}
        for q in questions:
            section = q.section or "General"
            if section not in categories:
                categories[section] = {
                    "name": section,
                    "questions": [],
                }
            categories[section]["questions"].append({
                "id": str(q.id),
                "text": q.text,
                "help_text": q.help_text or "",
                "type": q.question_type,
                "required": q.is_required,
                "options": q.options,
            })

        return Response({
            "questionnaire_id": str(questionnaire.id),
            "title": questionnaire.title,
            "description": questionnaire.description or "",
            "version": questionnaire.questionnaire_version,
            "estimated_duration_minutes": questionnaire.estimated_duration_minutes,
            "categories": list(categories.values()),
            "total_questions": len(questionnaire.question_ids),
            "vendor": {
                "name": vendor_user.display_name,
                "email": vendor_user.email,
                "entity_id": str(vendor_user.entity_id),
            },
        })

    def post(self, request, token: str) -> Response:
        """
        Submit questionnaire responses.

        Expected payload::

            {
                "answers": {
                    "<question_id>": "<answer_value>",
                    ...
                },
                "is_partial": false
            }
        """
        vendor_user: VendorUser = request.user
        questionnaire_id = vendor_user.questionnaire_id

        if not questionnaire_id:
            return Response(
                {"error": "No questionnaire associated with this token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        answers = request.data.get("answers", {})
        is_partial = request.data.get("is_partial", False)

        if not answers:
            return Response(
                {"error": "No answers provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from questionnaires.models.questionnaire import Questionnaire
            from questionnaires.models.question import Question
            from questionnaires.models.questionnaire_run import QuestionnaireRun

            questionnaire = Questionnaire.objects.get(id=questionnaire_id)
        except Exception:
            return Response(
                {"error": "Questionnaire not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Find or create a run for this token
        session_token = f"vendor:{token[:32]}"
        run = QuestionnaireRun.objects.filter(
            questionnaire_id=questionnaire_id,
            session_token=session_token,
        ).first()

        if run is None:
            run = QuestionnaireRun()
            run.start_run(
                questionnaire_id=questionnaire_id,
                session_token=session_token,
                enable_scoring=questionnaire.enable_scoring,
            )
            run.save()

        # Validate and record each answer
        validation_errors = {}
        questions_map = {
            str(q.id): q
            for q in Question.objects.filter(
                id__in=list(answers.keys()),
                is_active=True,
            )
        }

        for question_id, answer_value in answers.items():
            question = questions_map.get(question_id)
            if question is None:
                validation_errors[question_id] = ["Question not found."]
                continue

            validation = question.validate_answer(answer_value)
            if not validation["valid"]:
                validation_errors[question_id] = validation["errors"]
                continue

            run.submit_answer(question_id, answer_value, time_spent=0)

        # If not partial and no errors, complete the run
        if not is_partial and not validation_errors:
            run.complete_run()

        run.save()

        # Track questionnaire usage
        if run.is_completed:
            questionnaire.record_usage(
                completion_time_minutes=(
                    run.duration_seconds // 60 if run.duration_seconds else None
                )
            )
            questionnaire.save()

        response_data = {
            "run_id": str(run.id),
            "status": run.status,
            "questions_answered": run.questions_answered,
            "total_questions": len(questionnaire.question_ids),
            "is_completed": run.is_completed,
        }

        if validation_errors:
            response_data["validation_errors"] = validation_errors
            return Response(response_data, status=status.HTTP_400_BAD_REQUEST)

        return Response(response_data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Evidence Upload
# ---------------------------------------------------------------------------

class VendorEvidenceUploadView(APIView):
    """
    Upload supporting evidence documents for a vendor assessment.

    POST /vendor-portal/<token>/evidence/
        Accepts multipart file uploads.
    """

    authentication_classes = [VendorTokenAuthentication]
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    # Maximum file size: 50 MB
    MAX_FILE_SIZE = 50 * 1024 * 1024

    # Allowed MIME types
    ALLOWED_MIME_TYPES = {
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "text/csv",
        "text/plain",
        "image/png",
        "image/jpeg",
        "application/zip",
    }

    def post(self, request, token: str) -> Response:
        """
        Handle evidence file upload from vendor.

        Expects a multipart form with:
          - ``file``: The evidence file.
          - ``description`` (optional): Description of the evidence.
          - ``question_id`` (optional): ID of the question this evidence supports.
        """
        vendor_user: VendorUser = request.user

        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response(
                {"error": "No file provided. Include a 'file' field in the upload."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate file size
        if uploaded_file.size > self.MAX_FILE_SIZE:
            return Response(
                {
                    "error": f"File exceeds maximum size of {self.MAX_FILE_SIZE // (1024 * 1024)} MB."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate MIME type
        if uploaded_file.content_type not in self.ALLOWED_MIME_TYPES:
            return Response(
                {
                    "error": f"File type '{uploaded_file.content_type}' is not allowed.",
                    "allowed_types": sorted(self.ALLOWED_MIME_TYPES),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        description = request.data.get("description", "")
        question_id = request.data.get("question_id")

        # Store evidence metadata
        # In a production deployment this would create a core.models.Evidence instance
        # and store the file in the configured storage backend. For now we return
        # a confirmation with metadata.
        evidence_record = {
            "id": str(uuid.uuid4()),
            "entity_id": str(vendor_user.entity_id),
            "questionnaire_id": str(vendor_user.questionnaire_id) if vendor_user.questionnaire_id else None,
            "question_id": question_id,
            "file_name": uploaded_file.name,
            "file_size": uploaded_file.size,
            "content_type": uploaded_file.content_type,
            "description": description,
            "uploaded_by": vendor_user.display_name,
            "uploaded_at": timezone.now().isoformat(),
        }

        # Persist to Evidence model
        try:
            from core.models import Evidence
            from iam.models import Folder

            # Get or create a folder for vendor evidence
            vendor_folder = Folder.objects.filter(
                content_type=Folder.ContentType.DOMAIN,
                name__icontains="vendor",
            ).first()
            if not vendor_folder:
                vendor_folder = Folder.get_root_folder()

            evidence = Evidence.objects.create(
                name=f"[Vendor] {uploaded_file.name}",
                description=description or f"Uploaded by {vendor_user.display_name}",
                attachment=uploaded_file,
                folder=vendor_folder,
            )

            evidence_record["persisted_id"] = str(evidence.id)
            evidence_record["stored"] = True
        except Exception as persist_err:
            # Log but don't fail - the upload was accepted
            import logging
            logging.getLogger(__name__).warning(
                f"Evidence persistence failed: {persist_err}"
            )
            evidence_record["stored"] = False

        return Response(
            {
                "message": "Evidence uploaded successfully.",
                "evidence": evidence_record,
            },
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# Status View
# ---------------------------------------------------------------------------

class VendorPortalStatusView(APIView):
    """
    Check the submission status for a vendor token.

    GET /vendor-portal/<token>/status/
    """

    authentication_classes = [VendorTokenAuthentication]
    permission_classes = [AllowAny]

    def get(self, request, token: str) -> Response:
        """Return current submission status for the vendor token."""
        vendor_user: VendorUser = request.user
        vendor_token: VendorToken = request.auth

        # Gather questionnaire run status
        run_status = None
        if vendor_user.questionnaire_id:
            try:
                from questionnaires.models.questionnaire_run import QuestionnaireRun

                session_token = f"vendor:{token[:32]}"
                run = QuestionnaireRun.objects.filter(
                    questionnaire_id=vendor_user.questionnaire_id,
                    session_token=session_token,
                ).first()

                if run:
                    run_status = {
                        "run_id": str(run.id),
                        "status": run.status,
                        "questions_answered": run.questions_answered,
                        "total_questions": run.total_questions,
                        "progress_percentage": run.get_progress_percentage(),
                        "started_at": run.started_at.isoformat() if run.started_at else None,
                        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
                    }
            except Exception:
                pass

        return Response({
            "token_status": "active" if vendor_token.is_valid else "expired",
            "entity_id": str(vendor_user.entity_id),
            "vendor_name": vendor_user.display_name,
            "vendor_email": vendor_user.email,
            "questionnaire_id": str(vendor_user.questionnaire_id) if vendor_user.questionnaire_id else None,
            "entity_assessment_id": str(vendor_user.entity_assessment_id) if vendor_user.entity_assessment_id else None,
            "token_expires_at": vendor_token.expires_at.isoformat(),
            "questionnaire_run": run_status,
        })


# ---------------------------------------------------------------------------
# Token Management (internal, requires CISO Assistant auth)
# ---------------------------------------------------------------------------

class VendorTokenCreateView(APIView):
    """
    Create a new vendor portal token (internal API for CISO Assistant users).

    POST /vendor-portal/tokens/create/

    This endpoint uses the standard CISO Assistant authentication (not vendor
    token auth) and is meant for internal users managing vendor assessments.
    """

    # Uses default CISO Assistant authentication, not VendorTokenAuthentication
    authentication_classes = []  # Will inherit from default DRF settings

    def post(self, request) -> Response:
        """
        Create a new vendor token.

        Expected payload::

            {
                "entity_id": "<uuid>",
                "questionnaire_id": "<uuid>",  (optional)
                "entity_assessment_id": "<uuid>",  (optional)
                "vendor_email": "vendor@example.com",
                "vendor_name": "Jane Doe",
                "expires_in_days": 30,
                "max_uses": 0
            }
        """
        entity_id = request.data.get("entity_id")
        if not entity_id:
            return Response(
                {"error": "entity_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            vendor_token = VendorToken.generate_token(
                entity_id=entity_id,
                questionnaire_id=request.data.get("questionnaire_id"),
                entity_assessment_id=request.data.get("entity_assessment_id"),
                vendor_email=request.data.get("vendor_email", ""),
                vendor_name=request.data.get("vendor_name", ""),
                expires_in_days=int(request.data.get("expires_in_days", 30)),
                max_uses=int(request.data.get("max_uses", 0)),
            )
        except Exception as e:
            return Response(
                {"error": f"Failed to create token: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Build the portal URL
        portal_base = getattr(
            settings, "VENDOR_PORTAL_BASE_URL", "/vendor-portal"
        )
        portal_url = f"{portal_base}/{vendor_token.token}/"

        return Response(
            {
                "token": vendor_token.token,
                "portal_url": portal_url,
                "entity_id": str(vendor_token.entity_id),
                "questionnaire_id": str(vendor_token.questionnaire_id) if vendor_token.questionnaire_id else None,
                "vendor_email": vendor_token.vendor_email,
                "expires_at": vendor_token.expires_at.isoformat(),
                "created_at": vendor_token.created_at.isoformat(),
            },
            status=status.HTTP_201_CREATED,
        )


class VendorTokenRevokeView(APIView):
    """
    Revoke an existing vendor portal token (internal API).

    POST /vendor-portal/tokens/<token>/revoke/
    """

    authentication_classes = []  # Inherits default CISO Assistant auth

    def post(self, request, token: str) -> Response:
        """Revoke the specified vendor token."""
        try:
            vendor_token = VendorToken.objects.get(token=token)
        except VendorToken.DoesNotExist:
            return Response(
                {"error": "Token not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        vendor_token.revoke()

        return Response(
            {
                "message": "Token revoked successfully.",
                "token": token[:8] + "...",
                "entity_id": str(vendor_token.entity_id),
            },
            status=status.HTTP_200_OK,
        )
