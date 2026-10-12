#!/usr/bin/env node

// Credential-free regression suite: actual TS transport, fake fetch/identity,
// pure responsive-QA policy, and actual questionnaire handlers with hook/JSX
// shims. No browser, database, or live HTTP requests.
import './api_client_contract.test.mjs';
import './responsive_qa_policy.test.mjs';
import './browser_preferences.test.mjs';
import './questionnaire_save.test.mjs';
