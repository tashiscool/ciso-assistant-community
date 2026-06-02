#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_WORKBOOK = path.join(os.homedir(), 'Downloads', 'EconSys FY20 FedRAMP Assessment Secure File Share.xlsx');
const DEFAULT_OUTPUT_ROOT = path.resolve('.playwright-regovise');
const DEFAULT_MARKER = 'FEDHR-FY20-FEDRAMP-XLSX';
const DEFAULT_PACKAGE_TITLE = 'EconSys FY20 FedRAMP Assessment Secure File Share';
const DEFAULT_TENANT_SLUG = 'fedhr';
const DEFAULT_FOLDER_NAME = 'FY20 FedRAMP Assessment';
const ASSESSMENT_MATTER = 'EconSys FY20 FedRAMP Assessment';
const USER_AGENT = 'regovise-fedhr-fedramp-import/1.0';
const FALLBACK_DATE = '2020-05-07';

function parseArgs(argv) {
  const args = {
    mode: 'dry-run',
    workbook: process.env.FEDHR_FEDRAMP_WORKBOOK || DEFAULT_WORKBOOK,
    outputRoot: process.env.FEDHR_FEDRAMP_IMPORT_OUTPUT_DIR || DEFAULT_OUTPUT_ROOT,
    marker: process.env.FEDHR_FEDRAMP_IMPORT_MARKER || DEFAULT_MARKER,
    baseUrl: (process.env.REGOVISE_PROD_BASE_URL || 'https://regovise.com').replace(/\/$/, ''),
    tenantSlug: process.env.REGOVISE_VERIFY_TENANT_SLUG || DEFAULT_TENANT_SLUG,
    adminEmail: process.env.REGOVISE_VERIFY_EMAIL || '',
    bootstrapSecret: process.env.BOOTSTRAP_SETUP_SECRET || '',
    folderName: process.env.FEDHR_FEDRAMP_FOLDER_NAME || DEFAULT_FOLDER_NAME,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') args.mode = 'dry-run';
    else if (arg === '--apply') args.mode = 'apply';
    else if (arg === '--cleanup-marker') args.mode = 'cleanup';
    else if (arg.startsWith('--cleanup-marker=')) {
      args.mode = 'cleanup';
      args.marker = arg.slice('--cleanup-marker='.length);
    } else if (arg === '--workbook') args.workbook = argv[++index] || args.workbook;
    else if (arg.startsWith('--workbook=')) args.workbook = arg.slice('--workbook='.length);
    else if (arg === '--output-dir') args.outputRoot = argv[++index] || args.outputRoot;
    else if (arg.startsWith('--output-dir=')) args.outputRoot = arg.slice('--output-dir='.length);
    else if (arg === '--marker') args.marker = argv[++index] || args.marker;
    else if (arg.startsWith('--marker=')) args.marker = arg.slice('--marker='.length);
    else if (arg === '--tenant-slug') args.tenantSlug = argv[++index] || args.tenantSlug;
    else if (arg.startsWith('--tenant-slug=')) args.tenantSlug = arg.slice('--tenant-slug='.length);
    else if (arg === '--base-url') args.baseUrl = (argv[++index] || args.baseUrl).replace(/\/$/, '');
    else if (arg.startsWith('--base-url=')) args.baseUrl = arg.slice('--base-url='.length).replace(/\/$/, '');
    else if (arg === '--folder-name') args.folderName = argv[++index] || args.folderName;
    else if (arg.startsWith('--folder-name=')) args.folderName = arg.slice('--folder-name='.length);
    else if (arg === '--json') args.json = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node cloudflare/scripts/import_fedhr_fedramp_assessment.mjs --dry-run [--workbook <path>]
  node cloudflare/scripts/import_fedhr_fedramp_assessment.mjs --apply
  node cloudflare/scripts/import_fedhr_fedramp_assessment.mjs --cleanup-marker[=<marker>]

Apply/cleanup require:
  REGOVISE_PROD_BASE_URL=https://regovise.com
  REGOVISE_VERIFY_TENANT_SLUG=fedhr
  REGOVISE_VERIFY_EMAIL=<tenant admin email>
  BOOTSTRAP_SETUP_SECRET=<secret>
  FEDHR_FEDRAMP_IMPORT_ALLOW_MUTATIONS=1
  LIVE_VALIDATION_ALLOW_MUTATIONS=1`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function parseWorkbookWithPython(workbookPath) {
  const python = process.env.PYTHON_BIN || 'python3';
  const code = String.raw`
import datetime
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'

def q(ns, tag):
    return '{%s}%s' % (ns, tag)

def col_index(ref):
    letters = ''.join(ch for ch in ref if ch.isalpha())
    total = 0
    for ch in letters:
        total = total * 26 + (ord(ch.upper()) - 64)
    return total - 1

def text_content(node):
    return ''.join(node.itertext())

def excel_date(serial):
    try:
        value = float(serial)
    except Exception:
        return serial
    # Excel incorrectly treats 1900 as a leap year; the OOXML serial epoch below mirrors standard readers.
    base = datetime.datetime(1899, 12, 30)
    dt = base + datetime.timedelta(days=value)
    return dt.date().isoformat()

def read_xml(zip_file, name):
    try:
        return ET.fromstring(zip_file.read(name))
    except KeyError:
        return None

path = sys.argv[1]
with zipfile.ZipFile(path) as zf:
    shared = []
    shared_root = read_xml(zf, 'xl/sharedStrings.xml')
    if shared_root is not None:
        for si in shared_root.findall(q(NS_MAIN, 'si')):
            shared.append(text_content(si))

    date_style_indexes = set()
    styles_root = read_xml(zf, 'xl/styles.xml')
    custom_num_fmts = {}
    if styles_root is not None:
        num_fmts = styles_root.find(q(NS_MAIN, 'numFmts'))
        if num_fmts is not None:
            for fmt in num_fmts.findall(q(NS_MAIN, 'numFmt')):
                fmt_id = fmt.attrib.get('numFmtId')
                fmt_code = fmt.attrib.get('formatCode', '')
                if fmt_id:
                    custom_num_fmts[fmt_id] = fmt_code
        cell_xfs = styles_root.find(q(NS_MAIN, 'cellXfs'))
        if cell_xfs is not None:
            for index, xf in enumerate(cell_xfs.findall(q(NS_MAIN, 'xf'))):
                num_fmt_id = xf.attrib.get('numFmtId', '')
                fmt_code = custom_num_fmts.get(num_fmt_id, '')
                is_builtin_date = num_fmt_id in {'14','15','16','17','18','19','20','21','22','45','46','47'}
                is_custom_date = bool(re.search(r'(^|[^\\\\])[ymdhHsS]', fmt_code))
                if is_builtin_date or is_custom_date:
                    date_style_indexes.add(str(index))

    workbook_root = read_xml(zf, 'xl/workbook.xml')
    rels_root = read_xml(zf, 'xl/_rels/workbook.xml.rels')
    rel_targets = {}
    if rels_root is not None:
        for rel in rels_root.findall(q(NS_PKG_REL, 'Relationship')):
            rel_targets[rel.attrib.get('Id')] = rel.attrib.get('Target', '')

    sheets = []
    for sheet in workbook_root.findall('.//' + q(NS_MAIN, 'sheet')):
        name = sheet.attrib.get('name')
        rel_id = sheet.attrib.get(q(NS_REL, 'id'))
        target = rel_targets.get(rel_id, '')
        target = target if target.startswith('xl/') else 'xl/' + target.lstrip('/')
        sheets.append({'name': name, 'target': target})

    selected = None
    for sheet in sheets:
        if sheet['name'] == 'EconSys FY20 FedRAMP Assessment':
            selected = sheet
            break
    if selected is None:
        selected = sheets[0]

    sheet_root = read_xml(zf, selected['target'])
    rows = []
    for row in sheet_root.findall('.//' + q(NS_MAIN, 'row')):
        row_values = []
        for c in row.findall(q(NS_MAIN, 'c')):
            ref = c.attrib.get('r', '')
            idx = col_index(ref)
            while len(row_values) <= idx:
                row_values.append(None)
            cell_type = c.attrib.get('t')
            style_index = c.attrib.get('s')
            value = None
            if cell_type == 'inlineStr':
                inline = c.find(q(NS_MAIN, 'is'))
                value = text_content(inline) if inline is not None else None
            else:
                v = c.find(q(NS_MAIN, 'v'))
                if v is not None:
                    raw = v.text
                    if cell_type == 's':
                        try:
                            value = shared[int(raw)]
                        except Exception:
                            value = raw
                    elif style_index in date_style_indexes:
                        value = excel_date(raw)
                    else:
                        value = raw
            row_values[idx] = value
        rows.append(row_values)

    print(json.dumps({'sheetName': selected['name'], 'rows': rows}, ensure_ascii=False))
`;

  const result = spawnSync(python, ['-c', code, workbookPath], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 30,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Workbook parser failed: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

function normalizeDate(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const year = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    return `${year}-${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}`;
  }
  return trimmed;
}

function daysBetween(start, finish) {
  if (!start || !finish) return null;
  const left = Date.parse(`${start}T00:00:00Z`);
  const right = Date.parse(`${finish}T00:00:00Z`);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  return Math.round((right - left) / 86_400_000);
}

function parseControls(value) {
  return String(value || '')
    .split(/[,;\n]+/)
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function controlPrefix(control) {
  if (control === 'SAP' || control === 'Pen Test') return control;
  const match = control.match(/^([A-Z]{2})-/);
  return match ? match[1] : 'Other';
}

function normalizePoc(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parts = raw
    .split(/\n|\/|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const key = item.toLowerCase();
      if (key === 'tash') return 'Tash Khan';
      if (['frederick', 'fredrick', 'fred'].includes(key)) return 'Frederick Boateng';
      if (key === 'seech') return 'Se-Chien';
      if (key === 'kimberly kettner') return 'Kim Kettner';
      if (key === 'kim') return 'Kim Kettner';
      return item;
    });
  return [...new Set(parts)].join('; ');
}

function parseCommentEvents(comment) {
  const text = String(comment || '').trim();
  if (!text) return [];
  const matcher = /(Comment(?:s)?\s+from\s+[^(:\n]+|Comment\s+From\s+[^(:\n]+|Comments\s+From\s+[^(:\n]+)\s*\(([^)]+)\)\s*:/gi;
  const matches = [...text.matchAll(matcher)];
  if (matches.length === 0) {
    return [{ author: 'Unstructured/unknown', dateLabel: null, text }];
  }
  const events = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const next = matches[index + 1];
    const start = match.index + match[0].length;
    const end = next ? next.index : text.length;
    events.push({
      author: match[1].replace(/\s+/g, ' ').trim(),
      dateLabel: match[2].trim(),
      text: text.slice(start, end).trim(),
    });
  }
  return events;
}

function inferEvidenceType(requestItem) {
  const text = String(requestItem || '').toLowerCase();
  if (/screenshot|screen shot|screen-shot|displaying|evidence displaying/.test(text)) return 'Screenshot/Screen Evidence';
  if (/configuration|config|dump|command|aws|openssl|database|firewall|siem|audit log|cloudtrail|splunk/.test(text)) {
    return /log|splunk|cloudtrail|audit/.test(text) ? 'Configuration/Log Extract' : 'Configuration/Log Extract';
  }
  if (/listing|list|inventory|export|report|scan results|results report|records of|schedule/.test(text)) {
    return 'Report/List/Export';
  }
  if (/ticket|change|approval|review|exception|incident|sample/.test(text)) return 'Sample Record/Ticket';
  if (/policy|procedure|guide|plan|ssp|poa&m|form|presentation|handbook|contract|agreement|sla|authorization|attestation/.test(text)) {
    return 'Policy/Procedure/Plan/Document';
  }
  return 'Other';
}

function evidenceLockerType(evidenceType, requestItem) {
  const text = String(requestItem || '').toLowerCase();
  if (evidenceType === 'Screenshot/Screen Evidence') return 'Screenshot';
  if (evidenceType === 'Report/List/Export') return 'Report';
  if (evidenceType === 'Configuration/Log Extract') return /log|splunk|cloudtrail|audit/.test(text) ? 'Log Extract' : 'Configuration';
  if (/policy/.test(text)) return 'Policy';
  if (/procedure|guide|plan|ssp|handbook/.test(text)) return 'Procedure';
  if (/attestation|approval|authorization/.test(text)) return 'Attestation';
  return 'Other';
}

function inferFamily(controls, requestItem) {
  const text = String(requestItem || '').toLowerCase();
  const prefixes = new Set(controls.map(controlPrefix));
  if (text.includes('sap') && /security assessment plan|completed security assessment plan/.test(text)) {
    return 'Assessment planning / SAP package';
  }
  if (/pen test|penetration|vulnerab|scan|deviation|false positive|risk adjustment|vendor dependenc/.test(text)) {
    return 'Vulnerability scanning / penetration testing';
  }
  if (/maintenance|diagnostic/.test(text)) {
    return 'Maintenance';
  }
  if (/account|authenticat|password|access|privilege|role|session|mfa|identity|user/.test(text) || prefixes.has('AC') || prefixes.has('IA')) {
    return 'Identity and access management';
  }
  if (/ssp|policy|procedure|guide|plan|poa&m|rules of behavior|handbook|authorization/.test(text) || prefixes.has('PL')) {
    return 'System security plan / policies / procedures';
  }
  if (/inventory|baseline|boundary|component|host|server|database|asset|unauthorized hardware|unauthorized software/.test(text) || prefixes.has('CM')) {
    return 'Inventory / boundary / assets';
  }
  if (/change|configuration|patch|release|whitelist|blacklist|modsecurity|trendmicro/.test(text)) {
    return 'Configuration and change management';
  }
  if (/audit|log|siem|splunk|alert|monitoring/.test(text) || prefixes.has('AU')) {
    return 'Audit logging and monitoring';
  }
  if (/training|awareness/.test(text) || prefixes.has('AT')) {
    return 'Awareness and training';
  }
  if (/personnel|employee|contractor|background|termination|off-board|exit interview/.test(text) || prefixes.has('PS')) {
    return 'Personnel security';
  }
  if (/incident|spillage|ir plan|irp/.test(text) || prefixes.has('IR')) {
    return 'Incident response';
  }
  if (/contingency|backup|recovery|iscp/.test(text) || prefixes.has('CP')) {
    return 'Contingency / recovery';
  }
  if (/intrusion|network|traffic|load balancer|api whitelist|communications|encryption|cryptography/.test(text) || prefixes.has('SC')) {
    return 'System and communications protection';
  }
  if (/malicious|anti-virus|security functionality|alert notification|integrity/.test(text) || prefixes.has('SI')) {
    return 'System and information integrity';
  }
  return 'Other assessment evidence';
}

function redactForSummary(value) {
  return String(value || '')
    .replace(/https?:\/\/\S+/gi, '[url redacted]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?\b/g, '[ip redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email redacted]');
}

function normalizeWorkbookRows(parsed) {
  const rows = parsed.rows.filter((row) => row.some((cell) => cell !== null && String(cell).trim()));
  assert(rows.length >= 2, 'Workbook does not contain a header row and data rows.');
  const headers = rows[0].map((cell) => String(cell || '').trim());
  const expectedHeaders = ['Control(s)', 'Core Control', 'Request Item', 'Request Date', 'Received Date', 'Status', 'Point of Contact', 'Comment'];
  assert(
    expectedHeaders.every((header, index) => headers[index] === header),
    `Unexpected workbook headers: ${JSON.stringify(headers.slice(0, expectedHeaders.length))}`,
  );

  return rows.slice(1).map((row, index) => {
    const excelRow = index + 2;
    const controls = parseControls(row[0]);
    const requestItem = String(row[2] || '').trim();
    const requestDate = normalizeDate(row[3]);
    const receivedDate = normalizeDate(row[4]);
    const daysToReceive = daysBetween(requestDate, receivedDate);
    const pocRaw = String(row[6] || '').trim();
    const comment = row[7] === null || row[7] === undefined ? null : String(row[7]).trim() || null;
    const commentEvents = parseCommentEvents(comment);
    const evidenceType = inferEvidenceType(requestItem);
    const family = inferFamily(controls, requestItem);
    const dateQuality = !requestDate && !receivedDate
      ? 'missing_dates'
      : daysToReceive !== null && daysToReceive < 0
        ? 'received_before_requested'
        : 'ok';

    return {
      excelRow,
      controls,
      coreControl: String(row[1] || '').trim() === 'Core Control',
      requestItem,
      requestDate,
      receivedDate,
      daysToReceive,
      status: String(row[5] || '').trim(),
      pocRaw,
      pocNormalized: normalizePoc(pocRaw),
      comment,
      commentEvents,
      evidenceType,
      evidenceLockerType: evidenceLockerType(evidenceType, requestItem),
      family,
      dateQuality,
    };
  }).filter((row) => row.requestItem || row.controls.length > 0);
}

function mostCommon(values) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || '';
}

function buildSummary(rows, marker, workbookPath, workbookHash, sheetName) {
  const uniqueControls = new Set(rows.flatMap((row) => row.controls));
  const families = new Set(rows.map((row) => row.family));
  const evidenceTypes = new Set(rows.map((row) => row.evidenceType));
  const rowsWithComments = rows.filter((row) => row.comment).length;
  const coreRows = rows.filter((row) => row.coreControl).length;
  const dayValues = rows.map((row) => row.daysToReceive).filter((value) => value !== null);
  const sortedDays = [...dayValues].sort((a, b) => a - b);
  const average = dayValues.length
    ? Number((dayValues.reduce((sum, value) => sum + value, 0) / dayValues.length).toFixed(2))
    : null;
  return {
    marker,
    packageTitle: DEFAULT_PACKAGE_TITLE,
    workbookPath,
    workbookSha256: workbookHash,
    sheetName,
    rowCount: rows.length,
    coreControlRows: coreRows,
    rowsWithComments,
    uniqueControlRefs: uniqueControls.size,
    familyCount: families.size,
    evidenceTypeCount: evidenceTypes.size,
    statusCounts: Object.fromEntries([...new Set(rows.map((row) => row.status))].map((status) => [status, rows.filter((row) => row.status === status).length])),
    dateRange: {
      requested: [
        rows.map((row) => row.requestDate).filter(Boolean).sort()[0] || null,
        rows.map((row) => row.requestDate).filter(Boolean).sort().at(-1) || null,
      ],
      received: [
        rows.map((row) => row.receivedDate).filter(Boolean).sort()[0] || null,
        rows.map((row) => row.receivedDate).filter(Boolean).sort().at(-1) || null,
      ],
    },
    daysToReceive: {
      min: sortedDays[0] ?? null,
      median: sortedDays.length ? sortedDays[Math.floor(sortedDays.length / 2)] : null,
      mean: average,
      max: sortedDays.at(-1) ?? null,
    },
    familyCounts: countBy(rows, (row) => row.family),
    evidenceTypeCounts: countBy(rows, (row) => row.evidenceType),
    topControls: topCounts(rows.flatMap((row) => row.controls), 40),
    topOwners: topCounts(rows.map((row) => row.pocNormalized || row.pocRaw), 30),
    anomalies: rows
      .filter((row) => row.dateQuality !== 'ok')
      .map((row) => ({
        excelRow: row.excelRow,
        dateQuality: row.dateQuality,
        requestItem: row.requestItem,
        requestDate: row.requestDate,
        receivedDate: row.receivedDate,
        daysToReceive: row.daysToReceive,
      })),
  };
}

function countBy(rows, selector) {
  const counts = new Map();
  for (const row of rows) {
    const key = selector(row);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function topCounts(values, limit) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit));
}

function buildDataCallPayloads(rows, context) {
  return rows.map((row) => {
    const externalId = `econsys-fy20-fedramp-row-${String(row.excelRow).padStart(4, '0')}`;
    const requestedAt = row.requestDate || row.receivedDate || FALLBACK_DATE;
    const deliveryDate = row.receivedDate || null;
    const dueDate = row.receivedDate || row.requestDate || FALLBACK_DATE;
    const auditSummary = row.commentEvents.length
      ? row.commentEvents.map((event) => `${event.author}${event.dateLabel ? ` (${event.dateLabel})` : ''}: ${redactForSummary(event.text).slice(0, 240)}`).join('\n')
      : row.comment
        ? redactForSummary(row.comment).slice(0, 600)
        : 'No reviewer comment captured in the workbook.';

    return {
      sourceExternalId: externalId,
      body: {
        folderId: context.folderId,
        title: row.requestItem || `FedRAMP evidence request row ${row.excelRow}`,
        status: 'Closed',
        startOn: requestedAt,
        finishOn: deliveryDate || dueDate,
        dueOn: dueDate,
        reviewOn: deliveryDate || dueDate,
        data: {
          title: row.requestItem || `FedRAMP evidence request row ${row.excelRow}`,
          request_reference: `FY20-FEDRAMP-ROW-${String(row.excelRow).padStart(4, '0')}`,
          request_type: 'Evidence Collection',
          requested_by: 'SecureIT / 3PAO',
          requested_to: row.pocNormalized || row.pocRaw || 'Unassigned',
          owner: row.pocNormalized || row.pocRaw || 'Unassigned',
          requested_at: requestedAt,
          due_date: dueDate,
          assessment_or_matter: ASSESSMENT_MATTER,
          provided_to: 'SecureIT / 3PAO',
          delivery_method: 'Secure Transfer',
          delivery_date: deliveryDate,
          completion_percent: deliveryDate ? 100 : 0,
          status: 'Closed',
          evidence_count: deliveryDate ? 1 : 0,
          response_package_summary: `${row.evidenceType}; historical secure-file-share reference; ${row.controls.length} raw control/tag reference(s).`,
          audit_trail_summary: auditSummary,
          request_details: row.requestItem,
          importMarker: context.marker,
          assessmentEvidencePackage: true,
          packageTitle: DEFAULT_PACKAGE_TITLE,
          assessmentMatter: ASSESSMENT_MATTER,
          sourceWorkbook: path.basename(context.workbookPath),
          sourceSha256: context.workbookHash,
          sourceSheet: context.sheetName,
          sourceExcelRow: row.excelRow,
          sourceExternalId: externalId,
          coreControl: row.coreControl,
          rawStatus: row.status,
          controlRefs: row.controls,
          controlFamilies: [...new Set(row.controls.map(controlPrefix))],
          assessmentFamily: row.family,
          evidenceType: row.evidenceType,
          dateQuality: row.dateQuality,
          daysToReceive: row.daysToReceive,
          pocRaw: row.pocRaw,
          pocNormalized: row.pocNormalized,
          commentEvents: row.commentEvents,
          hasReviewerScrutiny: row.commentEvents.length > 0 || Boolean(row.comment),
        },
        links: [
          {
            relationType: 'assessment-evidence-package',
            targetType: 'package',
            targetId: context.marker,
            label: DEFAULT_PACKAGE_TITLE,
            route: `/assessment-evidence-packages/${encodeURIComponent(context.marker)}`,
          },
          ...row.controls.map((control) => ({
            relationType: 'control-ref',
            targetType: 'security-control',
            targetId: null,
            label: control,
            route: `/security-controls?q=${encodeURIComponent(control)}`,
          })),
        ],
        note: `Imported historical FedRAMP evidence request from ${path.basename(context.workbookPath)} row ${row.excelRow}.`,
      },
    };
  });
}

function buildEvidenceRollupPayloads(rows, context) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.family}||${row.evidenceType}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([key, groupRows]) => {
    const [family, evidenceType] = key.split('||');
    const controls = [...new Set(groupRows.flatMap((row) => row.controls))].sort();
    const receivedDates = groupRows.map((row) => row.receivedDate).filter(Boolean).sort();
    const sourceRows = groupRows.map((row) => row.excelRow).sort((a, b) => a - b);
    const title = `${DEFAULT_PACKAGE_TITLE}: ${family} - ${evidenceType}`;
    const externalId = `econsys-fy20-fedramp-rollup-${slugify(family)}-${slugify(evidenceType)}`;
    return {
      sourceExternalId: externalId,
      groupKey: key,
      body: {
        folderId: context.folderId,
        title,
        status: 'Accepted',
        reviewOn: receivedDates.at(-1) || FALLBACK_DATE,
        data: {
          title,
          evidence_owner: mostCommon(groupRows.map((row) => row.pocNormalized || row.pocRaw)) || 'Multiple owners',
          evidence_type: evidenceLockerType(evidenceType, groupRows[0]?.requestItem || ''),
          related_record: ASSESSMENT_MATTER,
          update_frequency: 'Ad Hoc',
          last_updated_on: receivedDates.at(-1) || null,
          mapped_control_summary: controls.join(', '),
          control_count: controls.length,
          file_count: 0,
          shared_service_scope: 'Historical FY20 FedRAMP secure-file-share evidence references; source files are not embedded in the workbook.',
          evidence_summary: `${groupRows.length} workbook request(s) rolled up for ${family}. Actual evidence files remain external historical secure-file-share artifacts.`,
          status: 'Accepted',
          importMarker: context.marker,
          assessmentEvidencePackage: true,
          packageTitle: DEFAULT_PACKAGE_TITLE,
          assessmentMatter: ASSESSMENT_MATTER,
          sourceWorkbook: path.basename(context.workbookPath),
          sourceSha256: context.workbookHash,
          sourceExternalId: externalId,
          assessmentFamily: family,
          evidenceType,
          controlRefs: controls,
          sourceExcelRows: sourceRows,
          dataCallExternalIds: sourceRows.map((rowNumber) => `econsys-fy20-fedramp-row-${String(rowNumber).padStart(4, '0')}`),
          historicalReferenceOnly: true,
        },
        links: [
          {
            relationType: 'assessment-evidence-package',
            targetType: 'package',
            targetId: context.marker,
            label: DEFAULT_PACKAGE_TITLE,
            route: `/assessment-evidence-packages/${encodeURIComponent(context.marker)}`,
          },
          ...controls.slice(0, 60).map((control) => ({
            relationType: 'control-ref',
            targetType: 'security-control',
            targetId: null,
            label: control,
            route: `/security-controls?q=${encodeURIComponent(control)}`,
          })),
        ],
        note: `Imported historical FedRAMP evidence rollup for ${family} / ${evidenceType}.`,
      },
    };
  });
}

function buildAssessmentPlanPayload(rows, context) {
  const questions = rows.map((row) => ({
    id: `fy20-fedramp-row-${String(row.excelRow).padStart(4, '0')}`,
    ref: `FY20-${String(row.excelRow).padStart(4, '0')}`,
    prompt: row.requestItem || `FedRAMP evidence request row ${row.excelRow}`,
    type: 'file-upload',
    section: row.family,
    required: row.coreControl,
    weight: row.coreControl ? 2 : 1,
    maxScore: 1,
    requirementRef: row.controls.join(', '),
    evidenceHint: [
      `Historical source row: ${row.excelRow}`,
      `Expected evidence type: ${row.evidenceType}`,
      `Original POC: ${row.pocNormalized || row.pocRaw || 'Unassigned'}`,
      row.commentEvents.length ? `Reviewer scrutiny events: ${row.commentEvents.length}` : 'No reviewer comment captured.',
    ].join(' | '),
    enableUpload: true,
  }));

  return {
    template: {
      name: `${DEFAULT_PACKAGE_TITLE} Reusable FedRAMP Evidence Plan`,
      description:
        'Reusable FedRAMP evidence scrutiny plan generated from the historical FY20 secure-file-share tracker.',
      status: 'active',
      templateKind: 'assessment-plan',
      scoringMode: 'boolean',
      audience: 'FedHR assessors and evidence owners',
      sourceFramework: 'FedRAMP FY20 historical package',
      usageNotes: `Generated from import marker ${context.marker}; use as a starting point for future FedRAMP evidence collection and assessor scrutiny.`,
      relatedWorkflow: 'FedRAMP assessment evidence scrutiny',
      attestationScope: 'FedHR historical FY20 FedRAMP evidence request package',
      evidenceCollectionMode: 'Evidence requests with reviewer sufficiency comments and historical secure-file-share references.',
      fileUploadGuidance: 'Attach current-cycle evidence files when reusing this template. Historical FY20 files are not embedded in the source workbook.',
      exportMode: 'Assessment plan and evidence request matrix',
      distributionCadence: 'Per assessment cycle',
      profile: 'FedRAMP Evidence Scrutiny',
      instructions:
        'Use each line of inquiry to request evidence, track owner response, capture reviewer sufficiency comments, and link accepted evidence artifacts.',
      enableScoring: true,
      enableQuestionAssignment: true,
      questions,
    },
    rules: [
      {
        id: 'fy20-fedramp-display-score',
        name: 'Display evidence scrutiny score',
        description: 'Always expose scoring metadata when this historical plan is reused.',
        logic: 'AND',
        active: true,
        conditions: ['SYSTEM.NO_CONDITION'],
        actions: ['SET_DISPLAY_OPTIONS(displayscore=true,displaygrade=true)'],
      },
    ],
  };
}

function validateSummary(summary) {
  const expected = [
    ['rowCount', summary.rowCount, 301],
    ['coreControlRows', summary.coreControlRows, 186],
    ['rowsWithComments', summary.rowsWithComments, 220],
    ['uniqueControlRefs', summary.uniqueControlRefs, 257],
    ['familyCount', summary.familyCount, 14],
  ];
  const failures = expected.filter(([, actual, expectedValue]) => actual !== expectedValue);
  if (failures.length > 0) {
    throw new Error(
      `Workbook validation failed: ${failures.map(([key, actual, expectedValue]) => `${key}=${actual}, expected ${expectedValue}`).join('; ')}`,
    );
  }
  assert(summary.statusCounts.Locked === 301, 'Expected all workbook rows to be Locked.');
  assert(
    summary.anomalies.some((item) => item.excelRow === 200 && item.dateQuality === 'received_before_requested'),
    'Expected row 200 received-before-requested anomaly.',
  );
  assert(
    summary.anomalies.some((item) => item.excelRow === 230 && item.dateQuality === 'missing_dates'),
    'Expected row 230 missing-dates anomaly.',
  );
}

async function buildPackage(args) {
  const workbookPath = path.resolve(args.workbook);
  const workbookBuffer = await fs.readFile(workbookPath);
  const workbookHash = crypto.createHash('sha256').update(workbookBuffer).digest('hex');
  const parsed = parseWorkbookWithPython(workbookPath);
  const rows = normalizeWorkbookRows(parsed);
  const summary = buildSummary(rows, args.marker, workbookPath, workbookHash, parsed.sheetName);
  validateSummary(summary);
  const context = {
    marker: args.marker,
    workbookPath,
    workbookHash,
    sheetName: parsed.sheetName,
    folderId: '__FOLDER_ID__',
  };
  const dataCalls = buildDataCallPayloads(rows, context);
  const evidenceRollups = buildEvidenceRollupPayloads(rows, context);
  const assessmentPlan = buildAssessmentPlanPayload(rows, context);
  return {
    summary,
    records: rows,
    payloads: {
      dataCalls,
      evidenceRollups,
      assessmentPlan,
    },
  };
}

function requireProductionGuards(args) {
  assert(args.baseUrl === 'https://regovise.com', 'REGOVISE_PROD_BASE_URL must be exactly https://regovise.com for apply/cleanup.');
  assert(args.tenantSlug === DEFAULT_TENANT_SLUG, 'REGOVISE_VERIFY_TENANT_SLUG must be fedhr.');
  assert(args.adminEmail, 'REGOVISE_VERIFY_EMAIL is required.');
  assert(args.bootstrapSecret, 'BOOTSTRAP_SETUP_SECRET is required.');
  assert(process.env.FEDHR_FEDRAMP_IMPORT_ALLOW_MUTATIONS === '1', 'FEDHR_FEDRAMP_IMPORT_ALLOW_MUTATIONS=1 is required.');
  assert(process.env.LIVE_VALIDATION_ALLOW_MUTATIONS === '1', 'LIVE_VALIDATION_ALLOW_MUTATIONS=1 is required.');
}

async function requestJson(baseUrl, pathName, options = {}) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    redirect: 'follow',
    ...options,
    headers: {
      accept: 'application/json,*/*',
      'user-agent': USER_AGENT,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${pathName} failed (${response.status}): ${text.slice(0, 800)}`);
  }
  return { response, payload };
}

