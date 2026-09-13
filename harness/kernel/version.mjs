/** Harness identity: versions for long-term reproducibility (P1-7). */

import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pkg = require(path.join(__dirname, '..', 'package.json'));

export const HARNESS_VERSION = pkg.version ?? '0.0.0';
export const NODE_VERSION = process.version;

let _gitCommit;
export function gitCommit() {
  if (_gitCommit !== undefined) return _gitCommit;
  try {
    _gitCommit = execSync('git rev-parse HEAD', {
      cwd: path.resolve(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    _gitCommit = null; // git is optional; never required to run
  }
  return _gitCommit;
}
