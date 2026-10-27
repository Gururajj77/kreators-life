// The Agent Reach bridge: a small HTTP server that runs `agent-reach` for the Worker.
//
// Agent Reach (github.com/Panniantong/agent-reach) is a read-only command-line tool that reaches
// YouTube, the web, X, Instagram, Reddit and more. It runs on a machine, not inside Cloudflare, so the
// Worker asks this bridge. Run it where agent-reach is installed (the install note is in that repo's
// docs/install.md), then point the Worker at it:
//
//   REACH_KEY=<a long random string> node scripts/reach/server.mjs            # listens on 8790
//   REACH_PORT=8790 REACH_BIN=/path/to/agent-reach ...                        # optional
//
// and set REACH_URL=http://<host>:8790 and REACH_KEY on the Worker (apps/api/.dev.vars locally,
// `pnpm cf:secret REACH_URL` and `pnpm cf:secret REACH_KEY` in production). For a Mac at home, a
// Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:8790`) gives it a public address.
//
// Requests: POST /run {channel, action, params} -> the agent-reach JSON line as it is.
// GET /health answers {ok:true}. Every request needs `Authorization: Bearer <REACH_KEY>`.
// The bridge never posts, likes or logs in: agent-reach is read-only, and so is this.
import { spawn } from 'node:child_process';
import http from 'node:http';

const PORT = Number(process.env.REACH_PORT) || 8790;
const KEY = process.env.REACH_KEY ?? '';
const BIN = process.env.REACH_BIN ?? 'agent-reach';
const TIMEOUT = Number(process.env.REACH_TIMEOUT) || 110_000;
const CHANNELS = new Set(['web', 'youtube', 'twitter', 'instagram', 'reddit', 'github', 'bilibili', 'v2ex', 'xiaohongshu', 'linkedin', 'facebook']);
const SAFE = /^[\w .,:/?&=%#@+'"!()\-À-￿-]{1,500}$/u;

if (!KEY) {
  console.error('Set REACH_KEY to a long random string before starting the bridge.');
  process.exit(1);
}

function run(args) {
  return new Promise((resolve) => {
    const child = spawn(BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let errOut = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (errOut += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ ok: false, items: [], error: { code: 'NEED_SETUP', message: e.message, hint: `Is ${BIN} installed and on the PATH?` } });
    });
    child.on('close', () => {
      clearTimeout(timer);
      // agent-reach prints one JSON line; take the last line that parses.
      const lines = out.trim().split('\n').reverse();
      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json && typeof json === 'object') return resolve(json);
        } catch {
          // not this line
        }
      }
      resolve({ ok: false, items: [], error: { code: 'UPSTREAM_BROKEN', message: (errOut || out).trim().slice(0, 400) || 'no output' } });
    });
  });
}

function body(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (d) => {
      data += d;
      if (data.length > 20_000) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

const send = (res, status, json) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(json));
};

http
  .createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true, bin: BIN });
    if ((req.headers.authorization ?? '') !== `Bearer ${KEY}`) return send(res, 401, { ok: false, error: { code: 'UNAUTHORIZED' } });
    if (req.method !== 'POST' || req.url !== '/run') return send(res, 404, { ok: false, error: { code: 'NOT_FOUND' } });
    const { channel, action, params } = await body(req);
    if (!CHANNELS.has(String(channel)) || !/^[a-z_]{2,20}$/.test(String(action))) return send(res, 400, { ok: false, error: { code: 'BAD_INPUT', message: 'unknown channel or action' } });
    const args = [String(channel), String(action)];
    for (const [k, v] of Object.entries(params && typeof params === 'object' ? params : {})) {
      if (!/^[a-z_]{1,20}$/.test(k)) continue;
      const val = String(v);
      if (!SAFE.test(val)) return send(res, 400, { ok: false, error: { code: 'BAD_INPUT', message: `parameter ${k} has characters the bridge will not pass on` } });
      // Positional parameters first (target, query, username, name), then flags.
      if (['target', 'query', 'username', 'name'].includes(k)) args.push(val);
      else args.push(`--${k}`, val);
    }
    const result = await run(args);
    send(res, 200, result);
  })
  .listen(PORT, () => console.log(`agent-reach bridge on http://127.0.0.1:${PORT} using ${BIN}`));
