// Assemble dist/kho/ in the Kho layout (TDD 4) from an electron-builder output.
// Usage: node scripts/stage-kho.mjs win|linux
import { chmodSync, cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = process.argv[2]
if (target !== 'win' && target !== 'linux') {
  console.error('Usage: node scripts/stage-kho.mjs win|linux')
  process.exit(1)
}

const kho = join(root, 'dist', 'kho')
const dest = join(kho, 'app', target)
rmSync(dest, { recursive: true, force: true })
mkdirSync(dest, { recursive: true })

for (const doc of ['HUONG-DAN-SU-DUNG.md', 'DINH-DANG-FLOWMAP.md']) {
  cpSync(join(root, doc), join(kho, doc))
}

if (target === 'win') {
  const unpacked = join(root, 'dist', 'win-unpacked')
  if (!existsSync(unpacked))
    throw new Error(`Missing ${unpacked}, run electron-builder --win dir first`)
  cpSync(unpacked, dest, { recursive: true })
  cpSync(join(root, 'scripts', 'Mo-MapApp-Windows.bat'), join(kho, 'Mo-MapApp-Windows.bat'))
  cpSync(join(root, 'scripts', 'Tao-Shortcut-MapApp.bat'), join(kho, 'Tao-Shortcut-MapApp.bat'))
} else {
  const image = join(root, 'dist', 'MapApp.AppImage')
  if (!existsSync(image))
    throw new Error(`Missing ${image}, run electron-builder --linux AppImage first`)
  cpSync(image, join(dest, 'MapApp.AppImage'))
  chmodSync(join(dest, 'MapApp.AppImage'), 0o755)
  const launcher = join(kho, 'mo-mapapp-linux.sh')
  cpSync(join(root, 'scripts', 'mo-mapapp-linux.sh'), launcher)
  chmodSync(launcher, 0o755)
}

console.log(`Kho staged at ${kho} (app/${target})`)
