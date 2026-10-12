import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const canonicalRoots = ['apps/web/src', 'cloudflare/src'];
const excluded = new Set(['node_modules', 'dist', '.git', '.wrangler', 'prototype-dist']);
export async function sourceFiles(directory, extensions = ['.ts', '.tsx', '.mts', '.js', '.mjs'], repo = root) {
  const output = [];
  async function walk(relative) {
    for (const entry of await fs.readdir(path.join(repo, relative), { withFileTypes: true })) {
      const next = path.posix.join(relative, entry.name);
      if (entry.isDirectory() && !excluded.has(entry.name)) await walk(next);
      else if (entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension))) output.push(next);
    }
  }
  await walk(directory);
  return output.sort();
}
export function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
export async function sourceFingerprint(repo = root) {
  const runtimeExtensions = ['.ts', '.tsx', '.mts', '.js', '.mjs', '.css', '.json'];
  const configs = ['package.json', 'package-lock.json', '.nvmrc', '.node-version', '.editorconfig', 'apps/web/package.json', 'apps/web/package-lock.json', 'apps/web/index.html', 'apps/web/postcss.config.cjs', 'apps/web/tailwind.config.ts', 'apps/web/vite.config.ts', 'apps/web/tsconfig.json', 'cloudflare/package.json', 'cloudflare/package-lock.json', 'cloudflare/wrangler.toml', 'cloudflare/tsconfig.json'];
  const files = [...(await sourceFiles('apps/web/src', runtimeExtensions, repo)), ...(await sourceFiles('cloudflare/src', runtimeExtensions, repo)), ...(await sourceFiles('cloudflare/migrations', ['.sql'], repo)), ...(await sourceFiles('cloudflare/scripts', ['.mjs', '.sh'], repo)), ...(await sourceFiles('apps/web/scripts', ['.mjs'], repo)), ...(await sourceFiles('.github/workflows', ['.yml', '.yaml'], repo)), ...(await sourceFiles('ops', ['.mjs', '.json'], repo)), ...configs].sort();
  const hash = createHash('sha256');
  for (const file of files) { hash.update(file); hash.update('\0'); hash.update(await fs.readFile(path.join(repo, file))); hash.update('\0'); }
  return hash.digest('hex');
}
export function revision() { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); }
export async function writeJson(file, payload) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`); }
