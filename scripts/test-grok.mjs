import { generate } from "../skills/web-image-forge/lib/imagegen.js";
import { resolve } from "node:path";

async function run() {
  const prompt = "Flat 2D tactical HUD UI wireframe graphic vector illustration. Matte black body background with a subtle dark grid texture. Clean, sharp, glowing cyan/turquoise laser scanlines and geometric network connections. Absolute flat perspective, borderless, frameless, edge-to-edge full canvas graphic. No outer borders, no mockups, no hands, no background tables, no text, no military symbols.";
  console.log("Generating with Grok...");
  try {
    const files = await generate({
      engine: "grok",
      prompt,
      count: 1,
      outDir: resolve("./media/generated"),
    });
    console.log("Success! Files:", files);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
run();
