import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { root, canonicalRoots, sourceFiles, sha256 } from '../lib/repository.mjs';
export async function checkSourcePolicy(repo = root) {
  const failures = [];
  for (const required of ['AGENTS.md', 'README.md', 'ARCHITECTURE.md', 'apps/web/README.md', 'cloudflare/README.md', 'ops/README.md', 'ops/quality/README.md', 'ops/local/README.md', 'documentation/engineering/developer-guide.md', 'package-lock.json', 'apps/web/package-lock.json', 'cloudflare/package-lock.json']) {
    try { await fs.access(path.join(repo, required)); } catch { failures.push(`Required authority/lockfile missing: ${required}`); }
  }
  const policy = JSON.parse(await fs.readFile(path.join(repo, 'ops/quality/source-policy.json'), 'utf8'));
  const exceptions = new Map(policy.javascriptExceptions.map((entry) => [entry.path, entry]));
  let checked = 0;
  for (const sourceRoot of canonicalRoots) {
    for (const file of await sourceFiles(sourceRoot, undefined, repo)) {
      checked++;
      const source = await fs.readFile(path.join(repo, file), 'utf8');
      if (/\.(?:m?js)$/.test(file)) {
        const exception = exceptions.get(file);
        if (!exception?.reason || !exception?.sha256) failures.push(`Unclassified runtime JavaScript: ${file}`);
        else if (sha256(source) !== exception.sha256) failures.push(`Bundled runtime changed without provenance review: ${file}`);
        exceptions.delete(file);
      }
      if (file.startsWith('apps/web/') && /(?:from|import\s*\()\s*['"][^'"]*(?:cloudflare\/src|backend\/)[^'"]*['"]/.test(source)) failures.push(`Browser imports server implementation: ${file}`);
      if (file.startsWith('cloudflare/') && /(?:from|import\s*\()\s*['"][^'"]*(?:apps\/web\/src|react-dom)[^'"]*['"]/.test(source)) failures.push(`Worker imports browser implementation: ${file}`);
    }
  }
  for (const file of exceptions.keys()) failures.push(`Stale JavaScript exception: ${file}`);
  return { checkedModules: checked, failures, authority: 'Canonical app/Worker plus preserved legacy/reference sources', javascriptPolicy: 'TypeScript runtime, reviewed hash-bound bundled exception' };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await checkSourcePolicy();
  console.log(JSON.stringify(result, null, 2));
  if (result.failures.length) process.exitCode = 1;
}
