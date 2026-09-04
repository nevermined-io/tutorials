// Catalog Discovery playground — zero-dependency static server + discovery proxy.
//
// Why a proxy at all: the Nevermined discovery API is public and unauthenticated, but its CORS
// allowlist only reflects `*.nevermined.app` origins — so a browser page served from anywhere else
// (localhost, Vercel, the tutorials example) is blocked. This server sits same-origin with the page
// and forwards the discovery calls server-side, where CORS does not apply. It also lets the browser
// reach the MCP endpoint (which speaks JSON-RPC/SSE, not browser-friendly cross-origin).
//
// ponytail: zero deps — Node 18+ `http` + global `fetch`, no framework, no node_modules. `node server.mjs`.
//
// Security: it proxies ONLY to the two fixed Nevermined upstreams below, chosen by URL PREFIX. There is
// no user-controlled destination host, so it can't be turned into an open relay (no SSRF surface).

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, normalize, extname } from 'node:path'

const PORT = Number(process.env.PORT) || 8080
const TIER = process.env.NVM_TIER === 'live' ? 'live' : 'sandbox' // discovery is read-only; default safe
const API_BASE = `https://api.${TIER}.nevermined.app`
const MCP_BASE = `https://mcp.${TIER}.nevermined.app`

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), 'public')
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

/** Read the raw request body (JSON discovery calls are tiny; cap to be safe). */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > 256 * 1024) reject(new Error('body too large'))
      else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/** Forward one request to a fixed upstream and relay status + JSON/text back. */
async function proxy(req, res, upstreamUrl) {
  const method = req.method || 'GET'
  const headers = { accept: 'application/json, text/event-stream' }
  let body
  if (method !== 'GET' && method !== 'HEAD') {
    body = await readBody(req)
    headers['content-type'] = req.headers['content-type'] || 'application/json'
  }
  const upstream = await fetch(upstreamUrl, { method, headers, body })
  const text = await upstream.text()
  res.writeHead(upstream.status, {
    'content-type': upstream.headers.get('content-type') || 'application/json',
    'cache-control': 'no-store',
  })
  res.end(text)
}

async function serveStatic(res, urlPath) {
  const rel = urlPath === '/' ? '/index.html' : urlPath
  // Contain within PUBLIC_DIR — reject any path that escapes it.
  const full = normalize(join(PUBLIC_DIR, rel))
  if (!full.startsWith(PUBLIC_DIR)) return notFound(res)
  try {
    const data = await readFile(full)
    res.writeHead(200, { 'content-type': MIME[extname(full)] || 'application/octet-stream' })
    res.end(data)
  } catch {
    notFound(res)
  }
}

function notFound(res) {
  res.writeHead(404, { 'content-type': 'text/plain' })
  res.end('Not found')
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`)
    const p = url.pathname

    // Discovery surfaces → API host (REST catalog + ARD registry + well-known feed).
    if (p.startsWith('/api/') || p.startsWith('/.well-known/')) {
      return await proxy(req, res, API_BASE + p + url.search)
    }
    // Catalog MCP (JSON-RPC) → MCP host.
    if (p === '/mcp') {
      return await proxy(req, res, MCP_BASE + '/mcp')
    }
    // Config the page reads on load (which tier it's talking to).
    if (p === '/config.json') {
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({ tier: TIER, apiBase: API_BASE, mcpBase: MCP_BASE }))
    }
    return await serveStatic(res, p)
  } catch (err) {
    res.writeHead(502, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'proxy_error', message: String(err?.message || err) }))
  }
})

server.listen(PORT, () => {
  console.log(`Catalog Discovery playground → http://localhost:${PORT}  (tier: ${TIER})`)
})