async function bootstrapSession(args) {
  const { response, payload } = await requestJson(args.baseUrl, '/_api/core/bootstrap/admin-session', {
    method: 'POST',
    body: JSON.stringify({
      secret: args.bootstrapSecret,
      tenantSlug: args.tenantSlug,
      email: args.adminEmail,
    }),
  });
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0] || '';
  assert(cookie, 'Bootstrap admin session did not return a session cookie.');
  assert(payload?.data?.tenantSlug === args.tenantSlug, `Bootstrap returned unexpected tenant slug: ${payload?.data?.tenantSlug}`);
  return cookie;
}

async function ensurePackageFolder(args, cookie) {
  const foldersPayload = await requestJson(args.baseUrl, '/_api/iam/folders', { headers: { cookie } });
  const folders = foldersPayload.payload?.data || [];
  const existing = folders.find((folder) => folder.name === args.folderName);
  if (existing) return existing.id;
  const root = folders.find((folder) => folder.contentType === 'root') || folders.find((folder) => !folder.parentFolderId);
  const created = await requestJson(args.baseUrl, '/_api/iam/folders', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      name: args.folderName,
      description: 'Historical FedRAMP FY20 assessment evidence package imported from secure-file-share workbook.',
      contentType: 'domain',
      parentFolderId: root?.id || null,
    }),
  });
  return created.payload?.data?.id;
}

