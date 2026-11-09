// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Hearing Lab contributors
import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCE_ARCHIVE, writeSourceArchive } from './archive.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');
const required = ['index.html', 'src', 'public', 'LICENSE'];
for (const entry of required) await stat(join(root, entry));
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const entry of [...required, 'README.md', 'CONTRIBUTING.md', 'THIRD_PARTY_NOTICES.md', 'docs']) {
  await cp(join(root, entry), join(output, entry), { recursive: true, errorOnExist: true });
}
await writeFile(join(output, '.nojekyll'), '');
const source = await writeSourceArchive(root, join(output, SOURCE_ARCHIVE));

async function inventory(directory) {
  let files = 0;
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      const child = await inventory(path);
      files += child.files;
      bytes += child.bytes;
    } else {
      files += 1;
      bytes += (await stat(path)).size;
    }
  }
  return { files, bytes };
}
const result = await inventory(output);
console.log(`Built dist/: ${result.files} files, ${(result.bytes / 1024).toFixed(1)} KiB. No bundler or network access required.`);
console.log(`Included ${SOURCE_ARCHIVE}: ${source.files} source files, ${(source.bytes / 1024).toFixed(1)} KiB.`);
