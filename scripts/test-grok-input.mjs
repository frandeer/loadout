import CDP from 'chrome-remote-interface';
import { findGrokTarget } from "../skills/web-image-forge/lib/grok.js";

async function run() {
  const t = await findGrokTarget({});
  if (!t) { console.error('No Grok tab'); return; }
  const client = await CDP({ target: t });
  const { Runtime } = client;
  const exists = await Runtime.evaluate({
    expression: `!!document.querySelector('textarea, [contenteditable="true"]')`,
    returnByValue: true
  });
  console.log('Composer exists:', exists.result.value);
  await client.close();
}
run();