function normalizeLookupText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9@.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractEmails(value) {
  return [...String(value || '').matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)]
    .map((match) => match[0].toLowerCase());
}

async function loadTenantUsers(args, cookie) {
  const payload = await requestJson(args.baseUrl, '/_api/iam/users', { headers: { cookie } });
  return (payload.payload?.data || []).map((user) => ({
    id: user.id,
    email: String(user.email || '').toLowerCase(),
    displayName: String(user.displayName || user.email || '').trim(),
    lookupName: normalizeLookupText(user.displayName || user.email || ''),
    lookupLocalPart: normalizeLookupText(String(user.email || '').split('@', 1)[0]),
  })).filter((user) => user.id && user.email);
}

function matchOwnerUser(users, ownerText) {
  const raw = String(ownerText || '').trim();
  if (!raw) return null;

  const ownerEmails = extractEmails(raw);
  for (const email of ownerEmails) {
    const match = users.find((user) => user.email === email);
    if (match) return match;
  }

  const ownerParts = raw
    .split(/\s*;\s*|\s*,\s*|\n+/)
    .map(normalizeLookupText)
    .filter(Boolean);
  const ownerLookups = ownerParts.length ? ownerParts : [normalizeLookupText(raw)].filter(Boolean);

  for (const ownerLookup of ownerLookups) {
    const exact = users.find((user) => user.lookupName === ownerLookup || user.lookupLocalPart === ownerLookup);
    if (exact) return exact;
  }

  for (const ownerLookup of ownerLookups) {
    const ownerTokens = new Set(ownerLookup.split(' ').filter(Boolean));
    if (ownerTokens.size === 0) continue;
    const wholeTokenMatch = users.find((user) => {
      const nameTokens = new Set(user.lookupName.split(' ').filter(Boolean));
      return [...ownerTokens].every((token) => nameTokens.has(token));
    });
    if (wholeTokenMatch) return wholeTokenMatch;
  }

  return null;
}

