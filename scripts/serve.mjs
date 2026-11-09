// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Hearing Lab contributors
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const options = { port: process.env.PORT ?? '4173', host: process.env.HOST ?? '0.0.0.0', dist: false };
const args = process.argv.slice(2);
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--dist') options.dist = true;
  else if (arg === '--strictPort') { /* Node's server.listen already fails on a busy port. */ }
  else if (arg === '--port' || arg === '--host') {
    if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing value for ${arg}`);
    options[arg.slice(2)] = args[++index];
  } else if (arg.startsWith('--port=')) options.port = arg.slice(7);
  else if (arg.startsWith('--host=')) options.host = arg.slice(7);
  else if (arg === '--help' || arg === '-h') {
    console.log('Usage: node scripts/serve.mjs [--dist] [--port 4173] [--host 0.0.0.0] [--strictPort]\nPORT and HOST environment variables are also supported.');
    process.exit(0);
  } else throw new Error(`Unknown argument: ${arg}`);
}
const port = Number(options.port);
if (!/^\d+$/.test(String(options.port)) || !Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error('PORT/--port must be an integer between 0 and 65535.');
}
if (!options.host) throw new Error('HOST/--host must not be empty.');

const root = await realpath(options.dist ? resolve(projectRoot, 'dist') : projectRoot).catch(() => {
  throw new Error('The dist directory does not exist. Run npm run build first.');
});
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip',
};

function withinRoot(path) {
  const part = relative(root, path);
  return part === '' || (!part.startsWith(`..${sep}`) && part !== '..' && !isAbsolute(part));
}

function reply(response, status, message, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  response.end(message);
}

const server = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'same-origin');
  response.setHeader('Cache-Control', options.dist ? 'no-cache' : 'no-store');
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    reply(response, 405, 'Method not allowed\n', { Allow: 'GET, HEAD' });
    return;
  }

  let pathname;
  try {
    // Decode before resolving: URL() would normalize away traversal segments.
    pathname = decodeURIComponent((request.url ?? '/').split(/[?#]/, 1)[0]);
  } catch {
    reply(response, 400, 'Malformed request path\n');
    return;
  }
  const parts = pathname.split('/');
  if (!pathname.startsWith('/') || pathname.includes('\\') || pathname.includes('\0') || parts.some(part => part.startsWith('.'))) {
    reply(response, 403, 'Forbidden\n');
    return;
  }

  try {
    // The source-mode UI offers the same archive path as a built deployment.
    // Build it explicitly with npm run build; no per-request filesystem writes.
    const sourceDownload = !options.dist && pathname === '/hearing-lab-source.tar.gz';
    let file = sourceDownload ? resolve(root, 'dist', 'hearing-lab-source.tar.gz') : resolve(root, `.${pathname}`);
    if (!withinRoot(file)) {
      reply(response, 403, 'Forbidden\n');
      return;
    }
    file = await realpath(file);
    if (!withinRoot(file)) {
      reply(response, 403, 'Forbidden\n');
      return;
    }
    let info = await stat(file);
    if (info.isDirectory()) {
      if (!pathname.endsWith('/')) {
        const query = (request.url ?? '').includes('?') ? `?${(request.url ?? '').split('?').slice(1).join('?')}` : '';
        response.writeHead(308, { Location: `${encodeURI(pathname).replace(/^\/{2,}/, '/')}/${query}` });
        response.end();
        return;
      }
      file = await realpath(resolve(file, 'index.html'));
      if (!withinRoot(file)) {
        reply(response, 403, 'Forbidden\n');
        return;
      }
      info = await stat(file);
    }
    if (!info.isFile()) {
      reply(response, 404, 'Not found\n');
      return;
    }
    const type = mime[extname(file).toLowerCase()] ?? (file.endsWith(`${sep}LICENSE`) ? 'text/plain; charset=utf-8' : 'application/octet-stream');
    response.writeHead(200, { 'Content-Type': type, 'Content-Length': info.size });
    if (request.method === 'HEAD') response.end();
    else createReadStream(file).on('error', () => response.destroy()).pipe(response);
  } catch (error) {
    if (!response.headersSent) reply(response, error.code === 'EACCES' ? 403 : 404, 'Not found\n');
    else response.destroy();
  }
});

server.on('error', error => {
  console.error(`Could not start Hearing Lab: ${error.message}`);
  process.exitCode = 1;
});
server.listen(port, options.host, () => {
  const address = server.address();
  const localHost = options.host === '0.0.0.0' || options.host === '::' ? 'localhost' : options.host;
  const hostLabel = localHost.includes(':') ? `[${localHost}]` : localHost;
  console.log(`Hearing Lab: http://${hostLabel}:${address.port} (${options.dist ? 'dist' : 'source'})`);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
