import CDP from 'chrome-remote-interface';
import { findGrokTarget } from "../skills/web-image-forge/lib/grok.js";

async function run() {
  const t = await findGrokTarget({});
  if (!t) { console.error('No Grok tab'); return; }
  const client = await CDP({ target: t });
  const { Runtime } = client;
  const list = await Runtime.evaluate({
    expression: `Array.from(document.querySelectorAll('img')).map(i => ({ src: i.src, currentSrc: i.currentSrc, alt: i.alt, width: i.naturalWidth, complete: i.complete }))`,
    returnByValue: true
  });
  console.log(JSON.stringify(list.result.value, null, 2));
  await client.close();
}
run();