function attachMatchedOwners(dataCalls, users) {
  return dataCalls.map((payload) => {
    const ownerText = payload.body.data?.pocNormalized || payload.body.data?.pocRaw || payload.body.data?.owner || '';
    const matchedUser = matchOwnerUser(users, ownerText);
    if (!matchedUser) {
      return payload;
    }
    return {
      ...payload,
      body: {
        ...payload.body,
        ownerUserId: matchedUser.id,
        data: {
          ...payload.body.data,
          matchedOwnerUserId: matchedUser.id,
          matchedOwnerEmail: matchedUser.email,
          matchedOwnerDisplayName: matchedUser.displayName,
        },
      },
    };
  });
}

async function listExistingModuleRecords(args, cookie, moduleKey, marker) {
  const payload = await requestJson(
    args.baseUrl,
    `/_api/core/modules/${moduleKey}/records?q=${encodeURIComponent(marker)}&includeArchived=true`,
    { headers: { cookie } },
  );
  const records = payload.payload?.data?.records || [];
  return new Map(records.map((record) => [record.data?.sourceExternalId, record]).filter(([key]) => key));
}

function withFolder(payloads, folderId) {
  return payloads.map((payload) => ({
    ...payload,
    body: {
      ...payload.body,
      folderId,
    },
  }));
}

