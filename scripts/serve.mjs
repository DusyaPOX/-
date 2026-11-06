import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const port = Number(portArg >= 0 ? args[portArg + 1] : process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    // Serve only the public lesson assets, never .git or project internals.
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const allowed = ['index.html', 'styles.css', 'app.js', 'lesson-model.js', 'assets/favicon.svg', 'lecture-02.html', 'lecture-02.css', 'lecture-02.js', 'lecture-02-model.js'];
    if (!allowed.includes(relative)) { res.writeHead(404); res.end('Not found'); return; }
    const file = path.join(root, relative);
    if (!(await stat(file)).isFile()) throw new Error('Not a file');
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => process.stdout.write(`Лекция доступна: http://127.0.0.1:${port}\n`));
server.on('error', error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
