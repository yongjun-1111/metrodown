import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "src-tauri", "target");
mkdirSync(target, { recursive: true });
const scratch = mkdtempSync(join(target, "icon-generation-"));
const icons = join(root, "src-tauri", "icons");
const sizes = [16, 24, 32, 48, 64, 256];

function generate(source, output, pngSizes = []) {
  const args = [join(root, "node_modules", "@tauri-apps", "cli", "tauri.js"), "icon", source, "--output", output];
  for (const size of pngSizes) args.push("--png", String(size));
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Icon generation failed (${result.status})`);
}

// PNG-compressed ICO frames are supported on Windows. Dedicated small drawings keep
// the paper and Markdown mark visible instead of shrinking the entire app tile.
function writeIco(output, normal, small) {
  const frames = sizes.map(size => readFileSync(join(size <= 24 ? small : normal, `${size}x${size}.png`)));
  const header = Buffer.alloc(6 + 16 * frames.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach((frame, i) => {
    const entry = 6 + 16 * i;
    header[entry] = header[entry + 1] = sizes[i] === 256 ? 0 : sizes[i];
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(frame.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += frame.length;
  });
  writeFileSync(output, Buffer.concat([header, ...frames]));
}

try {
  for (const kind of ["app", "document"]) {
    const normal = join(scratch, kind);
    const small = join(scratch, `${kind}-small`);
    const source = join(root, "src-tauri", `${kind}-icon.svg`);
    generate(source, normal);
    generate(source, normal, sizes);
    generate(join(root, "src-tauri", `${kind}-icon-small.svg`), small, [16, 24]);
    if (kind === "app") {
      for (const name of ["32x32.png", "64x64.png", "128x128.png", "128x128@2x.png", "icon.png", "icon.icns"]) {
        copyFileSync(join(normal, name), join(icons, name));
      }
    } else {
      copyFileSync(join(normal, "icon.icns"), join(icons, "document.icns"));
    }
    writeIco(join(icons, kind === "app" ? "icon.ico" : "document.ico"), normal, small);
  }
} finally {
  const resolved = resolve(scratch);
  if (dirname(resolved) !== target || !resolved.startsWith(`${target}${sep}icon-generation-`)) {
    throw new Error(`Refusing to clean an unexpected icon workspace: ${resolved}`);
  }
  rmSync(resolved, { recursive: true, force: true });
}