async function upsertModulePayloads(args, cookie, moduleKey, marker, payloads) {
  const existing = await listExistingModuleRecords(args, cookie, moduleKey, marker);
  const result = { created: 0, updated: 0 };
  for (const payload of payloads) {
    const current = existing.get(payload.sourceExternalId);
    if (current?.id) {
      await requestJson(args.baseUrl, `/_api/core/modules/${moduleKey}/records/${current.id}`, {
        method: 'POST',
        headers: { cookie },
        body: JSON.stringify(payload.body),
      });
      result.updated += 1;
    } else {
      await requestJson(args.baseUrl, `/_api/core/modules/${moduleKey}/records`, {
        method: 'POST',
        headers: { cookie },
        body: JSON.stringify(payload.body),
      });
      result.created += 1;
    }
  }
  return result;
}

async function upsertAssessmentPlan(args, cookie, assessmentPlan, marker) {
  const listPayload = await requestJson(args.baseUrl, '/_api/builders/questionnaires', { headers: { cookie } });
  const existing = (listPayload.payload?.data?.templates || []).find(
    (template) => template.templateKind === 'assessment-plan' && template.name === assessmentPlan.template.name,
  );
  if (existing?.id) {
    await requestJson(args.baseUrl, `/_api/builders/questionnaires/${existing.id}`, {
      method: 'PUT',
      headers: { cookie },
      body: JSON.stringify({
        ...assessmentPlan.template,
        status: assessmentPlan.template.status,
      }),
    });
    await requestJson(args.baseUrl, `/_api/builders/questionnaires/${existing.id}/rules`, {
      method: 'PUT',
      headers: { cookie },
      body: JSON.stringify({
        name: `${marker} rule set`,
        rules: assessmentPlan.rules,
      }),
    });
    return { created: 0, updated: 1, id: existing.id };
  }
  const created = await requestJson(args.baseUrl, '/_api/builders/questionnaires/import', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify(assessmentPlan),
  });
  return { created: 1, updated: 0, id: created.payload?.data?.template?.id || null };
}

