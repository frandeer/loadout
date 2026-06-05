import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
export async function saveImage({ base64, mime, dir, basename }) {
  const ext = EXT[(mime || "").toLowerCase()] ?? "png";
  const filename = `${basename}.${ext}`;
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), Buffer.from(base64, "base64"));
  return { filename, fullPath: join(dir, filename), urlPath: `/media/generated/${filename}` };
}
