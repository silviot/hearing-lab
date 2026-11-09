// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Hearing Lab contributors
import { lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { gzipSync } from 'node:zlib';

// Keep this explicit: runtime state, local QA files, and build output never enter
// the corresponding-source download. Add new source roots here deliberately.
export const SOURCE_FILES = [
  '.gitignore', 'package.json', 'index.html', 'README.md', 'LICENSE',
  'CONTRIBUTING.md', 'THIRD_PARTY_NOTICES.md',
];
export const SOURCE_DIRECTORIES = ['src', 'public', 'tests', 'scripts', 'docs', '.github/workflows'];
export const SOURCE_ARCHIVE = 'hearing-lab-source.tar.gz';

function writeText(buffer, offset, width, value) {
  const encoded = Buffer.from(value, 'utf8');
  if (encoded.length > width) throw new Error(`USTAR field is too long: ${value}`);
  encoded.copy(buffer, offset);
}

function writeOctal(buffer, offset, width, value) {
  const encoded = value.toString(8);
  if (!Number.isSafeInteger(value) || value < 0 || encoded.length > width - 1) {
    throw new Error(`USTAR number is out of range: ${value}`);
  }
  writeText(buffer, offset, width, `${encoded.padStart(width - 1, '0')}\0`);
}

function tarHeader(path, size) {
  const header = Buffer.alloc(512);
  let name = path;
  let prefix = '';
  if (Buffer.byteLength(path) > 100) {
    let separator = path.lastIndexOf('/');
    while (separator > 0) {
      const candidatePrefix = path.slice(0, separator);
      const candidateName = path.slice(separator + 1);
      if (Buffer.byteLength(candidatePrefix) <= 155 && Buffer.byteLength(candidateName) <= 100) {
        prefix = candidatePrefix;
        name = candidateName;
        break;
      }
      separator = path.lastIndexOf('/', separator - 1);
    }
    if (!prefix) throw new Error(`Source path is too long for USTAR: ${path}`);
  }
  writeText(header, 0, 100, name);
  writeOctal(header, 100, 8, 0o644);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, 0); // Deterministic timestamp, independent of checkout time.
  header.fill(0x20, 148, 156);
  writeText(header, 156, 1, '0');
  writeText(header, 257, 6, 'ustar\0');
  writeText(header, 263, 2, '00');
  writeText(header, 345, 155, prefix);
  const checksum = header.reduce((sum, value) => sum + value, 0);
  writeText(header, 148, 8, `${checksum.toString(8).padStart(6, '0')}\0 `);
  return header;
}

export async function writeSourceArchive(root, output) {
  const entries = [];
  async function collect(relativePath, optional = false) {
    const absolutePath = join(root, relativePath);
    let info;
    try { info = await lstat(absolutePath); }
    catch (error) { if (optional && error.code === 'ENOENT') return; throw error; }
    if (info.isSymbolicLink()) throw new Error(`Source archives do not follow symlinks: ${relativePath}`);
    if (info.isDirectory()) {
      for (const child of (await readdir(absolutePath)).sort()) {
        if (child.startsWith('.')) throw new Error(`Unexpected hidden source entry: ${relativePath}/${child}`);
        await collect(posix.join(relativePath, child));
      }
    } else if (info.isFile()) entries.push(relativePath);
    else throw new Error(`Unsupported source entry: ${relativePath}`);
  }
  for (const path of SOURCE_FILES) await collect(path, path === '.gitignore');
  for (const path of SOURCE_DIRECTORIES) await collect(path);
  entries.sort();
  const blocks = [];
  for (const path of entries) {
    const body = await readFile(join(root, path));
    blocks.push(tarHeader(`hearing-lab/${path}`, body.length), body);
    const remainder = body.length % 512;
    if (remainder) blocks.push(Buffer.alloc(512 - remainder));
  }
  blocks.push(Buffer.alloc(1024));
  const archive = gzipSync(Buffer.concat(blocks), { level: 9 });
  await writeFile(output, archive);
  return { files: entries.length, bytes: archive.length };
}