async function cleanupMarker(args, cookie, marker) {
  const cleanup = { dataCallsArchived: 0, evidenceRollupsArchived: 0, templatesDeleted: 0 };
  for (const moduleKey of ['data-calls', 'evidence-locker']) {
    const existing = await listExistingModuleRecords(args, cookie, moduleKey, marker);
    for (const record of existing.values()) {
      if (!record.archived) {
        await requestJson(args.baseUrl, `/_api/core/modules/${moduleKey}/records/${record.id}/archive`, {
          method: 'POST',
          headers: { cookie },
        });
        if (moduleKey === 'data-calls') cleanup.dataCallsArchived += 1;
        else cleanup.evidenceRollupsArchived += 1;
      }
    }
  }
  const listPayload = await requestJson(args.baseUrl, '/_api/builders/questionnaires', { headers: { cookie } });
  const templates = listPayload.payload?.data?.templates || [];
  for (const template of templates) {
    if (template.name?.includes(DEFAULT_PACKAGE_TITLE) || template.usageNotes?.includes(marker)) {
      await requestJson(args.baseUrl, `/_api/builders/questionnaires/${template.id}`, {
        method: 'DELETE',
        headers: { cookie },
      });
      cleanup.templatesDeleted += 1;
    }
  }
  return cleanup;
}

