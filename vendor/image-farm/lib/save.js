// Persist a downloaded image blob to disk at an arbitrary output directory.
import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

const EXT_BY_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function extForMime(mime) {
  return EXT_BY_MIME[mime?.toLowerCase()] ?? "png";
}

// dir may be absolute (preferred for "save where I want") or relative to cwd.
export async function saveImage({ base64, mime, dir, basename }) {
  const ext = extForMime(mime);
  const filename = `${basename}.${ext}`;
  const outDir = isAbsolute(dir) ? dir : resolve(process.cwd(), dir);
  const fullPath = join(outDir, filename);
  await mkdir(outDir, { recursive: true });
  await writeFile(fullPath, Buffer.from(base64, "base64"));
  return { filename, fullPath };
}
