// HTTP server: the single owner of the Chrome tab pool.
//
// Endpoints
//   GET  /api/health           -> { ok, chrome, pool }
//   POST /api/generate         -> single job  { prompt, count?, outDir? }
//   POST /api/batch            -> parallel    { jobs: [{ prompt, count?, outDir? }, ...] }
//   GET  /generated/*          -> serves files saved to the default ./generated dir
//   GET  /                     -> status dashboard
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { TabPool } from "./lib/pool.js";
import { generate, generateBatch } from "./lib/generate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4180;
const CHROME_HOST = process.env.CHROME_HOST || "127.0.0.1";
const CHROME_PORT = Number(process.env.CHROME_PORT) || 9222;
const POOL_SIZE = Number(process.env.POOL_SIZE) || 3;
const GENERATED_DIR = resolve(__dirname, "generated");
const PUBLIC_DIR = resolve(__dirname, "public");

const pool = new TabPool({ host: CHROME_HOST, port: CHROME_PORT, size: POOL_SIZE });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(data);
}

async function readBody(req, limit = 1 << 20) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("request body too large");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

// Serve a file from `baseDir` only (blocks path traversal).
async function serveFile(res, baseDir, relPath) {
  const resolved = resolve(baseDir, relPath);
  if (resolved !== baseDir && !resolved.startsWith(baseDir + sep)) {
    return sendJson(res, 403, { ok: false, error: "forbidden" });
  }
  try {
    const data = await readFile(resolved);
    res.writeHead(200, { "content-type": MIME[extname(resolved).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  } catch {
    sendJson(res, 404, { ok: false, error: "not found" });
  }
}

function errorStatus(err) {
  switch (err.code) {
    case "BAD_REQUEST":
      return 400;
    case "CHROME_UNREACHABLE":
    case "NOT_SIGNED_IN":
      return 503;
    default:
      return 500;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  try {
    if (req.method === "GET" && path === "/api/health") {
      let chrome = true;
      try {
        await pool.ensureReady();
      } catch {
        chrome = false;
      }
      return sendJson(res, 200, { ok: true, chrome, pool: pool.status() });
    }

    if (req.method === "POST" && path === "/api/generate") {
      const body = await readBody(req);
      try {
        const result = await generate(pool, body);
        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, errorStatus(err), {
          ok: false,
          error: err.message,
          code: err.code || "ERROR",
          log: err.log || [],
        });
      }
    }

    if (req.method === "POST" && path === "/api/batch") {
      const body = await readBody(req);
      try {
        const results = await generateBatch(pool, body.jobs);
        const okCount = results.filter((r) => r.ok).length;
        return sendJson(res, 200, { ok: okCount === results.length, total: results.length, okCount, results });
      } catch (err) {
        return sendJson(res, errorStatus(err), { ok: false, error: err.message, code: err.code || "ERROR" });
      }
    }

    if (req.method === "GET" && path.startsWith("/generated/")) {
      return await serveFile(res, GENERATED_DIR, path.slice("/generated/".length));
    }

    if (req.method === "GET" && (path === "/" || path === "/index.html")) {
      return await serveFile(res, PUBLIC_DIR, "index.html");
    }

    if (req.method === "GET" && path.startsWith("/public/")) {
      return await serveFile(res, PUBLIC_DIR, path.slice("/public/".length));
    }

    sendJson(res, 404, { ok: false, error: "not found" });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`chatgpt-image-farm server on http://127.0.0.1:${PORT}`);
  console.log(`  Chrome CDP target: ${CHROME_HOST}:${CHROME_PORT}, pool size: ${POOL_SIZE}`);
  console.log(`  1) run launch-chrome.ps1 and sign in to ChatGPT`);
  console.log(`  2) open http://127.0.0.1:${PORT} or POST /api/generate`);
  // Warm the pool, but don't crash the server if Chrome isn't up yet.
  pool.ensureReady().then(
    () => console.log(`  pool ready: ${JSON.stringify(pool.status())}`),
    (err) => console.log(`  pool not ready yet: ${err.message}`),
  );
});

const shutdown = async () => {
  await pool.dispose().catch(() => {});
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export { server, pool };