async function writeDryRunOutput(args, packageData) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.resolve(args.outputRoot, `fedhr-fedramp-assessment-import-${stamp}`);
  await fs.mkdir(outputDir, { recursive: true });
  const preview = {
    summary: packageData.summary,
    payloadPreview: {
      dataCalls: packageData.payloads.dataCalls.slice(0, 8),
      evidenceRollups: packageData.payloads.evidenceRollups.slice(0, 8),
      assessmentPlan: {
        template: {
          ...packageData.payloads.assessmentPlan.template,
          questions: packageData.payloads.assessmentPlan.template.questions.slice(0, 12),
        },
        rules: packageData.payloads.assessmentPlan.rules,
      },
    },
  };
  await fs.writeFile(path.join(outputDir, 'summary.json'), JSON.stringify(packageData.summary, null, 2));
  await fs.writeFile(path.join(outputDir, 'payload-preview.json'), JSON.stringify(preview, null, 2));
  await fs.writeFile(
    path.join(outputDir, 'payload-full.json'),
    JSON.stringify(
      {
        summary: packageData.summary,
        payloads: packageData.payloads,
      },
      null,
      2,
    ),
  );
  return outputDir;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === 'cleanup') {
    requireProductionGuards(args);
    const cookie = await bootstrapSession(args);
    const cleanup = await cleanupMarker(args, cookie, args.marker);
    console.log(JSON.stringify({ mode: 'cleanup', marker: args.marker, cleanup }, null, 2));
    return;
  }

  const packageData = await buildPackage(args);
  const outputDir = await writeDryRunOutput(args, packageData);

  if (args.mode === 'dry-run') {
    const result = {
      mode: 'dry-run',
      outputDir,
      summary: packageData.summary,
      payloadCounts: {
        dataCalls: packageData.payloads.dataCalls.length,
        evidenceRollups: packageData.payloads.evidenceRollups.length,
        assessmentPlanQuestions: packageData.payloads.assessmentPlan.template.questions.length,
      },
    };
    console.log(args.json ? JSON.stringify(result) : JSON.stringify(result, null, 2));
    return;
  }

  requireProductionGuards(args);
  const cookie = await bootstrapSession(args);
  const folderId = await ensurePackageFolder(args, cookie);
  assert(folderId, 'Unable to resolve or create the FedHR package folder.');
  const users = await loadTenantUsers(args, cookie);
  const dataCalls = attachMatchedOwners(withFolder(packageData.payloads.dataCalls, folderId), users);
  const evidenceRollups = withFolder(packageData.payloads.evidenceRollups, folderId);
  const dataCallResult = await upsertModulePayloads(args, cookie, 'data-calls', args.marker, dataCalls);
  const evidenceResult = await upsertModulePayloads(args, cookie, 'evidence-locker', args.marker, evidenceRollups);
  const templateResult = await upsertAssessmentPlan(args, cookie, packageData.payloads.assessmentPlan, args.marker);
  const verification = await requestJson(args.baseUrl, `/_api/core/assessment-evidence-packages/${encodeURIComponent(args.marker)}`, {
    headers: { cookie },
  });
  const result = {
    mode: 'apply',
    outputDir,
    folderId,
    dataCalls: dataCallResult,
    evidenceRollups: evidenceResult,
    assessmentPlan: templateResult,
    packageVerification: verification.payload?.data?.summary || null,
  };
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
