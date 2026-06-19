// codex 이미지 생성 래퍼 — codex-image 스킬의 generate.py(단일 모드)를 spawn 한다.
// 브라우저(CDP/chatgpt.com) 자동화를 거치지 않고 Codex CLI 의 image_gen(gpt-image)으로 바로 생성하므로
// 로그인 만료/사용량 차단/셀렉터 변경 같은 브라우저 경로의 실패에 영향받지 않는다.
//
// 책임: 프롬프트 1개 → outPath 1장. 성공 시 outPath 반환, 실패 시 code 가 붙은 Error throw.
// 실제 카드 매핑(setCardImage)·파일명 규칙은 server.mjs 의 /api/generate 가 담당한다.
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

const DEFAULTS = {
  // 비우면 사용자 홈의 codex-image 스킬 경로를 쓴다. config.codex.scriptPath 로 덮어쓸 수 있다.
  scriptPath: join(homedir(), ".claude", "skills", "codex-image", "scripts", "generate.py"),
  python: process.platform === "win32" ? "python" : "python3",
  size: "1024x1024",
  quality: "high",
  timeoutSec: 300,
  concurrency: 4,
};

let CONFIG_CACHE;
function fileConfig() {
  if (CONFIG_CACHE !== undefined) return CONFIG_CACHE;
  try {
    CONFIG_CACHE = JSON.parse(readFileSync(join(root, "src/config.json"), "utf8")).codex || {};
  } catch {
    CONFIG_CACHE = {};
  }
  return CONFIG_CACHE;
}

// config 의 빈 문자열("")은 "미지정"으로 보고 DEFAULTS 로 폴백한다.
function clean(o) {
  const out = {};
  for (const [k, v] of Object.entries(o || {})) {
    if (v === "" || v === null || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

export function codexConfig(userCfg = {}) {
  return { ...DEFAULTS, ...clean(fileConfig()), ...clean(userCfg) };
}

// 단일 이미지 생성. 성공 시 outPath(string) 반환.
export async function generateCodexImage({ prompt, outPath, size, quality, timeoutSec } = {}) {
  if (!prompt || !prompt.trim()) { const e = new Error("prompt가 비어 있습니다."); e.code = "NO_PROMPT"; throw e; }
  if (!outPath) { const e = new Error("outPath가 필요합니다."); e.code = "NO_OUT"; throw e; }

  const cfg = codexConfig();
  if (!existsSync(cfg.scriptPath)) {
    const e = new Error(`codex-image 스크립트를 찾을 수 없습니다: ${cfg.scriptPath} (config.json 의 codex.scriptPath 로 지정하세요)`);
    e.code = "NO_SCRIPT";
    throw e;
  }

  const tSec = Number(timeoutSec || cfg.timeoutSec) || 300;
  const args = [
    cfg.scriptPath,
    "--prompt", prompt,
    "--out", outPath,
    "--size", size || cfg.size,
    "--quality", quality || cfg.quality,
    "--timeout", String(tSec),
  ];
  // generate.py 자체 타임아웃 + 여유(파일 복사 등) 30초.
  return await runPython(cfg.python, args, tSec * 1000 + 30000, outPath);
}

function runPython(python, args, hardTimeoutMs, outPath) {
  return new Promise((resolveP, rejectP) => {
    let proc;
    try {
      // PYTHONUTF8/IOENCODING: Windows에서 python stdout이 cp949로 나가면 Node(utf-8)에서 깨진다(����). utf-8 강제.
      proc = spawn(python, args, {
        windowsHide: true,
        env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" },
      });
    } catch (e) {
      rejectP(e);
      return;
    }
    let stderr = "";
    let stdout = "";
    const killer = setTimeout(() => {
      try { proc.kill(); } catch {}
      const e = new Error(`codex 생성 타임아웃(${Math.round(hardTimeoutMs / 1000)}초)`);
      e.code = "TIMEOUT";
      rejectP(e);
    }, hardTimeoutMs);

    proc.stdout?.on("data", (d) => { stdout += d.toString(); });
    proc.stderr?.on("data", (d) => { stderr += d.toString(); });

    proc.on("error", (e) => {
      clearTimeout(killer);
      // Windows 에서 "python" 이 없으면 런처 "py" 로 한 번 더 시도.
      if (e.code === "ENOENT" && python !== "py" && process.platform === "win32") {
        runPython("py", args, hardTimeoutMs, outPath).then(resolveP, rejectP);
      } else {
        rejectP(e);
      }
    });

    proc.on("exit", (code) => {
      clearTimeout(killer);
      if (code === 0 && existsSync(outPath)) {
        resolveP(outPath);
        return;
      }
      const combined = `${stderr || ""}\n${stdout || ""}`;
      if (recoverInlineCodexImage(combined, outPath)) {
        resolveP(outPath);
        return;
      }
      const tail = (stderr || stdout || "").trim().split("\n").slice(-4).join(" ").slice(0, 300);
      const e = new Error(`codex 생성 실패(exit ${code})${tail ? ": " + tail : ""}`);
      e.code = "CODEX_FAIL";
      rejectP(e);
    });
  });
}

export function recoverInlineCodexImage(output, outPath) {
  const m = /세션에 이미지가 없음:\s*([^\r\n]+)/.exec(output || "");
  if (!m) return false;

  const sid = m[1].trim().replace(/[\\/]+$/, "").split(/[\\/]/).pop();
  if (!sid) return false;

  const sessionLog = findCodexSessionLog(sid);
  if (!sessionLog) return false;

  const result = readInlineImageResult(sessionLog);
  if (!result) return false;

  try {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, Buffer.from(result, "base64"));
    return existsSync(outPath);
  } catch {
    return false;
  }
}

function findCodexSessionLog(sid) {
  const sessionsRoot = join(homedir(), ".codex", "sessions");
  const stack = [sessionsRoot];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name.endsWith(`${sid}.jsonl`)) {
        return full;
      }
    }
  }
  return null;
}

function readInlineImageResult(sessionLog) {
  const lines = readFileSync(sessionLog, "utf8").split(/\r?\n/).reverse();
  for (const line of lines) {
    if (!line.includes('"type":"image_generation_call"') && !line.includes('"image_generation_end"')) continue;
    try {
      const parsed = JSON.parse(line);
      const result = parsed?.payload?.result;
      if (typeof result === "string" && result.startsWith("iVBOR")) return result;
    } catch {}
  }
  return null;
}
