/**
 * Auto-generated assessment artifact templates for frontend/Cloudflare compat.
 *
 * Source: backend/assessment_artifacts/services/templates.py (fedramp_moderate_aws_rhel7)
 */

import type { ParsedItem } from './builder';

export type AssessmentTemplateData = {
	key: string;
	name: string;
	description: string;
	framework: string;
	platforms: string[];
	item_count: number;
	items: ParsedItem[];
};

export const ASSESSMENT_ARTIFACT_TEMPLATES: Record<string, AssessmentTemplateData> = {
  "fedramp_moderate_aws_rhel7": {
    "key": "fedramp_moderate_aws_rhel7",
    "name": "FedRAMP Moderate \u2014 AWS + RHEL 7",
    "description": "Complete NIST 800-53 Rev 4 evidence request template for a FedRAMP Moderate system running on AWS with RHEL 7 hosts. Covers all 17 control families with ~200 evidence items including CLI commands, configuration paths, and periodic collection schedules (weekly/monthly/quarterly/annual).",
    "framework": "NIST 800-53 Rev 4",
    "platforms": [
      "AWS",
      "RHEL7",
      "LINUX",
      "ORACLE_DB",
      "POSTGRES_DB",
      "SPLUNK",
      "NESSUS",
      "TREND_MICRO",
      "JENKINS",
      "NETWORK_BOUNDARY"
    ],
    "item_count": 184,
    "items": [
      {
        "request_id": "REQ-0001",
        "source_line": 1,
        "request_date": null,
        "category": "Policy",
        "workstreams": [],
        "controls": [
          "AC-1"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Access Control Policy and Procedures document",
        "artifact_types": [
          "policy_document"
        ],
        "primary_artifact_type": "policy_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0001-access-control-policy-and-procedures-document.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0002",
        "source_line": 2,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "AC-2"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Complete listing of all system user accounts with roles and last login dates",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "tool_export",
        "platform_tags": [
          "AWS",
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "quarterly",
        "commands": [
          "aws iam list-users --output table",
          "aws iam list-groups --output table",
          "cat /etc/passwd",
          "cat /etc/group"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0002-complete-listing-of-all-system-user-accounts-with-roles-and-last-login-dates.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0003",
        "source_line": 3,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "AC-2"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Evidence of account review and recertification for the past quarter",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "governance_records",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "quarterly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0003-evidence-of-account-review-and-recertification-for-the-past-quarter.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0004",
        "source_line": 4,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AC-2(1)"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "AWS IAM password policy and account lifecycle automation configuration",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "aws iam get-account-password-policy"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0004-aws-iam-password-policy-and-account-lifecycle-automation-configuration.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0005",
        "source_line": 5,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "AC-2(2)"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Evidence of temporary/emergency account removal or expiration within defined timeframes",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "tool_export",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "quarterly",
        "commands": [
          "aws iam list-users --query 'Users[?PasswordLastUsed==`null`]'"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0005-evidence-of-temporary-emergency-account-removal-or-expiration-within-defined-tim.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0006",
        "source_line": 6,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AC-2(3)"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Configuration showing automatic disabling of inactive accounts after 90 days",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0006-configuration-showing-automatic-disabling-of-inactive-accounts-after-90-days.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0007",
        "source_line": 7,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AC-2(4)",
          "AC-2(7)",
          "AU-5",
          "AU-6"
        ],
        "control_families": [
          "AC",
          "AU"
        ],
        "control_domains": [
          "Access Control and Authorization",
          "Audit and Accountability"
        ],
        "supplemental_references": [],
        "artifact_request": "Alert configuration for account creation, modification, disabling, removal, and privilege escalation events",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "tool_export",
        "platform_tags": [
          "AWS",
          "SPLUNK"
        ],
        "time_scopes": [],
        "periodicity": "monthly",
        "commands": [
          "aws cloudwatch describe-alarms --alarm-name-prefix IAM"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0007-alert-configuration-for-account-creation-modification-disabling-removal-and-priv.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0008",
        "source_line": 8,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AC-2(9)"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Shared/group account authorization and usage restrictions",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0008-shared-group-account-authorization-and-usage-restrictions.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0009",
        "source_line": 9,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AC-2(10)"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Shared/group account credential change procedures upon membership change",
        "artifact_types": [
          "procedure_document"
        ],
        "primary_artifact_type": "procedure_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0009-shared-group-account-credential-change-procedures-upon-membership-change.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0010",
        "source_line": 10,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AC-3"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Access enforcement mechanism configuration (IAM policies, SELinux, file permissions)",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS",
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "aws iam list-policies --scope Local --output table",
          "getenforce",
          "cat /etc/selinux/config"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0010-access-enforcement-mechanism-configuration-iam-policies-selinux-file-permissions.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0011",
        "source_line": 11,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AC-4"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Network information flow enforcement \u2014 VPC security groups, NACLs, and flow logs",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "aws ec2 describe-security-groups --output table",
          "aws ec2 describe-network-acls --output table",
          "aws ec2 describe-flow-logs --output table"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0011-network-information-flow-enforcement-vpc-security-groups-nacls-and-flow-logs.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0012",
        "source_line": 12,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "AC-5"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Separation of duties matrix showing conflicting roles are not co-assigned",
        "artifact_types": [
          "matrix_or_mapping"
        ],
        "primary_artifact_type": "matrix_or_mapping",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0012-separation-of-duties-matrix-showing-conflicting-roles-are-not-co-assigned.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0013",
        "source_line": 13,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AC-6",
          "AC-6(1)",
          "AC-6(2)"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Least privilege implementation \u2014 IAM role policies, sudo configuration, privileged user listing",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS",
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "aws iam list-attached-user-policies --user-name <admin>",
          "cat /etc/sudoers",
          "cat /etc/sudoers.d/*"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0013-least-privilege-implementation-iam-role-policies-sudo-configuration-privileged-u.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0014",
        "source_line": 14,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AC-6(5)"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Privileged account listing and restriction to security functions only",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "tool_export",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "quarterly",
        "commands": [
          "aws iam get-account-authorization-details --filter LocalManagedPolicy"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0014-privileged-account-listing-and-restriction-to-security-functions-only.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0015",
        "source_line": 15,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AC-6(9)"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Auditing configuration for privileged function execution",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "LINUX",
          "SPLUNK"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [
          "/etc/audit/audit.rules"
        ],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0015-auditing-configuration-for-privileged-function-execution.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0016",
        "source_line": 16,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AC-6(10)"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Configuration preventing non-privileged users from executing privileged functions",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [
          "/etc/security/access.conf"
        ],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0016-configuration-preventing-non-privileged-users-from-executing-privileged-function.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0017",
        "source_line": 17,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AC-7"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Unsuccessful logon attempt lockout configuration",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [
          "/etc/pam.d/system-auth",
          "/etc/pam.d/password-auth"
        ],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0017-unsuccessful-logon-attempt-lockout-configuration.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0018",
        "source_line": 18,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AC-8"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "System use notification banner displayed before login",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "cat /etc/issue",
          "cat /etc/issue.net",
          "cat /etc/motd"
        ],
        "config_paths": [
          "/etc/ssh/sshd_config"
        ],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0018-system-use-notification-banner-displayed-before-login.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0019",
        "source_line": 19,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AC-10"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Concurrent session control configuration",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [
          "/etc/security/limits.conf"
        ],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0019-concurrent-session-control-configuration.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0020",
        "source_line": 20,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AC-11",
          "AC-11(1)"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Session lock configuration after 15 minutes of inactivity with pattern-obscuring display",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "grep -i tmout /etc/profile /etc/bashrc"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0020-session-lock-configuration-after-15-minutes-of-inactivity-with-pattern-obscuring.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0021",
        "source_line": 21,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AC-12"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Session termination configuration for inactive sessions",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS",
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "grep -i ClientAliveInterval /etc/ssh/sshd_config"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0021-session-termination-configuration-for-inactive-sessions.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0022",
        "source_line": 22,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "AC-14"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "List of actions permitted without identification/authentication and justification",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0022-list-of-actions-permitted-without-identification-authentication-and-justificatio.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0023",
        "source_line": 23,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AC-17",
          "AC-17(1)",
          "AC-17(2)"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Remote access configuration \u2014 VPN, SSH, and encryption settings",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "LINUX",
          "NETWORK_BOUNDARY"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "cat /etc/ssh/sshd_config",
          "cat /etc/openvpn/server.conf"
        ],
        "config_paths": [
          "/etc/ssh/sshd_config"
        ],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0023-remote-access-configuration-vpn-ssh-and-encryption-settings.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0024",
        "source_line": 24,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AC-17(3)"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Managed access control points for remote access routing",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS",
          "NETWORK_BOUNDARY"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "aws ec2 describe-route-tables --output table"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0024-managed-access-control-points-for-remote-access-routing.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0025",
        "source_line": 25,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "AC-17(4)"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Authorization records for remote access privileged commands and security-relevant information access",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "governance_records",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0025-authorization-records-for-remote-access-privileged-commands-and-security-relevan.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0026",
        "source_line": 26,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AC-18"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Wireless access restrictions and authorization configuration",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0026-wireless-access-restrictions-and-authorization-configuration.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0027",
        "source_line": 27,
        "request_date": null,
        "category": "Policy",
        "workstreams": [],
        "controls": [
          "AC-19"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Mobile device access control policy and configuration",
        "artifact_types": [
          "policy_document"
        ],
        "primary_artifact_type": "policy_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0027-mobile-device-access-control-policy-and-configuration.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0028",
        "source_line": 28,
        "request_date": null,
        "category": "Policy",
        "workstreams": [],
        "controls": [
          "AC-20"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Use of external information systems policy and agreements",
        "artifact_types": [
          "policy_document"
        ],
        "primary_artifact_type": "policy_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0028-use-of-external-information-systems-policy-and-agreements.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0029",
        "source_line": 29,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "AC-22"
        ],
        "control_families": [
          "AC"
        ],
        "control_domains": [
          "Access Control and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Publicly accessible content review and authorization records",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "governance_records",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "quarterly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0029-publicly-accessible-content-review-and-authorization-records.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0030",
        "source_line": 30,
        "request_date": null,
        "category": "Policy",
        "workstreams": [],
        "controls": [
          "AT-1"
        ],
        "control_families": [
          "AT"
        ],
        "control_domains": [
          "Awareness and Training"
        ],
        "supplemental_references": [],
        "artifact_request": "Security Awareness and Training Policy and Procedures",
        "artifact_types": [
          "policy_document"
        ],
        "primary_artifact_type": "policy_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0030-security-awareness-and-training-policy-and-procedures.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0031",
        "source_line": 31,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "AT-2"
        ],
        "control_families": [
          "AT"
        ],
        "control_domains": [
          "Awareness and Training"
        ],
        "supplemental_references": [],
        "artifact_request": "Security awareness training records for all users \u2014 past 365 days",
        "artifact_types": [
          "training_artifact"
        ],
        "primary_artifact_type": "training_artifact",
        "collection_channel": "system_of_record_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0031-security-awareness-training-records-for-all-users-past-365-days.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0032",
        "source_line": 32,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "AT-2(2)"
        ],
        "control_families": [
          "AT"
        ],
        "control_domains": [
          "Awareness and Training"
        ],
        "supplemental_references": [],
        "artifact_request": "Insider threat awareness training completion records",
        "artifact_types": [
          "training_artifact"
        ],
        "primary_artifact_type": "training_artifact",
        "collection_channel": "system_of_record_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0032-insider-threat-awareness-training-completion-records.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0033",
        "source_line": 33,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "AT-3"
        ],
        "control_families": [
          "AT"
        ],
        "control_domains": [
          "Awareness and Training"
        ],
        "supplemental_references": [],
        "artifact_request": "Role-based security training records for privileged users and security personnel",
        "artifact_types": [
          "training_artifact"
        ],
        "primary_artifact_type": "training_artifact",
        "collection_channel": "system_of_record_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0033-role-based-security-training-records-for-privileged-users-and-security-personnel.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0034",
        "source_line": 34,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "AT-4"
        ],
        "control_families": [
          "AT"
        ],
        "control_domains": [
          "Awareness and Training"
        ],
        "supplemental_references": [],
        "artifact_request": "Training records retention and individual training documentation",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "system_of_record_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0034-training-records-retention-and-individual-training-documentation.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0035",
        "source_line": 35,
        "request_date": null,
        "category": "Policy",
        "workstreams": [],
        "controls": [
          "AU-1"
        ],
        "control_families": [
          "AU"
        ],
        "control_domains": [
          "Audit and Accountability"
        ],
        "supplemental_references": [],
        "artifact_request": "Audit and Accountability Policy and Procedures",
        "artifact_types": [
          "policy_document"
        ],
        "primary_artifact_type": "policy_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0035-audit-and-accountability-policy-and-procedures.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0036",
        "source_line": 36,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AU-2"
        ],
        "control_families": [
          "AU"
        ],
        "control_domains": [
          "Audit and Accountability"
        ],
        "supplemental_references": [],
        "artifact_request": "Auditable events definition and configuration \u2014 CloudTrail, auditd, Splunk",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS",
          "LINUX",
          "SPLUNK"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "aws cloudtrail describe-trails --output table",
          "aws cloudtrail get-trail-status --name <trail>",
          "auditctl -l"
        ],
        "config_paths": [
          "/etc/audit/audit.rules",
          "/etc/audit/auditd.conf"
        ],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0036-auditable-events-definition-and-configuration-cloudtrail-auditd-splunk.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0037",
        "source_line": 37,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "AU-2"
        ],
        "control_families": [
          "AU"
        ],
        "control_domains": [
          "Audit and Accountability"
        ],
        "supplemental_references": [],
        "artifact_request": "Audit event review coordination records \u2014 at least annually",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "governance_records",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0037-audit-event-review-coordination-records-at-least-annually.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0038",
        "source_line": 38,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AU-3",
          "AU-3(1)"
        ],
        "control_families": [
          "AU"
        ],
        "control_domains": [
          "Audit and Accountability"
        ],
        "supplemental_references": [],
        "artifact_request": "Audit record content configuration \u2014 timestamp, source, outcome, identity, and additional detail fields",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "LINUX",
          "SPLUNK"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [
          "/etc/audit/auditd.conf"
        ],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0038-audit-record-content-configuration-timestamp-source-outcome-identity-and-additio.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0039",
        "source_line": 39,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AU-4"
        ],
        "control_families": [
          "AU"
        ],
        "control_domains": [
          "Audit and Accountability"
        ],
        "supplemental_references": [],
        "artifact_request": "Audit log storage capacity allocation and monitoring",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS",
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "aws s3api get-bucket-lifecycle-configuration --bucket <audit-bucket>",
          "df -h /var/log/audit"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0039-audit-log-storage-capacity-allocation-and-monitoring.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0040",
        "source_line": 40,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AU-5"
        ],
        "control_families": [
          "AU"
        ],
        "control_domains": [
          "Audit and Accountability"
        ],
        "supplemental_references": [],
        "artifact_request": "Audit processing failure alert configuration \u2014 alerts to security personnel on storage exhaustion or failure",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "tool_export",
        "platform_tags": [
          "AWS",
          "SPLUNK"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "aws cloudwatch describe-alarms --alarm-name-prefix Audit"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0040-audit-processing-failure-alert-configuration-alerts-to-security-personnel-on-sto.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0041",
        "source_line": 41,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "AU-6",
          "AU-6(1)"
        ],
        "control_families": [
          "AU"
        ],
        "control_domains": [
          "Audit and Accountability"
        ],
        "supplemental_references": [],
        "artifact_request": "Audit log review reports \u2014 weekly reviews of audit records for inappropriate or unusual activity",
        "artifact_types": [
          "report"
        ],
        "primary_artifact_type": "report",
        "collection_channel": "tool_export",
        "platform_tags": [
          "SPLUNK"
        ],
        "time_scopes": [],
        "periodicity": "weekly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0041-audit-log-review-reports-weekly-reviews-of-audit-records-for-inappropriate-or-un.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0042",
        "source_line": 42,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AU-6(3)"
        ],
        "control_families": [
          "AU"
        ],
        "control_domains": [
          "Audit and Accountability"
        ],
        "supplemental_references": [],
        "artifact_request": "Centralized audit log correlation and analysis configuration",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "tool_export",
        "platform_tags": [
          "SPLUNK"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [
          "/opt/splunk/etc/system/local/inputs.conf",
          "/opt/splunk/etc/system/local/outputs.conf"
        ],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0042-centralized-audit-log-correlation-and-analysis-configuration.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0043",
        "source_line": 43,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AU-7",
          "AU-7(1)"
        ],
        "control_families": [
          "AU"
        ],
        "control_domains": [
          "Audit and Accountability"
        ],
        "supplemental_references": [],
        "artifact_request": "Audit reduction and report generation capability \u2014 Splunk search/report configuration",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "tool_export",
        "platform_tags": [
          "SPLUNK"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0043-audit-reduction-and-report-generation-capability-splunk-search-report-configurat.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0044",
        "source_line": 44,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AU-8",
          "AU-8(1)"
        ],
        "control_families": [
          "AU"
        ],
        "control_domains": [
          "Audit and Accountability"
        ],
        "supplemental_references": [],
        "artifact_request": "Time synchronization configuration \u2014 NTP/Chrony settings and authoritative time source",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS",
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "ntpstat",
          "chronyc tracking",
          "cat /etc/chrony.conf",
          "timedatectl status"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0044-time-synchronization-configuration-ntp-chrony-settings-and-authoritative-time-so.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0045",
        "source_line": 45,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AU-9"
        ],
        "control_families": [
          "AU"
        ],
        "control_domains": [
          "Audit and Accountability"
        ],
        "supplemental_references": [],
        "artifact_request": "Audit information protection \u2014 access controls on audit logs and CloudTrail log file validation",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS",
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "aws cloudtrail get-trail --name <trail>",
          "ls -la /var/log/audit/",
          "aws s3api get-bucket-policy --bucket <audit-bucket>"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0045-audit-information-protection-access-controls-on-audit-logs-and-cloudtrail-log-fi.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0046",
        "source_line": 46,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AU-9(4)"
        ],
        "control_families": [
          "AU"
        ],
        "control_domains": [
          "Audit and Accountability"
        ],
        "supplemental_references": [],
        "artifact_request": "Audit log access restricted to subset of privileged users",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "getfacl /var/log/audit/"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0046-audit-log-access-restricted-to-subset-of-privileged-users.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0047",
        "source_line": 47,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AU-11"
        ],
        "control_families": [
          "AU"
        ],
        "control_domains": [
          "Audit and Accountability"
        ],
        "supplemental_references": [],
        "artifact_request": "Audit record retention configuration \u2014 minimum 90 days online, 1 year total",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS",
          "SPLUNK"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "aws s3api get-bucket-lifecycle-configuration --bucket <audit-bucket>"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0047-audit-record-retention-configuration-minimum-90-days-online-1-year-total.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0048",
        "source_line": 48,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "AU-12"
        ],
        "control_families": [
          "AU"
        ],
        "control_domains": [
          "Audit and Accountability"
        ],
        "supplemental_references": [],
        "artifact_request": "Audit generation configuration providing system-wide audit trail across all components",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS",
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "aws cloudtrail get-trail-status --name <trail>",
          "systemctl status auditd"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0048-audit-generation-configuration-providing-system-wide-audit-trail-across-all-comp.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0049",
        "source_line": 49,
        "request_date": null,
        "category": "Policy",
        "workstreams": [],
        "controls": [
          "CA-1"
        ],
        "control_families": [
          "CA"
        ],
        "control_domains": [
          "Assessment and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Security Assessment and Authorization Policy and Procedures",
        "artifact_types": [
          "policy_document"
        ],
        "primary_artifact_type": "policy_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0049-security-assessment-and-authorization-policy-and-procedures.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0050",
        "source_line": 50,
        "request_date": null,
        "category": "Plan",
        "workstreams": [],
        "controls": [
          "CA-2",
          "CA-2(1)"
        ],
        "control_families": [
          "CA"
        ],
        "control_domains": [
          "Assessment and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Security assessment plan with independent assessor engagement",
        "artifact_types": [
          "plan_document"
        ],
        "primary_artifact_type": "plan_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0050-security-assessment-plan-with-independent-assessor-engagement.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0051",
        "source_line": 51,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "CA-3"
        ],
        "control_families": [
          "CA"
        ],
        "control_domains": [
          "Assessment and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "System interconnection agreements (ISAs/MOUs) for all external connections",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0051-system-interconnection-agreements-isas-mous-for-all-external-connections.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0052",
        "source_line": 52,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "CA-5"
        ],
        "control_families": [
          "CA"
        ],
        "control_domains": [
          "Assessment and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Plan of Action and Milestones (POA&M) \u2014 current with all open findings",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "system_of_record_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "monthly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0052-plan-of-action-and-milestones-poa-m-current-with-all-open-findings.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0053",
        "source_line": 53,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "CA-6"
        ],
        "control_families": [
          "CA"
        ],
        "control_domains": [
          "Assessment and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Authorization to Operate (ATO) letter and authorization decision",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0053-authorization-to-operate-ato-letter-and-authorization-decision.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0054",
        "source_line": 54,
        "request_date": null,
        "category": "Plan",
        "workstreams": [],
        "controls": [
          "CA-7"
        ],
        "control_families": [
          "CA"
        ],
        "control_domains": [
          "Assessment and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Continuous monitoring strategy and plan",
        "artifact_types": [
          "plan_document"
        ],
        "primary_artifact_type": "plan_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0054-continuous-monitoring-strategy-and-plan.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0055",
        "source_line": 55,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "CA-7"
        ],
        "control_families": [
          "CA"
        ],
        "control_domains": [
          "Assessment and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Continuous monitoring status reports \u2014 monthly deliverables",
        "artifact_types": [
          "report"
        ],
        "primary_artifact_type": "report",
        "collection_channel": "report_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "monthly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0055-continuous-monitoring-status-reports-monthly-deliverables.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0056",
        "source_line": 56,
        "request_date": null,
        "category": "Report",
        "workstreams": [],
        "controls": [
          "CA-8"
        ],
        "control_families": [
          "CA"
        ],
        "control_domains": [
          "Assessment and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Penetration test report \u2014 at least annual",
        "artifact_types": [
          "report"
        ],
        "primary_artifact_type": "report",
        "collection_channel": "report_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0056-penetration-test-report-at-least-annual.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0057",
        "source_line": 57,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "CA-9"
        ],
        "control_families": [
          "CA"
        ],
        "control_domains": [
          "Assessment and Authorization"
        ],
        "supplemental_references": [],
        "artifact_request": "Internal system connection authorizations and documentation",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0057-internal-system-connection-authorizations-and-documentation.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0058",
        "source_line": 58,
        "request_date": null,
        "category": "Policy",
        "workstreams": [],
        "controls": [
          "CM-1"
        ],
        "control_families": [
          "CM"
        ],
        "control_domains": [
          "Configuration and Change Management"
        ],
        "supplemental_references": [],
        "artifact_request": "Configuration Management Policy and Procedures",
        "artifact_types": [
          "policy_document"
        ],
        "primary_artifact_type": "policy_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0058-configuration-management-policy-and-procedures.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0059",
        "source_line": 59,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "CM-2",
          "CM-2(1)"
        ],
        "control_families": [
          "CM"
        ],
        "control_domains": [
          "Configuration and Change Management"
        ],
        "supplemental_references": [],
        "artifact_request": "Current system baseline configuration \u2014 OS, middleware, application component versions",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS",
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [
          "uname -a",
          "cat /etc/redhat-release",
          "rpm -qa --last | head -50",
          "aws ec2 describe-instances --query 'Reservations[].Instances[].{ID:InstanceId,Type:InstanceType,AMI:ImageId}' --output table"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0059-current-system-baseline-configuration-os-middleware-application-component-versio.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0060",
        "source_line": 60,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "CM-2(3)"
        ],
        "control_families": [
          "CM"
        ],
        "control_domains": [
          "Configuration and Change Management"
        ],
        "supplemental_references": [],
        "artifact_request": "Evidence of baseline retention for prior configuration versions",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "tool_export",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [
          "aws ec2 describe-images --owners self --output table"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0060-evidence-of-baseline-retention-for-prior-configuration-versions.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0061",
        "source_line": 61,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "CM-2(7)"
        ],
        "control_families": [
          "CM"
        ],
        "control_domains": [
          "Configuration and Change Management"
        ],
        "supplemental_references": [],
        "artifact_request": "Configuration of additional security measures for high-risk travel systems",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0061-configuration-of-additional-security-measures-for-high-risk-travel-systems.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0062",
        "source_line": 62,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "CM-3",
          "CM-3(2)"
        ],
        "control_families": [
          "CM"
        ],
        "control_domains": [
          "Configuration and Change Management"
        ],
        "supplemental_references": [],
        "artifact_request": "Configuration change control records \u2014 change requests, approvals, and implementation evidence",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "system_of_record_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "monthly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0062-configuration-change-control-records-change-requests-approvals-and-implementatio.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0063",
        "source_line": 63,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "CM-4"
        ],
        "control_families": [
          "CM"
        ],
        "control_domains": [
          "Configuration and Change Management"
        ],
        "supplemental_references": [],
        "artifact_request": "Security impact analysis records for system changes",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "system_of_record_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "monthly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0063-security-impact-analysis-records-for-system-changes.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0064",
        "source_line": 64,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "CM-5"
        ],
        "control_families": [
          "CM"
        ],
        "control_domains": [
          "Configuration and Change Management"
        ],
        "supplemental_references": [],
        "artifact_request": "Access restrictions for change \u2014 who can deploy, modify configs, and apply patches",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS",
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "aws iam list-attached-group-policies --group-name Deployers"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0064-access-restrictions-for-change-who-can-deploy-modify-configs-and-apply-patches.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0065",
        "source_line": 65,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "CM-6"
        ],
        "control_families": [
          "CM"
        ],
        "control_domains": [
          "Configuration and Change Management"
        ],
        "supplemental_references": [],
        "artifact_request": "Configuration settings enforcement \u2014 RHEL STIG/CIS benchmark compliance scan results",
        "artifact_types": [
          "scan_evidence"
        ],
        "primary_artifact_type": "scan_evidence",
        "collection_channel": "scanner_export",
        "platform_tags": [
          "LINUX",
          "NESSUS"
        ],
        "time_scopes": [],
        "periodicity": "monthly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0065-configuration-settings-enforcement-rhel-stig-cis-benchmark-compliance-scan-resul.csv",
          "suggested_extension": "csv"
        }
      },
      {
        "request_id": "REQ-0066",
        "source_line": 66,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "CM-6"
        ],
        "control_families": [
          "CM"
        ],
        "control_domains": [
          "Configuration and Change Management"
        ],
        "supplemental_references": [],
        "artifact_request": "AWS configuration compliance \u2014 AWS Config rule evaluation results",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "tool_export",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "monthly",
        "commands": [
          "aws configservice describe-compliance-by-config-rule --output table"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0066-aws-configuration-compliance-aws-config-rule-evaluation-results.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0067",
        "source_line": 67,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "CM-7",
          "CM-7(1)"
        ],
        "control_families": [
          "CM"
        ],
        "control_domains": [
          "Configuration and Change Management"
        ],
        "supplemental_references": [],
        "artifact_request": "Least functionality \u2014 disabled services, blocked ports, removed unnecessary software",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "systemctl list-unit-files --state=enabled",
          "rpm -qa",
          "cat /etc/hosts.deny"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0067-least-functionality-disabled-services-blocked-ports-removed-unnecessary-software.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0068",
        "source_line": 68,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "CM-7(2)"
        ],
        "control_families": [
          "CM"
        ],
        "control_domains": [
          "Configuration and Change Management"
        ],
        "supplemental_references": [],
        "artifact_request": "Software whitelisting/blacklisting configuration",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0068-software-whitelisting-blacklisting-configuration.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0069",
        "source_line": 69,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "CM-7(5)"
        ],
        "control_families": [
          "CM"
        ],
        "control_domains": [
          "Configuration and Change Management"
        ],
        "supplemental_references": [],
        "artifact_request": "Authorized software list and evidence of unauthorized software detection",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "tool_export",
        "platform_tags": [
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "monthly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0069-authorized-software-list-and-evidence-of-unauthorized-software-detection.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0070",
        "source_line": 70,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "CM-8",
          "CM-8(1)"
        ],
        "control_families": [
          "CM"
        ],
        "control_domains": [
          "Configuration and Change Management"
        ],
        "supplemental_references": [],
        "artifact_request": "System component inventory \u2014 hardware, software, firmware with update tracking",
        "artifact_types": [
          "inventory_listing"
        ],
        "primary_artifact_type": "inventory_listing",
        "collection_channel": "tool_export",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "quarterly",
        "commands": [
          "aws ec2 describe-instances --output table",
          "aws rds describe-db-instances --output table",
          "aws s3api list-buckets --output table",
          "aws elasticache describe-cache-clusters --output table"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0070-system-component-inventory-hardware-software-firmware-with-update-tracking.csv",
          "suggested_extension": "csv"
        }
      },
      {
        "request_id": "REQ-0071",
        "source_line": 71,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "CM-8(3)"
        ],
        "control_families": [
          "CM"
        ],
        "control_domains": [
          "Configuration and Change Management"
        ],
        "supplemental_references": [],
        "artifact_request": "Automated unauthorized component detection configuration",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "tool_export",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "monthly",
        "commands": [
          "aws config describe-config-rules --output table"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0071-automated-unauthorized-component-detection-configuration.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0072",
        "source_line": 72,
        "request_date": null,
        "category": "Plan",
        "workstreams": [],
        "controls": [
          "CM-9"
        ],
        "control_families": [
          "CM"
        ],
        "control_domains": [
          "Configuration and Change Management"
        ],
        "supplemental_references": [],
        "artifact_request": "Configuration management plan",
        "artifact_types": [
          "plan_document"
        ],
        "primary_artifact_type": "plan_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0072-configuration-management-plan.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0073",
        "source_line": 73,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "CM-10"
        ],
        "control_families": [
          "CM"
        ],
        "control_domains": [
          "Configuration and Change Management"
        ],
        "supplemental_references": [],
        "artifact_request": "Software usage restrictions and license tracking",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "system_of_record_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0073-software-usage-restrictions-and-license-tracking.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0074",
        "source_line": 74,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "CM-11"
        ],
        "control_families": [
          "CM"
        ],
        "control_domains": [
          "Configuration and Change Management"
        ],
        "supplemental_references": [],
        "artifact_request": "User-installed software restrictions and policy enforcement",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0074-user-installed-software-restrictions-and-policy-enforcement.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0075",
        "source_line": 75,
        "request_date": null,
        "category": "Policy",
        "workstreams": [],
        "controls": [
          "CP-1"
        ],
        "control_families": [
          "CP"
        ],
        "control_domains": [
          "Contingency Planning and Backup"
        ],
        "supplemental_references": [],
        "artifact_request": "Contingency Planning Policy and Procedures",
        "artifact_types": [
          "policy_document"
        ],
        "primary_artifact_type": "policy_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0075-contingency-planning-policy-and-procedures.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0076",
        "source_line": 76,
        "request_date": null,
        "category": "Plan",
        "workstreams": [],
        "controls": [
          "CP-2",
          "CP-2(1)",
          "CP-2(3)",
          "CP-2(8)"
        ],
        "control_families": [
          "CP"
        ],
        "control_domains": [
          "Contingency Planning and Backup"
        ],
        "supplemental_references": [],
        "artifact_request": "Information System Contingency Plan (ISCP) with designated roles, recovery priorities, and BIA",
        "artifact_types": [
          "plan_document"
        ],
        "primary_artifact_type": "plan_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0076-information-system-contingency-plan-iscp-with-designated-roles-recovery-prioriti.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0077",
        "source_line": 77,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "CP-3"
        ],
        "control_families": [
          "CP"
        ],
        "control_domains": [
          "Contingency Planning and Backup"
        ],
        "supplemental_references": [],
        "artifact_request": "Contingency plan training records",
        "artifact_types": [
          "training_artifact"
        ],
        "primary_artifact_type": "training_artifact",
        "collection_channel": "system_of_record_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0077-contingency-plan-training-records.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0078",
        "source_line": 78,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "CP-4",
          "CP-4(1)"
        ],
        "control_families": [
          "CP"
        ],
        "control_domains": [
          "Contingency Planning and Backup"
        ],
        "supplemental_references": [],
        "artifact_request": "Contingency plan test results and lessons learned",
        "artifact_types": [
          "report"
        ],
        "primary_artifact_type": "report",
        "collection_channel": "report_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0078-contingency-plan-test-results-and-lessons-learned.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0079",
        "source_line": 79,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "CP-6",
          "CP-6(1)",
          "CP-6(3)"
        ],
        "control_families": [
          "CP"
        ],
        "control_domains": [
          "Contingency Planning and Backup"
        ],
        "supplemental_references": [],
        "artifact_request": "Alternate storage site configuration \u2014 S3 cross-region replication, EBS snapshots, geographic separation",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "aws s3api get-bucket-replication --bucket <primary-bucket>",
          "aws ec2 describe-snapshots --owner-ids self --output table"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0079-alternate-storage-site-configuration-s3-cross-region-replication-ebs-snapshots-g.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0080",
        "source_line": 80,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "CP-7",
          "CP-7(1)",
          "CP-7(3)"
        ],
        "control_families": [
          "CP"
        ],
        "control_domains": [
          "Contingency Planning and Backup"
        ],
        "supplemental_references": [],
        "artifact_request": "Alternate processing site configuration \u2014 multi-AZ deployment, failover capabilities",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "aws ec2 describe-availability-zones --output table",
          "aws rds describe-db-instances --query 'DBInstances[].{ID:DBInstanceIdentifier,MultiAZ:MultiAZ}' --output table",
          "aws autoscaling describe-auto-scaling-groups --output table"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0080-alternate-processing-site-configuration-multi-az-deployment-failover-capabilitie.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0081",
        "source_line": 81,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "CP-9",
          "CP-9(1)"
        ],
        "control_families": [
          "CP"
        ],
        "control_domains": [
          "Contingency Planning and Backup"
        ],
        "supplemental_references": [],
        "artifact_request": "System backup configuration and backup testing evidence",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "monthly",
        "commands": [
          "aws rds describe-db-snapshots --db-instance-identifier <db> --output table",
          "aws ec2 describe-snapshots --owner-ids self --query 'Snapshots[?StartTime>=`2025-01-01`]' --output table"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0081-system-backup-configuration-and-backup-testing-evidence.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0082",
        "source_line": 82,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "CP-10"
        ],
        "control_families": [
          "CP"
        ],
        "control_domains": [
          "Contingency Planning and Backup"
        ],
        "supplemental_references": [],
        "artifact_request": "System recovery and reconstitution test evidence",
        "artifact_types": [
          "report"
        ],
        "primary_artifact_type": "report",
        "collection_channel": "report_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0082-system-recovery-and-reconstitution-test-evidence.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0083",
        "source_line": 83,
        "request_date": null,
        "category": "Policy",
        "workstreams": [],
        "controls": [
          "IA-1"
        ],
        "control_families": [
          "IA"
        ],
        "control_domains": [
          "Identification and Authentication"
        ],
        "supplemental_references": [],
        "artifact_request": "Identification and Authentication Policy and Procedures",
        "artifact_types": [
          "policy_document"
        ],
        "primary_artifact_type": "policy_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0083-identification-and-authentication-policy-and-procedures.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0084",
        "source_line": 84,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "IA-2",
          "IA-2(1)",
          "IA-2(12)",
          "IA-2(2)"
        ],
        "control_families": [
          "IA"
        ],
        "control_domains": [
          "Identification and Authentication"
        ],
        "supplemental_references": [],
        "artifact_request": "Multi-factor authentication configuration for privileged and non-privileged users",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "aws iam get-account-summary",
          "aws iam list-virtual-mfa-devices --output table"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0084-multi-factor-authentication-configuration-for-privileged-and-non-privileged-user.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0085",
        "source_line": 85,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "IA-3"
        ],
        "control_families": [
          "IA"
        ],
        "control_domains": [
          "Identification and Authentication"
        ],
        "supplemental_references": [],
        "artifact_request": "Device identification and authentication configuration",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS",
          "NETWORK_BOUNDARY"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0085-device-identification-and-authentication-configuration.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0086",
        "source_line": 86,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "IA-4"
        ],
        "control_families": [
          "IA"
        ],
        "control_domains": [
          "Identification and Authentication"
        ],
        "supplemental_references": [],
        "artifact_request": "Identifier management \u2014 user ID assignment, reuse prevention, and disabling after inactivity",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "tool_export",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "quarterly",
        "commands": [
          "aws iam generate-credential-report",
          "aws iam get-credential-report"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0086-identifier-management-user-id-assignment-reuse-prevention-and-disabling-after-in.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0087",
        "source_line": 87,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "IA-5",
          "IA-5(1)"
        ],
        "control_families": [
          "IA"
        ],
        "control_domains": [
          "Identification and Authentication"
        ],
        "supplemental_references": [],
        "artifact_request": "Password complexity and authenticator management configuration",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS",
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "aws iam get-account-password-policy"
        ],
        "config_paths": [
          "/etc/pam.d/system-auth",
          "/etc/login.defs"
        ],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0087-password-complexity-and-authenticator-management-configuration.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0088",
        "source_line": 88,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "IA-5(2)"
        ],
        "control_families": [
          "IA"
        ],
        "control_domains": [
          "Identification and Authentication"
        ],
        "supplemental_references": [],
        "artifact_request": "PKI-based authentication \u2014 certificate validation and trust chain configuration",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "openssl s_client -connect <host>:443 -showcerts"
        ],
        "config_paths": [
          "/etc/pki/tls/certs/"
        ],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0088-pki-based-authentication-certificate-validation-and-trust-chain-configuration.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0089",
        "source_line": 89,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "IA-5(11)"
        ],
        "control_families": [
          "IA"
        ],
        "control_domains": [
          "Identification and Authentication"
        ],
        "supplemental_references": [],
        "artifact_request": "Hardware token / PIV credential configuration for authentication",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0089-hardware-token-piv-credential-configuration-for-authentication.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0090",
        "source_line": 90,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "IA-6"
        ],
        "control_families": [
          "IA"
        ],
        "control_domains": [
          "Identification and Authentication"
        ],
        "supplemental_references": [],
        "artifact_request": "Authenticator feedback obscuring configuration \u2014 password masking on login",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0090-authenticator-feedback-obscuring-configuration-password-masking-on-login.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0091",
        "source_line": 91,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "IA-7"
        ],
        "control_families": [
          "IA"
        ],
        "control_domains": [
          "Identification and Authentication"
        ],
        "supplemental_references": [],
        "artifact_request": "Cryptographic module authentication \u2014 FIPS 140-2 validated modules",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "cat /proc/sys/crypto/fips_enabled",
          "openssl version"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0091-cryptographic-module-authentication-fips-140-2-validated-modules.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0092",
        "source_line": 92,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "IA-8",
          "IA-8(1)",
          "IA-8(2)",
          "IA-8(3)",
          "IA-8(4)"
        ],
        "control_families": [
          "IA"
        ],
        "control_domains": [
          "Identification and Authentication"
        ],
        "supplemental_references": [],
        "artifact_request": "Non-organizational user identification/authentication \u2014 federated identity, PIV acceptance",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0092-non-organizational-user-identification-authentication-federated-identity-piv-acc.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0093",
        "source_line": 93,
        "request_date": null,
        "category": "Policy",
        "workstreams": [],
        "controls": [
          "IR-1"
        ],
        "control_families": [
          "IR"
        ],
        "control_domains": [
          "Incident Response"
        ],
        "supplemental_references": [],
        "artifact_request": "Incident Response Policy and Procedures",
        "artifact_types": [
          "policy_document"
        ],
        "primary_artifact_type": "policy_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0093-incident-response-policy-and-procedures.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0094",
        "source_line": 94,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "IR-2"
        ],
        "control_families": [
          "IR"
        ],
        "control_domains": [
          "Incident Response"
        ],
        "supplemental_references": [],
        "artifact_request": "Incident response training records",
        "artifact_types": [
          "training_artifact"
        ],
        "primary_artifact_type": "training_artifact",
        "collection_channel": "system_of_record_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0094-incident-response-training-records.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0095",
        "source_line": 95,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "IR-3",
          "IR-3(2)"
        ],
        "control_families": [
          "IR"
        ],
        "control_domains": [
          "Incident Response"
        ],
        "supplemental_references": [],
        "artifact_request": "Incident response testing/exercise results with coordination across related plans",
        "artifact_types": [
          "report"
        ],
        "primary_artifact_type": "report",
        "collection_channel": "report_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0095-incident-response-testing-exercise-results-with-coordination-across-related-plan.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0096",
        "source_line": 96,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "IR-4",
          "IR-4(1)"
        ],
        "control_families": [
          "IR"
        ],
        "control_domains": [
          "Incident Response"
        ],
        "supplemental_references": [],
        "artifact_request": "Incident handling records \u2014 detection, analysis, containment, eradication, recovery documentation",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "system_of_record_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "monthly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0096-incident-handling-records-detection-analysis-containment-eradication-recovery-do.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0097",
        "source_line": 97,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "IR-5"
        ],
        "control_families": [
          "IR"
        ],
        "control_domains": [
          "Incident Response"
        ],
        "supplemental_references": [],
        "artifact_request": "Incident tracking and monitoring \u2014 open/closed incident metrics",
        "artifact_types": [
          "report"
        ],
        "primary_artifact_type": "report",
        "collection_channel": "tool_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "monthly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0097-incident-tracking-and-monitoring-open-closed-incident-metrics.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0098",
        "source_line": 98,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "IR-6",
          "IR-6(1)"
        ],
        "control_families": [
          "IR"
        ],
        "control_domains": [
          "Incident Response"
        ],
        "supplemental_references": [],
        "artifact_request": "Incident reporting records \u2014 US-CERT notifications and automated reporting configuration",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "system_of_record_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "monthly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0098-incident-reporting-records-us-cert-notifications-and-automated-reporting-configu.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0099",
        "source_line": 99,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "IR-7",
          "IR-7(1)"
        ],
        "control_families": [
          "IR"
        ],
        "control_domains": [
          "Incident Response"
        ],
        "supplemental_references": [],
        "artifact_request": "Incident response assistance resources and support contacts",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0099-incident-response-assistance-resources-and-support-contacts.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0100",
        "source_line": 100,
        "request_date": null,
        "category": "Plan",
        "workstreams": [],
        "controls": [
          "IR-8"
        ],
        "control_families": [
          "IR"
        ],
        "control_domains": [
          "Incident Response"
        ],
        "supplemental_references": [],
        "artifact_request": "Incident Response Plan with roles, responsibilities, and escalation procedures",
        "artifact_types": [
          "plan_document"
        ],
        "primary_artifact_type": "plan_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0100-incident-response-plan-with-roles-responsibilities-and-escalation-procedures.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0101",
        "source_line": 101,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "IR-9"
        ],
        "control_families": [
          "IR"
        ],
        "control_domains": [
          "Incident Response"
        ],
        "supplemental_references": [],
        "artifact_request": "Information spillage response procedures and evidence of any spillage handling",
        "artifact_types": [
          "procedure_document"
        ],
        "primary_artifact_type": "procedure_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0101-information-spillage-response-procedures-and-evidence-of-any-spillage-handling.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0102",
        "source_line": 102,
        "request_date": null,
        "category": "Policy",
        "workstreams": [],
        "controls": [
          "MA-1"
        ],
        "control_families": [
          "MA"
        ],
        "control_domains": [
          "Maintenance"
        ],
        "supplemental_references": [],
        "artifact_request": "Maintenance Policy and Procedures",
        "artifact_types": [
          "policy_document"
        ],
        "primary_artifact_type": "policy_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0102-maintenance-policy-and-procedures.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0103",
        "source_line": 103,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "MA-2"
        ],
        "control_families": [
          "MA"
        ],
        "control_domains": [
          "Maintenance"
        ],
        "supplemental_references": [],
        "artifact_request": "Controlled maintenance records \u2014 scheduled and unscheduled maintenance activities",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "system_of_record_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "quarterly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0103-controlled-maintenance-records-scheduled-and-unscheduled-maintenance-activities.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0104",
        "source_line": 104,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "MA-3",
          "MA-3(1)",
          "MA-3(2)"
        ],
        "control_families": [
          "MA"
        ],
        "control_domains": [
          "Maintenance"
        ],
        "supplemental_references": [],
        "artifact_request": "Maintenance tool authorization, inspection, and media handling procedures",
        "artifact_types": [
          "procedure_document"
        ],
        "primary_artifact_type": "procedure_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0104-maintenance-tool-authorization-inspection-and-media-handling-procedures.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0105",
        "source_line": 105,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "MA-4",
          "MA-4(2)"
        ],
        "control_families": [
          "MA"
        ],
        "control_domains": [
          "Maintenance"
        ],
        "supplemental_references": [],
        "artifact_request": "Non-local maintenance records with strong authentication evidence",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "system_of_record_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "quarterly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0105-non-local-maintenance-records-with-strong-authentication-evidence.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0106",
        "source_line": 106,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "MA-5"
        ],
        "control_families": [
          "MA"
        ],
        "control_domains": [
          "Maintenance"
        ],
        "supplemental_references": [],
        "artifact_request": "Maintenance personnel authorization and escort records",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "governance_records",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "quarterly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0106-maintenance-personnel-authorization-and-escort-records.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0107",
        "source_line": 107,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "MA-6"
        ],
        "control_families": [
          "MA"
        ],
        "control_domains": [
          "Maintenance"
        ],
        "supplemental_references": [],
        "artifact_request": "Timely maintenance records \u2014 MTTR metrics and spare parts availability",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "system_of_record_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "quarterly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0107-timely-maintenance-records-mttr-metrics-and-spare-parts-availability.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0108",
        "source_line": 108,
        "request_date": null,
        "category": "Policy",
        "workstreams": [],
        "controls": [
          "MP-1"
        ],
        "control_families": [
          "MP"
        ],
        "control_domains": [
          "Media Protection"
        ],
        "supplemental_references": [],
        "artifact_request": "Media Protection Policy and Procedures",
        "artifact_types": [
          "policy_document"
        ],
        "primary_artifact_type": "policy_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0108-media-protection-policy-and-procedures.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0109",
        "source_line": 109,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "MP-2"
        ],
        "control_families": [
          "MP"
        ],
        "control_domains": [
          "Media Protection"
        ],
        "supplemental_references": [],
        "artifact_request": "Media access restriction configuration \u2014 EBS encryption, S3 bucket policies",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "aws ec2 describe-volumes --query 'Volumes[].{ID:VolumeId,Encrypted:Encrypted}' --output table",
          "aws s3api get-bucket-encryption --bucket <bucket>"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0109-media-access-restriction-configuration-ebs-encryption-s3-bucket-policies.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0110",
        "source_line": 110,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "MP-3"
        ],
        "control_families": [
          "MP"
        ],
        "control_domains": [
          "Media Protection"
        ],
        "supplemental_references": [],
        "artifact_request": "Media marking procedures and evidence of marking compliance",
        "artifact_types": [
          "procedure_document"
        ],
        "primary_artifact_type": "procedure_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0110-media-marking-procedures-and-evidence-of-marking-compliance.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0111",
        "source_line": 111,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "MP-4"
        ],
        "control_families": [
          "MP"
        ],
        "control_domains": [
          "Media Protection"
        ],
        "supplemental_references": [],
        "artifact_request": "Media storage protection \u2014 encryption at rest configuration",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "aws kms list-keys --output table"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0111-media-storage-protection-encryption-at-rest-configuration.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0112",
        "source_line": 112,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "MP-5"
        ],
        "control_families": [
          "MP"
        ],
        "control_domains": [
          "Media Protection"
        ],
        "supplemental_references": [],
        "artifact_request": "Media transport protection procedures and records",
        "artifact_types": [
          "procedure_document"
        ],
        "primary_artifact_type": "procedure_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0112-media-transport-protection-procedures-and-records.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0113",
        "source_line": 113,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "MP-6",
          "MP-6(2)"
        ],
        "control_families": [
          "MP"
        ],
        "control_domains": [
          "Media Protection"
        ],
        "supplemental_references": [],
        "artifact_request": "Media sanitization records with NIST SP 800-88 compliance",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "governance_records",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "quarterly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0113-media-sanitization-records-with-nist-sp-800-88-compliance.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0114",
        "source_line": 114,
        "request_date": null,
        "category": "Policy",
        "workstreams": [],
        "controls": [
          "PE-1"
        ],
        "control_families": [
          "PE"
        ],
        "control_domains": [
          "Physical and Environmental Security"
        ],
        "supplemental_references": [],
        "artifact_request": "Physical and Environmental Protection Policy and Procedures",
        "artifact_types": [
          "policy_document"
        ],
        "primary_artifact_type": "policy_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0114-physical-and-environmental-protection-policy-and-procedures.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0115",
        "source_line": 115,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "PE-2"
        ],
        "control_families": [
          "PE"
        ],
        "control_domains": [
          "Physical and Environmental Security"
        ],
        "supplemental_references": [],
        "artifact_request": "Physical access authorization records and access lists",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "governance_records",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "quarterly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0115-physical-access-authorization-records-and-access-lists.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0116",
        "source_line": 116,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "PE-3"
        ],
        "control_families": [
          "PE"
        ],
        "control_domains": [
          "Physical and Environmental Security"
        ],
        "supplemental_references": [],
        "artifact_request": "Physical access control evidence \u2014 badge logs, visitor records, locked facility evidence (AWS data center inherits)",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "governance_records",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "quarterly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0116-physical-access-control-evidence-badge-logs-visitor-records-locked-facility-evid.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0117",
        "source_line": 117,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "PE-6",
          "PE-6(1)"
        ],
        "control_families": [
          "PE"
        ],
        "control_domains": [
          "Physical and Environmental Security"
        ],
        "supplemental_references": [],
        "artifact_request": "Physical access monitoring \u2014 review of access logs and intrusion alarm records",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "governance_records",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "monthly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0117-physical-access-monitoring-review-of-access-logs-and-intrusion-alarm-records.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0118",
        "source_line": 118,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "PE-8"
        ],
        "control_families": [
          "PE"
        ],
        "control_domains": [
          "Physical and Environmental Security"
        ],
        "supplemental_references": [],
        "artifact_request": "Visitor access records \u2014 past 365 days",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "governance_records",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "quarterly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0118-visitor-access-records-past-365-days.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0119",
        "source_line": 119,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "PE-9"
        ],
        "control_families": [
          "PE"
        ],
        "control_domains": [
          "Physical and Environmental Security"
        ],
        "supplemental_references": [],
        "artifact_request": "Power equipment and cabling protection (inherited from AWS)",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "document_repository",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0119-power-equipment-and-cabling-protection-inherited-from-aws.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0120",
        "source_line": 120,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "PE-10"
        ],
        "control_families": [
          "PE"
        ],
        "control_domains": [
          "Physical and Environmental Security"
        ],
        "supplemental_references": [],
        "artifact_request": "Emergency shutoff capability documentation (inherited from AWS)",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "document_repository",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0120-emergency-shutoff-capability-documentation-inherited-from-aws.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0121",
        "source_line": 121,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "PE-11"
        ],
        "control_families": [
          "PE"
        ],
        "control_domains": [
          "Physical and Environmental Security"
        ],
        "supplemental_references": [],
        "artifact_request": "Emergency power \u2014 UPS/generator configuration (inherited from AWS)",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "document_repository",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0121-emergency-power-ups-generator-configuration-inherited-from-aws.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0122",
        "source_line": 122,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "PE-12"
        ],
        "control_families": [
          "PE"
        ],
        "control_domains": [
          "Physical and Environmental Security"
        ],
        "supplemental_references": [],
        "artifact_request": "Emergency lighting documentation (inherited from AWS)",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "document_repository",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0122-emergency-lighting-documentation-inherited-from-aws.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0123",
        "source_line": 123,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "PE-13",
          "PE-13(3)"
        ],
        "control_families": [
          "PE"
        ],
        "control_domains": [
          "Physical and Environmental Security"
        ],
        "supplemental_references": [],
        "artifact_request": "Fire protection and suppression system records (inherited from AWS)",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "document_repository",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0123-fire-protection-and-suppression-system-records-inherited-from-aws.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0124",
        "source_line": 124,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "PE-14"
        ],
        "control_families": [
          "PE"
        ],
        "control_domains": [
          "Physical and Environmental Security"
        ],
        "supplemental_references": [],
        "artifact_request": "Temperature/humidity control documentation (inherited from AWS)",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "document_repository",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0124-temperature-humidity-control-documentation-inherited-from-aws.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0125",
        "source_line": 125,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "PE-15"
        ],
        "control_families": [
          "PE"
        ],
        "control_domains": [
          "Physical and Environmental Security"
        ],
        "supplemental_references": [],
        "artifact_request": "Water damage protection documentation (inherited from AWS)",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "document_repository",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0125-water-damage-protection-documentation-inherited-from-aws.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0126",
        "source_line": 126,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "PE-16"
        ],
        "control_families": [
          "PE"
        ],
        "control_domains": [
          "Physical and Environmental Security"
        ],
        "supplemental_references": [],
        "artifact_request": "Delivery and removal authorization and tracking records",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "governance_records",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "quarterly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0126-delivery-and-removal-authorization-and-tracking-records.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0127",
        "source_line": 127,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "PE-17"
        ],
        "control_families": [
          "PE"
        ],
        "control_domains": [
          "Physical and Environmental Security"
        ],
        "supplemental_references": [],
        "artifact_request": "Alternate work site security verification records",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "governance_records",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0127-alternate-work-site-security-verification-records.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0128",
        "source_line": 128,
        "request_date": null,
        "category": "Policy",
        "workstreams": [],
        "controls": [
          "PL-1"
        ],
        "control_families": [
          "PL"
        ],
        "control_domains": [
          "Security Planning"
        ],
        "supplemental_references": [],
        "artifact_request": "Security Planning Policy and Procedures",
        "artifact_types": [
          "policy_document"
        ],
        "primary_artifact_type": "policy_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0128-security-planning-policy-and-procedures.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0129",
        "source_line": 129,
        "request_date": null,
        "category": "Plan",
        "workstreams": [],
        "controls": [
          "PL-2",
          "PL-2(3)"
        ],
        "control_families": [
          "PL"
        ],
        "control_domains": [
          "Security Planning"
        ],
        "supplemental_references": [],
        "artifact_request": "System Security Plan (SSP) \u2014 current version with plan coordination",
        "artifact_types": [
          "plan_document"
        ],
        "primary_artifact_type": "plan_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0129-system-security-plan-ssp-current-version-with-plan-coordination.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0130",
        "source_line": 130,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "PL-4",
          "PL-4(1)"
        ],
        "control_families": [
          "PL"
        ],
        "control_domains": [
          "Security Planning"
        ],
        "supplemental_references": [],
        "artifact_request": "Rules of behavior with social media/networking restrictions \u2014 signed by all users",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "governance_records",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0130-rules-of-behavior-with-social-media-networking-restrictions-signed-by-all-users.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0131",
        "source_line": 131,
        "request_date": null,
        "category": "Policy",
        "workstreams": [],
        "controls": [
          "PS-1"
        ],
        "control_families": [
          "PS"
        ],
        "control_domains": [
          "Personnel Security"
        ],
        "supplemental_references": [],
        "artifact_request": "Personnel Security Policy and Procedures",
        "artifact_types": [
          "policy_document"
        ],
        "primary_artifact_type": "policy_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0131-personnel-security-policy-and-procedures.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0132",
        "source_line": 132,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "PS-2"
        ],
        "control_families": [
          "PS"
        ],
        "control_domains": [
          "Personnel Security"
        ],
        "supplemental_references": [],
        "artifact_request": "Position risk designation records for all system-related positions",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "governance_records",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0132-position-risk-designation-records-for-all-system-related-positions.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0133",
        "source_line": 133,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "PS-3"
        ],
        "control_families": [
          "PS"
        ],
        "control_domains": [
          "Personnel Security"
        ],
        "supplemental_references": [],
        "artifact_request": "Personnel screening records \u2014 background investigations completed before access",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "governance_records",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0133-personnel-screening-records-background-investigations-completed-before-access.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0134",
        "source_line": 134,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "PS-4"
        ],
        "control_families": [
          "PS"
        ],
        "control_domains": [
          "Personnel Security"
        ],
        "supplemental_references": [],
        "artifact_request": "Personnel termination records \u2014 access revocation evidence within required timeframes",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "governance_records",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "quarterly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0134-personnel-termination-records-access-revocation-evidence-within-required-timefra.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0135",
        "source_line": 135,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "PS-5"
        ],
        "control_families": [
          "PS"
        ],
        "control_domains": [
          "Personnel Security"
        ],
        "supplemental_references": [],
        "artifact_request": "Personnel transfer records \u2014 access review and modification evidence",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "governance_records",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "quarterly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0135-personnel-transfer-records-access-review-and-modification-evidence.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0136",
        "source_line": 136,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "PS-6"
        ],
        "control_families": [
          "PS"
        ],
        "control_domains": [
          "Personnel Security"
        ],
        "supplemental_references": [],
        "artifact_request": "Access agreements \u2014 signed NDAs and acceptable use agreements",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "governance_records",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0136-access-agreements-signed-ndas-and-acceptable-use-agreements.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0137",
        "source_line": 137,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "PS-7"
        ],
        "control_families": [
          "PS"
        ],
        "control_domains": [
          "Personnel Security"
        ],
        "supplemental_references": [],
        "artifact_request": "Third-party personnel security requirements and compliance evidence",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "governance_records",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0137-third-party-personnel-security-requirements-and-compliance-evidence.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0138",
        "source_line": 138,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "PS-8"
        ],
        "control_families": [
          "PS"
        ],
        "control_domains": [
          "Personnel Security"
        ],
        "supplemental_references": [],
        "artifact_request": "Personnel sanctions process records",
        "artifact_types": [
          "procedure_document"
        ],
        "primary_artifact_type": "procedure_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0138-personnel-sanctions-process-records.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0139",
        "source_line": 139,
        "request_date": null,
        "category": "Policy",
        "workstreams": [],
        "controls": [
          "RA-1"
        ],
        "control_families": [
          "RA"
        ],
        "control_domains": [
          "Risk and Vulnerability Management"
        ],
        "supplemental_references": [],
        "artifact_request": "Risk Assessment Policy and Procedures",
        "artifact_types": [
          "policy_document"
        ],
        "primary_artifact_type": "policy_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0139-risk-assessment-policy-and-procedures.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0140",
        "source_line": 140,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "RA-2"
        ],
        "control_families": [
          "RA"
        ],
        "control_domains": [
          "Risk and Vulnerability Management"
        ],
        "supplemental_references": [],
        "artifact_request": "Security categorization (FIPS 199) documentation with rationale",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0140-security-categorization-fips-199-documentation-with-rationale.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0141",
        "source_line": 141,
        "request_date": null,
        "category": "Report",
        "workstreams": [],
        "controls": [
          "RA-3"
        ],
        "control_families": [
          "RA"
        ],
        "control_domains": [
          "Risk and Vulnerability Management"
        ],
        "supplemental_references": [],
        "artifact_request": "Risk assessment report \u2014 at least annual or upon significant change",
        "artifact_types": [
          "report"
        ],
        "primary_artifact_type": "report",
        "collection_channel": "report_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0141-risk-assessment-report-at-least-annual-or-upon-significant-change.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0142",
        "source_line": 142,
        "request_date": null,
        "category": "Scan",
        "workstreams": [],
        "controls": [
          "RA-5",
          "RA-5(1)",
          "RA-5(2)",
          "RA-5(5)"
        ],
        "control_families": [
          "RA"
        ],
        "control_domains": [
          "Risk and Vulnerability Management"
        ],
        "supplemental_references": [],
        "artifact_request": "Vulnerability scan results \u2014 monthly OS/infrastructure scans and web application scans",
        "artifact_types": [
          "scan_evidence"
        ],
        "primary_artifact_type": "scan_evidence",
        "collection_channel": "scanner_export",
        "platform_tags": [
          "AWS",
          "LINUX",
          "NESSUS"
        ],
        "time_scopes": [],
        "periodicity": "monthly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0142-vulnerability-scan-results-monthly-os-infrastructure-scans-and-web-application-s.csv",
          "suggested_extension": "csv"
        }
      },
      {
        "request_id": "REQ-0143",
        "source_line": 143,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "RA-5(3)"
        ],
        "control_families": [
          "RA"
        ],
        "control_domains": [
          "Risk and Vulnerability Management"
        ],
        "supplemental_references": [],
        "artifact_request": "Vulnerability scanning coverage breadth/depth \u2014 scan policy configuration",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "scanner_export",
        "platform_tags": [
          "NESSUS"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0143-vulnerability-scanning-coverage-breadth-depth-scan-policy-configuration.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0144",
        "source_line": 144,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "RA-5(8)"
        ],
        "control_families": [
          "RA"
        ],
        "control_domains": [
          "Risk and Vulnerability Management"
        ],
        "supplemental_references": [],
        "artifact_request": "Vulnerability scan review and remediation tracking \u2014 POA&M updates",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "system_of_record_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "monthly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0144-vulnerability-scan-review-and-remediation-tracking-poa-m-updates.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0145",
        "source_line": 145,
        "request_date": null,
        "category": "Policy",
        "workstreams": [],
        "controls": [
          "SA-1"
        ],
        "control_families": [
          "SA"
        ],
        "control_domains": [
          "System and Service Acquisition"
        ],
        "supplemental_references": [],
        "artifact_request": "System and Services Acquisition Policy and Procedures",
        "artifact_types": [
          "policy_document"
        ],
        "primary_artifact_type": "policy_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0145-system-and-services-acquisition-policy-and-procedures.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0146",
        "source_line": 146,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "SA-2"
        ],
        "control_families": [
          "SA"
        ],
        "control_domains": [
          "System and Service Acquisition"
        ],
        "supplemental_references": [],
        "artifact_request": "Security resource allocation in system development lifecycle",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0146-security-resource-allocation-in-system-development-lifecycle.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0147",
        "source_line": 147,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "SA-3"
        ],
        "control_families": [
          "SA"
        ],
        "control_domains": [
          "System and Service Acquisition"
        ],
        "supplemental_references": [],
        "artifact_request": "System development lifecycle (SDLC) documentation with security integration",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0147-system-development-lifecycle-sdlc-documentation-with-security-integration.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0148",
        "source_line": 148,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "SA-4"
        ],
        "control_families": [
          "SA"
        ],
        "control_domains": [
          "System and Service Acquisition"
        ],
        "supplemental_references": [],
        "artifact_request": "Acquisition contracts with security requirements and functional specifications",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0148-acquisition-contracts-with-security-requirements-and-functional-specifications.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0149",
        "source_line": 149,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "SA-4(2)"
        ],
        "control_families": [
          "SA"
        ],
        "control_domains": [
          "System and Service Acquisition"
        ],
        "supplemental_references": [],
        "artifact_request": "Security design and implementation documentation from developers",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0149-security-design-and-implementation-documentation-from-developers.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0150",
        "source_line": 150,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "SA-5"
        ],
        "control_families": [
          "SA"
        ],
        "control_domains": [
          "System and Service Acquisition"
        ],
        "supplemental_references": [],
        "artifact_request": "System documentation \u2014 administrator and user guides with security configuration guidance",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0150-system-documentation-administrator-and-user-guides-with-security-configuration-g.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0151",
        "source_line": 151,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "SA-8"
        ],
        "control_families": [
          "SA"
        ],
        "control_domains": [
          "System and Service Acquisition"
        ],
        "supplemental_references": [],
        "artifact_request": "Security engineering principles documentation applied in system design",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0151-security-engineering-principles-documentation-applied-in-system-design.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0152",
        "source_line": 152,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "SA-9"
        ],
        "control_families": [
          "SA"
        ],
        "control_domains": [
          "System and Service Acquisition"
        ],
        "supplemental_references": [],
        "artifact_request": "External information system service agreements \u2014 SLAs, security requirements",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0152-external-information-system-service-agreements-slas-security-requirements.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0153",
        "source_line": 153,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "SA-10"
        ],
        "control_families": [
          "SA"
        ],
        "control_domains": [
          "System and Service Acquisition"
        ],
        "supplemental_references": [],
        "artifact_request": "Developer configuration management \u2014 source control, build pipeline, and change tracking",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "tool_export",
        "platform_tags": [
          "JENKINS"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0153-developer-configuration-management-source-control-build-pipeline-and-change-trac.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0154",
        "source_line": 154,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "SA-11"
        ],
        "control_families": [
          "SA"
        ],
        "control_domains": [
          "System and Service Acquisition"
        ],
        "supplemental_references": [],
        "artifact_request": "Developer security testing and evaluation results \u2014 SAST/DAST scan evidence",
        "artifact_types": [
          "scan_evidence"
        ],
        "primary_artifact_type": "scan_evidence",
        "collection_channel": "scanner_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "quarterly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0154-developer-security-testing-and-evaluation-results-sast-dast-scan-evidence.csv",
          "suggested_extension": "csv"
        }
      },
      {
        "request_id": "REQ-0155",
        "source_line": 155,
        "request_date": null,
        "category": "Policy",
        "workstreams": [],
        "controls": [
          "SC-1"
        ],
        "control_families": [
          "SC"
        ],
        "control_domains": [
          "System and Communications Protection"
        ],
        "supplemental_references": [],
        "artifact_request": "System and Communications Protection Policy and Procedures",
        "artifact_types": [
          "policy_document"
        ],
        "primary_artifact_type": "policy_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0155-system-and-communications-protection-policy-and-procedures.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0156",
        "source_line": 156,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "SC-2"
        ],
        "control_families": [
          "SC"
        ],
        "control_domains": [
          "System and Communications Protection"
        ],
        "supplemental_references": [],
        "artifact_request": "Application partitioning \u2014 separation of user and management functionality",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0156-application-partitioning-separation-of-user-and-management-functionality.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0157",
        "source_line": 157,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "SC-4"
        ],
        "control_families": [
          "SC"
        ],
        "control_domains": [
          "System and Communications Protection"
        ],
        "supplemental_references": [],
        "artifact_request": "Information in shared resources protection \u2014 memory, disk, cache clearing",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0157-information-in-shared-resources-protection-memory-disk-cache-clearing.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0158",
        "source_line": 158,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "SC-5"
        ],
        "control_families": [
          "SC"
        ],
        "control_domains": [
          "System and Communications Protection"
        ],
        "supplemental_references": [],
        "artifact_request": "Denial of service protection \u2014 rate limiting, AWS Shield, WAF rules",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS",
          "WEB_APP"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "aws wafv2 list-web-acls --scope REGIONAL --output table"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0158-denial-of-service-protection-rate-limiting-aws-shield-waf-rules.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0159",
        "source_line": 159,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "SC-7",
          "SC-7(3)",
          "SC-7(4)",
          "SC-7(5)",
          "SC-7(7)"
        ],
        "control_families": [
          "SC"
        ],
        "control_domains": [
          "System and Communications Protection"
        ],
        "supplemental_references": [],
        "artifact_request": "Boundary protection \u2014 VPC architecture, security groups, managed interfaces, deny-by-default",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS",
          "NETWORK_BOUNDARY"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "aws ec2 describe-vpcs --output table",
          "aws ec2 describe-security-groups --output table",
          "aws ec2 describe-network-acls --output table"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0159-boundary-protection-vpc-architecture-security-groups-managed-interfaces-deny-by-.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0160",
        "source_line": 160,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "SC-7(8)"
        ],
        "control_families": [
          "SC"
        ],
        "control_domains": [
          "System and Communications Protection"
        ],
        "supplemental_references": [],
        "artifact_request": "Route traffic through managed proxy/firewall for external connections",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS",
          "NETWORK_BOUNDARY"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "aws ec2 describe-route-tables --output table"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0160-route-traffic-through-managed-proxy-firewall-for-external-connections.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0161",
        "source_line": 161,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "SC-8",
          "SC-8(1)"
        ],
        "control_families": [
          "SC"
        ],
        "control_domains": [
          "System and Communications Protection"
        ],
        "supplemental_references": [],
        "artifact_request": "Transmission confidentiality and integrity \u2014 TLS/encryption configuration for data in transit",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS",
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "openssl s_client -connect <host>:443 -tls1_2",
          "aws elbv2 describe-listeners --load-balancer-arn <arn> --output table"
        ],
        "config_paths": [
          "/etc/ssl/",
          "/etc/pki/tls/"
        ],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0161-transmission-confidentiality-and-integrity-tls-encryption-configuration-for-data.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0162",
        "source_line": 162,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "SC-10"
        ],
        "control_families": [
          "SC"
        ],
        "control_domains": [
          "System and Communications Protection"
        ],
        "supplemental_references": [],
        "artifact_request": "Network session disconnect after 30 minutes inactivity for remote access",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "grep ClientAliveInterval /etc/ssh/sshd_config",
          "grep ClientAliveCountMax /etc/ssh/sshd_config"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0162-network-session-disconnect-after-30-minutes-inactivity-for-remote-access.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0163",
        "source_line": 163,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "SC-12"
        ],
        "control_families": [
          "SC"
        ],
        "control_domains": [
          "System and Communications Protection"
        ],
        "supplemental_references": [],
        "artifact_request": "Cryptographic key establishment and management \u2014 KMS configuration",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "aws kms list-keys --output table",
          "aws kms describe-key --key-id <key-id>"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0163-cryptographic-key-establishment-and-management-kms-configuration.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0164",
        "source_line": 164,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "SC-13"
        ],
        "control_families": [
          "SC"
        ],
        "control_domains": [
          "System and Communications Protection"
        ],
        "supplemental_references": [],
        "artifact_request": "FIPS-validated cryptographic module usage evidence",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "cat /proc/sys/crypto/fips_enabled",
          "openssl version"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0164-fips-validated-cryptographic-module-usage-evidence.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0165",
        "source_line": 165,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "SC-15"
        ],
        "control_families": [
          "SC"
        ],
        "control_domains": [
          "System and Communications Protection"
        ],
        "supplemental_references": [],
        "artifact_request": "Collaborative computing device configuration \u2014 remote activation prevention",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0165-collaborative-computing-device-configuration-remote-activation-prevention.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0166",
        "source_line": 166,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "SC-17"
        ],
        "control_families": [
          "SC"
        ],
        "control_domains": [
          "System and Communications Protection"
        ],
        "supplemental_references": [],
        "artifact_request": "PKI certificate management \u2014 valid certificates from approved CAs",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "tool_export",
        "platform_tags": [
          "AWS",
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "quarterly",
        "commands": [
          "aws acm list-certificates --output table"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0166-pki-certificate-management-valid-certificates-from-approved-cas.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0167",
        "source_line": 167,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "SC-18"
        ],
        "control_families": [
          "SC"
        ],
        "control_domains": [
          "System and Communications Protection"
        ],
        "supplemental_references": [],
        "artifact_request": "Mobile code restrictions \u2014 browser/Java/ActiveX settings",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0167-mobile-code-restrictions-browser-java-activex-settings.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0168",
        "source_line": 168,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "SC-19"
        ],
        "control_families": [
          "SC"
        ],
        "control_domains": [
          "System and Communications Protection"
        ],
        "supplemental_references": [],
        "artifact_request": "Voice over IP (VoIP) security configuration if applicable",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0168-voice-over-ip-voip-security-configuration-if-applicable.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0169",
        "source_line": 169,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "SC-20",
          "SC-21",
          "SC-22"
        ],
        "control_families": [
          "SC"
        ],
        "control_domains": [
          "System and Communications Protection"
        ],
        "supplemental_references": [],
        "artifact_request": "DNS security \u2014 DNSSEC, name resolution integrity and authentication",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS",
          "DNS_EMAIL_AUTH"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "aws route53 get-dnssec --hosted-zone-id <zone>"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0169-dns-security-dnssec-name-resolution-integrity-and-authentication.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0170",
        "source_line": 170,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "SC-23"
        ],
        "control_families": [
          "SC"
        ],
        "control_domains": [
          "System and Communications Protection"
        ],
        "supplemental_references": [],
        "artifact_request": "Session authenticity \u2014 anti-session-hijacking measures and CSRF protection",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "document_repository",
        "platform_tags": [
          "WEB_APP"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0170-session-authenticity-anti-session-hijacking-measures-and-csrf-protection.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0171",
        "source_line": 171,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "SC-28",
          "SC-28(1)"
        ],
        "control_families": [
          "SC"
        ],
        "control_domains": [
          "System and Communications Protection"
        ],
        "supplemental_references": [],
        "artifact_request": "Data at rest encryption \u2014 EBS, RDS, S3 encryption configuration",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "AWS"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "aws rds describe-db-instances --query 'DBInstances[].{ID:DBInstanceIdentifier,Encrypted:StorageEncrypted}' --output table",
          "aws s3api get-bucket-encryption --bucket <bucket>"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0171-data-at-rest-encryption-ebs-rds-s3-encryption-configuration.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0172",
        "source_line": 172,
        "request_date": null,
        "category": "Policy",
        "workstreams": [],
        "controls": [
          "SI-1"
        ],
        "control_families": [
          "SI"
        ],
        "control_domains": [
          "System and Information Integrity"
        ],
        "supplemental_references": [],
        "artifact_request": "System and Information Integrity Policy and Procedures",
        "artifact_types": [
          "policy_document"
        ],
        "primary_artifact_type": "policy_document",
        "collection_channel": "document_repository",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0172-system-and-information-integrity-policy-and-procedures.pdf",
          "suggested_extension": "pdf"
        }
      },
      {
        "request_id": "REQ-0173",
        "source_line": 173,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "SI-2",
          "SI-2(2)"
        ],
        "control_families": [
          "SI"
        ],
        "control_domains": [
          "System and Information Integrity"
        ],
        "supplemental_references": [],
        "artifact_request": "Flaw remediation \u2014 patch management records and automated patch status reporting",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "tool_export",
        "platform_tags": [
          "AWS",
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "monthly",
        "commands": [
          "yum updateinfo list security",
          "yum check-update",
          "aws ssm describe-instance-patch-states --output table"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0173-flaw-remediation-patch-management-records-and-automated-patch-status-reporting.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0174",
        "source_line": 174,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "SI-3",
          "SI-3(1)",
          "SI-3(2)"
        ],
        "control_families": [
          "SI"
        ],
        "control_domains": [
          "System and Information Integrity"
        ],
        "supplemental_references": [],
        "artifact_request": "Malicious code protection \u2014 antimalware/EDR configuration, automatic updates, and real-time scanning",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "tool_export",
        "platform_tags": [
          "LINUX",
          "TREND_MICRO"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0174-malicious-code-protection-antimalware-edr-configuration-automatic-updates-and-re.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0175",
        "source_line": 175,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "SI-4",
          "SI-4(1)",
          "SI-4(2)",
          "SI-4(4)",
          "SI-4(5)"
        ],
        "control_families": [
          "SI"
        ],
        "control_domains": [
          "System and Information Integrity"
        ],
        "supplemental_references": [],
        "artifact_request": "Information system monitoring \u2014 IDS/IPS, GuardDuty, CloudWatch alarms, and Splunk alert configuration",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "tool_export",
        "platform_tags": [
          "AWS",
          "SPLUNK"
        ],
        "time_scopes": [],
        "periodicity": "weekly",
        "commands": [
          "aws guardduty list-detectors --output table",
          "aws guardduty get-detector --detector-id <id>",
          "aws cloudwatch describe-alarms --output table"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0175-information-system-monitoring-ids-ips-guardduty-cloudwatch-alarms-and-splunk-ale.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0176",
        "source_line": 176,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "SI-4"
        ],
        "control_families": [
          "SI"
        ],
        "control_domains": [
          "System and Information Integrity"
        ],
        "supplemental_references": [],
        "artifact_request": "System monitoring alert review and triage records",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "tool_export",
        "platform_tags": [
          "SPLUNK"
        ],
        "time_scopes": [],
        "periodicity": "weekly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0176-system-monitoring-alert-review-and-triage-records.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0177",
        "source_line": 177,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "SI-5"
        ],
        "control_families": [
          "SI"
        ],
        "control_domains": [
          "System and Information Integrity"
        ],
        "supplemental_references": [],
        "artifact_request": "Security alerts and advisories \u2014 receipt, dissemination, and action records",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "system_of_record_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "monthly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0177-security-alerts-and-advisories-receipt-dissemination-and-action-records.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0178",
        "source_line": 178,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "SI-6"
        ],
        "control_families": [
          "SI"
        ],
        "control_domains": [
          "System and Information Integrity"
        ],
        "supplemental_references": [],
        "artifact_request": "Security function verification \u2014 integrity checks and self-test results",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "tool_export",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "quarterly",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0178-security-function-verification-integrity-checks-and-self-test-results.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0179",
        "source_line": 179,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "SI-7",
          "SI-7(1)"
        ],
        "control_families": [
          "SI"
        ],
        "control_domains": [
          "System and Information Integrity"
        ],
        "supplemental_references": [],
        "artifact_request": "Software and information integrity \u2014 file integrity monitoring configuration (AIDE/OSSEC/Tripwire)",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "aide --check"
        ],
        "config_paths": [
          "/etc/aide.conf"
        ],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0179-software-and-information-integrity-file-integrity-monitoring-configuration-aide-.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0180",
        "source_line": 180,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "SI-8",
          "SI-8(1)",
          "SI-8(2)"
        ],
        "control_families": [
          "SI"
        ],
        "control_domains": [
          "System and Information Integrity"
        ],
        "supplemental_references": [],
        "artifact_request": "Spam protection \u2014 email filtering configuration with automatic updates and centralized management",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "tool_export",
        "platform_tags": [
          "DNS_EMAIL_AUTH"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0180-spam-protection-email-filtering-configuration-with-automatic-updates-and-central.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0181",
        "source_line": 181,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "SI-10"
        ],
        "control_families": [
          "SI"
        ],
        "control_domains": [
          "System and Information Integrity"
        ],
        "supplemental_references": [],
        "artifact_request": "Information input validation \u2014 application input validation configuration",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "document_repository",
        "platform_tags": [
          "WEB_APP"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0181-information-input-validation-application-input-validation-configuration.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0182",
        "source_line": 182,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "SI-11"
        ],
        "control_families": [
          "SI"
        ],
        "control_domains": [
          "System and Information Integrity"
        ],
        "supplemental_references": [],
        "artifact_request": "Error handling \u2014 error messages that don't reveal sensitive information",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "document_repository",
        "platform_tags": [
          "WEB_APP"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0182-error-handling-error-messages-that-don-t-reveal-sensitive-information.txt",
          "suggested_extension": "txt"
        }
      },
      {
        "request_id": "REQ-0183",
        "source_line": 183,
        "request_date": null,
        "category": "Records",
        "workstreams": [],
        "controls": [
          "SI-12"
        ],
        "control_families": [
          "SI"
        ],
        "control_domains": [
          "System and Information Integrity"
        ],
        "supplemental_references": [],
        "artifact_request": "Information handling and retention procedures compliance evidence",
        "artifact_types": [
          "records"
        ],
        "primary_artifact_type": "records",
        "collection_channel": "governance_records",
        "platform_tags": [],
        "time_scopes": [],
        "periodicity": "annual",
        "commands": [],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0183-information-handling-and-retention-procedures-compliance-evidence.xlsx",
          "suggested_extension": "xlsx"
        }
      },
      {
        "request_id": "REQ-0184",
        "source_line": 184,
        "request_date": null,
        "category": "Configuration",
        "workstreams": [],
        "controls": [
          "SI-16"
        ],
        "control_families": [
          "SI"
        ],
        "control_domains": [
          "System and Information Integrity"
        ],
        "supplemental_references": [],
        "artifact_request": "Memory protection \u2014 ASLR, DEP/NX, stack protection configuration",
        "artifact_types": [
          "configuration_snapshot"
        ],
        "primary_artifact_type": "configuration_snapshot",
        "collection_channel": "cli_capture",
        "platform_tags": [
          "LINUX"
        ],
        "time_scopes": [],
        "periodicity": "on_demand",
        "commands": [
          "cat /proc/sys/kernel/randomize_va_space",
          "dmesg | grep NX"
        ],
        "config_paths": [],
        "bundle_hint": {
          "relative_path": "artifacts/REQ-0184-memory-protection-aslr-dep-nx-stack-protection-configuration.txt",
          "suggested_extension": "txt"
        }
      }
    ]
  }
} as const;

export const ASSESSMENT_ARTIFACT_TEMPLATE_LIST = Object.values(ASSESSMENT_ARTIFACT_TEMPLATES).map((tpl) => ({
	key: tpl.key,
	name: tpl.name,
	description: tpl.description,
	framework: tpl.framework,
	platforms: [...tpl.platforms],
	item_count: tpl.item_count
}));
