import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const devVarsPath = path.join(cwd, '.dev.vars');
const prodEnvPath = path.join(cwd, '.env-prod');
const managedKeys = ['BOOTSTRAP_SETUP_SECRET'];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const values = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key) {
      values[key] = value;
    }
  }
  return values;
}

const currentDevVars = parseEnvFile(devVarsPath);
const prodEnvVars = parseEnvFile(prodEnvPath);

let changed = false;
for (const key of managedKeys) {
  if (!currentDevVars[key] && prodEnvVars[key]) {
    currentDevVars[key] = prodEnvVars[key];
    changed = true;
  }
}

if (!changed) {
  console.log('local-dev-vars: ready');
  process.exit(0);
}

const output = `${managedKeys
  .filter((key) => currentDevVars[key])
  .map((key) => `${key}=${currentDevVars[key]}`)
  .join('\n')}\n`;

fs.writeFileSync(devVarsPath, output, { mode: 0o600 });
console.log('local-dev-vars: updated .dev.vars');
