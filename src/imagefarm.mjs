// image-farm 자동 기동 — 첫 이미지 생성 요청 때 벤더된 image-farm 서버(:4180)와
// 디버그 Chrome(:9222)을 게으르게(lazy) 띄운다. 한 번 뜨면 재사용(프로세스/창 1개).
//
// 책임 분리: 이 모듈은 "이미지-팜이 준비됐는지 보장"만 한다. 실제 생성/이미지 처리는
// server.mjs 의 /api/generate 가 :4180 으로 HTTP 호출해서 한다.
//
// health 의 chrome 필드는 CDP 연결+탭 생성 가능 여부만 본다(ChatGPT 로그인 X).
// 로그인 여부는 실제 generate 시 NOT_SIGNED_IN(503)으로 드러나며 server.mjs 가 처리.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const VENDOR_DIR = join(root, "vendor", "image-farm");
const SERVER_JS = join(VENDOR_DIR, "server.js");
const LAUNCH_PS1 = join(VENDOR_DIR, "launch-chrome.ps1");
const LAUNCH_SH = join(VENDOR_DIR, "launch-chrome.sh");

const DEFAULTS = {
  enabled: true,
  port: 4180,
  chromePort: 9222,
  poolSize: 3,
  autoLaunchChrome: true,
  startupTimeoutMs: 30000,
  profileDir: "", // 비우면 launch-chrome 기본 프로필. 이미 ChatGPT 로그인된 프로필 경로를 주면 재로그인 불필요.
};

// config.json 의 imageFarm 블록(있으면). DEFAULTS ← config ← 호출 인자 순으로 병합.
let CONFIG_CACHE;
function fileConfig() {
  if (CONFIG_CACHE !== undefined) return CONFIG_CACHE;
  try {
    CONFIG_CACHE = JSON.parse(readFileSync(join(root, "src/config.json"), "utf8")).imageFarm || {};
  } catch {
    CONFIG_CACHE = {};
  }
  return CONFIG_CACHE;
}

let serverProc = null;   // 벤더 :4180 서버 자식 프로세스 핸들(재사용)
let startPromise = null; // 기동 중 뮤텍스 — 동시 요청이 중복 spawn 하지 않게 합류시킴

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// fetch + 타임아웃. 실패(연결거부/타임아웃)는 null 로 흡수.
async function probe(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// :4180 health → { ok, chrome, pool } | null(미응답)
async function farmHealth(port, timeoutMs = 1000) {
  const res = await probe(`http://127.0.0.1:${port}/api/health`, timeoutMs);
  if (!res || !res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

// 디버그 Chrome(:9222) CDP 가 떠 있나
async function chromeReachable(chromePort, timeoutMs = 1000) {
  const res = await probe(`http://127.0.0.1:${chromePort}/json/version`, timeoutMs);
  return !!(res && res.ok);
}

// 벤더 서버를 loadout 서버의 자식으로 spawn. node_modules 는 loadout 것을 상속 해석.
function spawnServer(cfg) {
  if (serverProc && !serverProc.killed) return;
  serverProc = spawn(process.execPath, [SERVER_JS], {
    cwd: VENDOR_DIR,
    env: {
      ...process.env,
      PORT: String(cfg.port),
      CHROME_PORT: String(cfg.chromePort),
      POOL_SIZE: String(cfg.poolSize),
    },
    stdio: "ignore",
    windowsHide: true,
  });
  serverProc.on("exit", () => { serverProc = null; });
}

// 디버그 Chrome 실행(launch-chrome).
// 주의: detached:true 는 이 환경에서 spawn 을 조용히 실패시킨다(검증됨). launch-chrome 내부의
// Start-Process(win)/nohup(sh) 가 Chrome 자체를 분리하므로, 런처는 일반 자식으로 띄워도
// 곧 종료되고 Chrome 창은 유지된다. cfg.profileDir 가 있으면 그 프로필로(=로그인 재사용).
function launchChrome(cfg) {
  let child;
  if (process.platform === "win32") {
    const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", LAUNCH_PS1, "-Port", String(cfg.chromePort)];
    if (cfg.profileDir) args.push("-ProfileDir", cfg.profileDir);
    child = spawn("powershell.exe", args, { stdio: "ignore", windowsHide: true });
  } else {
    child = spawn("sh", [LAUNCH_SH], {
      stdio: "ignore",
      env: { ...process.env, PORT: String(cfg.chromePort), ...(cfg.profileDir ? { PROFILE_DIR: cfg.profileDir } : {}) },
    });
  }
  child.on("error", (e) => console.warn("[imagefarm] Chrome 런처 실행 실패:", e.message));
}

// 이미지-팜이 생성 가능한 상태가 되도록 보장한다.
// 반환: { ok:true, reused? } | { ok:false, code, message }
//   code: DISABLED | NOT_VENDORED | NO_CHROME | SERVER_TIMEOUT
export async function ensureImageFarm(userCfg = {}) {
  const cfg = { ...DEFAULTS, ...fileConfig(), ...userCfg };

  if (cfg.enabled === false) {
    return { ok: false, code: "DISABLED", message: "image-farm 자동 기동이 비활성화돼 있습니다(config.imageFarm.enabled=false)." };
  }
  if (!existsSync(SERVER_JS)) {
    return { ok: false, code: "NOT_VENDORED", message: `벤더된 image-farm 서버를 찾을 수 없습니다: ${SERVER_JS}` };
  }

  // 이미 완전히 준비됨 → 즉시 재사용
  const h0 = await farmHealth(cfg.port, 800);
  if (h0?.ok && h0.chrome) return { ok: true, reused: true };

  // 기동 중이면 같은 약속에 합류(중복 spawn 방지)
  if (startPromise) return startPromise;

  startPromise = (async () => {
    try {
      // 1) 서버가 미응답이면 spawn
      if (!h0) spawnServer(cfg);

      // 2) Chrome 보장 — 이미 떠 있으면 재사용, 없으면 launch
      if (cfg.autoLaunchChrome !== false && !(await chromeReachable(cfg.chromePort, 800))) {
        launchChrome(cfg);
      }

      // 3) chrome:true(서버+CDP 준비) 까지 폴링
      const deadline = Date.now() + cfg.startupTimeoutMs;
      let last = null;
      while (Date.now() < deadline) {
        await sleep(700);
        last = await farmHealth(cfg.port, 1000);
        if (last?.ok && last.chrome) return { ok: true };
      }

      // 타임아웃 — 원인 구분
      if (last?.ok && !last.chrome) {
        return {
          ok: false,
          code: "NO_CHROME",
          message: `image-farm 서버는 떴지만 디버그 Chrome(:${cfg.chromePort})에 연결하지 못했습니다. 열린 Chrome 창에서 chatgpt.com 로그인을 마쳤는지 확인하세요.`,
        };
      }
      return {
        ok: false,
        code: "SERVER_TIMEOUT",
        message: `image-farm 서버 기동이 ${Math.round(cfg.startupTimeoutMs / 1000)}초 안에 끝나지 않았습니다.`,
      };
    } finally {
      startPromise = null;
    }
  })();

  return startPromise;
}
