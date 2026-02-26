# RegScale + Paramify Parity Feature Matrix

This matrix catalogs implemented replacement features, links each one to concrete UI/API surfaces, and maps to enforced test tags in `qa/feature_coverage_manifest.json`.

## Source catalogs used

- RegScale platform capabilities and federal automation positioning:
  - [RegScale product site](https://regscale.com/)
  - [RegScale platform/product overview brief](https://regscale.com/resource-center/brief-platform-product-overview/)
- Paramify platform and documentation/support feature pages:
  - [Paramify product site](https://www.paramify.com/)
  - [Paramify Docs (OSCAL SSP)](https://docs.paramify.com/oscal)
  - [Paramify support: POA&M Management](https://support.paramify.com/hc/en-us/articles/41260791333011-POA-M-Management)
  - [Paramify support: Jira Integration](https://support.paramify.com/hc/en-us/articles/39302203976467-Jira-Integration)
  - [Paramify support: Upload Evidence via API](https://support.paramify.com/hc/en-us/articles/43295256322963-Upload-Evidence-to-Paramify-using-the-API)
- Internal implementation claims in `README.md` and bounded-context route declarations

## Enforced feature set

| Feature ID | Capability | UI Route(s) | API Endpoint(s) | Frontend Tag | Backend Tag |
|---|---|---|---|---|---|
| `connectors` | Connector management | `/connectors` | `/api/connectors/instances/`, `/api/connectors/registry/` | `feature:connectors` | `feature:connectors` |
| `scanner_connectors` | Scanner connector coverage | `/connectors` | `/api/connectors/registry/`, `/api/connectors/instances/` | `feature:scanner_connectors` | `feature:scanner_connectors` |
| `sarif_scap_import` | SARIF/SCAP import connectors | `/connectors` | `/api/connectors/registry/` | `feature:sarif_scap_import` | `feature:sarif_scap_import` |
| `servicenow_jira_integration` | ITSM integrations | `/connectors` | `/api/integrations/providers/`, `/api/integrations/test-connection/` | `feature:servicenow_jira_integration` | `feature:servicenow_jira_integration` |
| `assessments_lightning` | Lightning assessments | `/assessments/lightning` | `/api/assessments/lightning/` | `feature:assessments_lightning` | `feature:assessments_lightning` |
| `version_history` | Version snapshots/diff/audit | `/version-history` | `/api/version-history/`, `/api/version-history/snapshots/`, `/api/version-history/diff/`, `/api/version-history/audit/` | `feature:version_history` | `feature:version_history` |
| `security_graph` | Security graph and attack paths | `/security-graph` | `/api/security-graph/`, `/api/security-graph/attack-paths/` | `feature:security_graph` | `feature:security_graph` |
| `evidence_automation` | Evidence source automation | `/evidence-automation` | `/api/evidence-automation/sources/`, `/api/evidence-automation/source-types/` | `feature:evidence_automation` | `feature:evidence_automation` |
| `workflows` | Workflow automation | `/workflows` | `/api/workflows/` | `feature:workflows` | `feature:workflows` |
| `continuous_monitoring` | ConMon dashboard and profiles | `/continuous-monitoring` | `/api/conmon/dashboard/`, `/api/conmon/profiles/` | `feature:continuous_monitoring` | `feature:continuous_monitoring` |
| `poam_management` | POA&M lifecycle | `/poam` | `/api/poam/poam-items/`, `/api/poam/poam-items/export_fedramp/` | `feature:poam_management` | `feature:poam_management` |
| `oscal` | OSCAL import/export | `/oscal` | `/api/oscal/import/validate/`, `/api/oscal/export/` | `feature:oscal` | `feature:oscal` |
| `fedramp_automation` | FedRAMP 20x automation exports | `/reports/conmon-monthly` | `/api/rmf/fedramp-20x/ksi/`, `/api/rmf/fedramp-20x/oar/`, `/api/rmf/fedramp-20x/complete/` | `feature:fedramp_automation` | `feature:fedramp_automation` |
| `multi_framework_libraries` | Multi-framework library ops | `/libraries` | `/api/stored-libraries/`, `/api/loaded-libraries/` | `feature:multi_framework_libraries` | `feature:multi_framework_libraries` |
| `mapping_engine` | Cross-framework mapping | `/experimental/mapping` | `/api/requirement-mapping-sets/`, `/api/mapping-libraries/` | `feature:mapping_engine` | `feature:mapping_engine` |
| `vendor_questionnaires` | Vendor portal questionnaire flow | `/entity-assessments/questionnaire` | `/api/vendor-portal/tokens/create/`, `/api/vendor-portal/<token>/questionnaire/` | `feature:vendor_questionnaires` | `feature:vendor_questionnaires` |
| `ai_assistant` | AI author/extractor/auditor/explainer | `/ai-assistant` | `/api/ai/author/draft-control/`, `/api/ai/extractor/upload/`, `/api/ai/auditor/gap-analysis/` | `feature:ai_assistant` | `feature:ai_assistant` |
| `ai_vendor_scoring` | AI vendor scoring and summary | `/scoring-assistant` | `/api/ai/vendor-scoring/<uuid:pk>/`, `/api/ai/vendor-scoring/risk-summary/` | `feature:ai_vendor_scoring` | `feature:ai_vendor_scoring` |
| `quantitative_risk` | Monte Carlo/risk quant workflows | `/experimental/loss-exceedance` | `/api/crq/quantitative-risk-studies/`, `/api/crq/analytics/portfolio/analyze/` | `feature:quantitative_risk` | `feature:quantitative_risk` |
| `ocsf_oscal_translation` | OCSF to OSCAL normalization | `/oscal` | `/api/integrations/ocsf/import/`, `/api/integrations/ocsf/to-oscal/` | `feature:ocsf_oscal_translation` | `feature:ocsf_oscal_translation` |

## Non-functional parity claims

The following are tracked separately from UI/API feature coverage because they are not product workflows:

- Open source licensing
- Self-hosting deployment mode
