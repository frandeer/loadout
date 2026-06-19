// Load the Vite DEV server (:5173) via CDP and dump FULL (unminified) console output,
// so React's hook-order error names the exact component. Then click 인벤토리 to reproduce.
import CDP from "chrome-remote-interface";
import { mkdirSync, writeFileSync } from "node:fs";
const PORT = 9222, URL = process.env.UIURL || "http://localhost:5173", OUT = "D:\\lab\\loadout\\tools\\shots";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const msgs = [];
(async () => {
  const tgt = await CDP.New({ port: PORT, url: "about:blank" });
  const client = await CDP({ target: tgt.id, port: PORT });
  const { Page, Runtime } = client;
  await Page.enable(); await Runtime.enable();
  Runtime.consoleAPICalled(({ type, args }) => {
    const text = args.map((a) => a.value ?? a.description ?? a.unserializableValue ?? "").join(" ");
    if (type === "error" || type === "warning") msgs.push(`[${type}] ${text}`);
  });
  Runtime.exceptionThrown((p) => msgs.push("[exception] " + (p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || "")));
  const ev = async (e) => (await Runtime.evaluate({ expression: e, returnByValue: true, awaitPromise: true })).result.value;
  const shot = async (n) => { const { data } = await Page.captureScreenshot({ format: "png" }); writeFileSync(`${OUT}\\${n}.png`, Buffer.from(data, "base64")); };

  await Page.navigate({ url: URL });
  await Page.loadEventFired();
  await sleep(2500);
  await shot("dev-01-load");
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('인벤토리')); if(b)b.click(); return !!b;})()`);
  await sleep(1500);
  await shot("dev-02-inventory");
  const bodyLen = await ev(`document.body.innerText.length`);
  console.log("URL:", URL, "| body text length after inventory:", bodyLen);
  console.log("=== console errors/warnings (full) ===");
  console.log(msgs.length ? msgs.slice(0, 15).join("\n----\n") : "none");
  await CDP.Close({ id: tgt.id, port: PORT });
  await client.close();
})().catch((e) => { console.error("DBG ERROR:", e.message); process.exit(1); });
