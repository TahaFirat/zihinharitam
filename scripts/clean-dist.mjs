import fs from 'node:fs';
import path from 'node:path';

/**
 * Cleans stale hashed JS/CSS chunks inside `dist/assets` (and `web-platform/dist/assets`)
 * by unlinking individual files (resilient to Windows folder handles that cause recursive rmSync
 * and Vite's emptyOutDir to silently skip directory cleanup!).
 */
const targetRel = process.argv[2] || 'dist';
const targetDir = path.resolve(process.cwd(), targetRel);
const assetsDir = path.join(targetDir, 'assets');

function unlinkFilesRecursive(dir) {
  let removed = 0;
  if (!fs.existsSync(dir)) return removed;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        removed += unlinkFilesRecursive(full);
        try {
          fs.rmdirSync(full);
        } catch {
          // Folder handle busy; files inside are already removed
        }
      } else {
        fs.unlinkSync(full);
        removed += 1;
      }
    } catch {
      // Skip any locked file without aborting cleanup of other stale bundles
    }
  }
  return removed;
}

if (fs.existsSync(assetsDir)) {
  const count = unlinkFilesRecursive(assetsDir);
  console.log(
    `[clean-dist] Removed ${count} stale asset file(s) from ${path.relative(process.cwd(), assetsDir)}`
  );
}
