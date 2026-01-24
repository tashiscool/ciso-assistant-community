# License Audit Report

**Generated:** January 2026
**Repository:** ciso-assistant-community (fork)

---

## Executive Summary

| Category | Lines of Code | Percentage |
|----------|---------------|------------|
| **Your NEW Code** | ~119,000 | **50.3%** |
| **Original AGPL Code** | ~117,000 | 49.7% |

You have written approximately **half** of the codebase. However, because this is a fork of an AGPL-licensed project, the licensing situation is nuanced.

---

## Code Ownership Analysis

### ✅ NEW MODULES (Your Code - Potentially MIT/Apache)

These directories were **created by you** and don't exist in the original repository:

| Module | Files | Lines | Description |
|--------|-------|-------|-------------|
| `ai_assistant/` | 22 | 11,462 | AI-powered auditor, author, explainer, extractor |
| `oscal_integration/` | 14 | 7,115 | OSCAL SSP generation, FedRAMP validation |
| `compliance/` | 19 | 6,927 | Compliance assessment service |
| `connectors/` | 38 | 6,674 | AWS, Azure, GitHub, API connectors |
| `risk_registers/` | 22 | 5,913 | Risk assessment, CVSS, dashboards |
| `continuous_monitoring/` | 21 | 4,849 | ConMon profiles, KSI tracking |
| `questionnaires/` | 14 | 4,197 | Dynamic questionnaire engine |
| `evidence_automation/` | 15 | 2,975 | Automated evidence collection |
| `asset_and_service/` | 8 | 2,436 | Asset management (DDD) |
| `control_library/` | 8 | 2,277 | Control management (DDD) |
| `poam/` | 10 | 2,109 | POA&M management, FedRAMP exports |
| `security_operations/` | 16 | 1,769 | Security operations |
| `third_party_management/` | 15 | 1,117 | Vendor risk management |
| `business_continuity/` | 15 | 1,060 | BCP, disaster recovery |
| `core/bounded_contexts/` | 299 | 58,288 | DDD bounded contexts |

**Subtotal:** ~119,000 lines

### ⚠️ ORIGINAL MODULES (AGPL - Derivative Work)

These directories existed in the original AGPL repository:

| Module | Files | Lines | Notes |
|--------|-------|-------|-------|
| `core/` (excl. bounded_contexts) | ~213 | ~52,000 | Original models, views, serializers |
| `privacy/` | 47 | 11,141 | May have your additions |
| `tprm/` | 26 | 8,315 | Third-party risk (original) |
| `integrations/` | 32 | 6,543 | May have your additions (OCSF) |
| `app_tests/` | 23 | 5,875 | Original test files |
| `ebios_rm/` | 36 | 5,803 | EBIOS risk methodology |
| `crq/` | 16 | 5,781 | Quantitative risk |
| `iam/` | 45 | 4,943 | Identity & access management |
| `data_wizard/` | 11 | 4,250 | Data import/export |
| `metrology/` | 16 | 3,364 | Metrics and measurements |
| `serdes/` | 9 | 2,289 | Serialization |
| `library/` | 13 | 2,079 | Framework libraries |
| `resilience/` | 14 | 1,122 | Resilience features |
| Other modules | ~50 | ~4,000 | Various utilities |

**Subtotal:** ~117,000 lines

---

## Licensing Options

### Option 1: Dual License (Recommended)

Keep both licenses with clear separation:

```
/backend/
├── ai_assistant/          # MIT/Apache (your code)
├── oscal_integration/     # MIT/Apache (your code)
├── compliance/            # MIT/Apache (your code)
├── connectors/            # MIT/Apache (your code)
├── [other new modules]/   # MIT/Apache (your code)
├── core/
│   ├── bounded_contexts/  # MIT/Apache (your code)
│   └── [original files]/  # AGPL (derivative)
├── iam/                   # AGPL (derivative)
├── [other original]/      # AGPL (derivative)
└── LICENSE.md             # Dual license explanation
```

### Option 2: Full MIT/Apache (Requires Work)

To fully relicense to MIT/Apache, you would need to:

1. **Remove or rewrite** all original AGPL code (~117,000 lines)
2. Create clean-room implementations of:
   - Core models and serializers
   - IAM system
   - Original API views
   - EBIOS-RM, CRQ modules
   - TPRM module

### Option 3: Keep AGPL (Simplest)

Keep everything AGPL. This is legally safest but restricts commercial use.

---

## Files Requiring Attention

### High Priority (Core Functionality)

These original files are central to the application:

```
backend/core/models.py              # Original models
backend/core/views.py               # Original views
backend/core/serializers.py         # Original serializers
backend/core/apps.py                # App configuration
backend/iam/                        # Authentication/authorization
backend/ciso_assistant/settings.py  # Django settings
```

### Medium Priority (Feature Modules)

These provide significant functionality:

```
backend/ebios_rm/                   # EBIOS risk methodology
backend/crq/                        # Quantitative risk
backend/tprm/                       # Third-party risk
backend/data_wizard/                # Import/export
```

### Low Priority (Utilities)

These are smaller utilities:

```
backend/serdes/                     # Serialization helpers
backend/library/                    # Framework loading
backend/metrology/                  # Metrics
```

---

## Recommendation

Given that you've written **50%+ of the code** and created the entire DDD architecture, I recommend:

1. **Dual License Structure**:
   - Your new modules: MIT or Apache 2.0
   - Original/derivative code: AGPL v3

2. **Create Clear Separation**:
   - Add license headers to all files indicating their license
   - Update LICENSE.md to explain the dual structure

3. **Consider Gradual Migration**:
   - Over time, rewrite remaining AGPL modules
   - Eventually achieve full MIT/Apache if desired

---

## Next Steps

1. Review this audit with a lawyer for legal certainty
2. Decide on licensing approach
3. I can help implement whichever option you choose

---

*This audit is for informational purposes. Consult a legal professional for definitive licensing advice.*
