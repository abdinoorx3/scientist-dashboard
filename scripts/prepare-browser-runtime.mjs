import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Pinned official Pyodide distribution. Generated runtime files are excluded from Git.
const manifest = JSON.parse(await readFile(new URL('../RUNTIME_MANIFEST.json', import.meta.url), 'utf8'))
const version = manifest.pyodide_version
const base = manifest.official_distribution
const dir = fileURLToPath(new URL('../public/runtime/pyodide/', import.meta.url))
await mkdir(dir, { recursive: true })
async function download(name, expectedSha, url = base + name, dest = path.join(dir, name)) {
  try {
    const data = await readFile(dest)
    if (data.length && (!expectedSha || createHash('sha256').update(data).digest('hex') === expectedSha)) return
  } catch {}
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Download failed: ${name} (${response.status})`)
  const data = Buffer.from(await response.arrayBuffer())
  if (data.length > 25 * 1024 * 1024) throw new Error(`Asset exceeds Pages limit: ${name}`)
  if (expectedSha && createHash('sha256').update(data).digest('hex') !== expectedSha) throw new Error(`Checksum mismatch: ${name}`)
  await writeFile(dest + '.tmp', data)
  await rename(dest + '.tmp', dest)
  console.log(`${name}: ${(data.length / 1024 / 1024).toFixed(2)} MB`)
}
await download('pyodide-lock.json', manifest.files_sha256['pyodide-lock.json'])
const lock = JSON.parse(await readFile(path.join(dir, 'pyodide-lock.json'), 'utf8'))
if (lock.info.arch !== 'wasm32' || !lock.info.python) throw new Error('Unexpected runtime lock format')
await Promise.all(['pyodide.js', 'pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip'].map(name => download(name, manifest.files_sha256[name])))
const needed = new Set()
function requirePackage(name) {
  if (needed.has(name)) return
  const entry = lock.packages[name]
  if (!entry) throw new Error(`Missing package: ${name}`)
  needed.add(name)
  for (const dependency of entry.depends) requirePackage(dependency)
}
requirePackage('sympy')
requirePackage('mpmath')
await Promise.all([...needed].map(name => download(lock.packages[name].file_name, lock.packages[name].sha256)))
await writeFile(path.join(dir, 'RUNTIME_VERSION.txt'), `${version}\nOfficial distribution: ${base}\n`)

const overlay = manifest.overlay
const overlayDest = fileURLToPath(new URL('../public/research-assets/' + overlay.filename, import.meta.url))
let overlayValid = false
try { overlayValid = createHash('sha256').update(await readFile(overlayDest)).digest('hex') === overlay.sha256 } catch {}
if (!overlayValid) {
  const response = await fetch(`https://pypi.org/pypi/${overlay.distribution}/${overlay.version}/json`)
  if (!response.ok) throw new Error('The pinned arithmetic package index could not be loaded.')
  const release = await response.json()
  const wheel = release.urls.find(item => item.filename === overlay.filename && item.digests.sha256 === overlay.sha256)
  if (!wheel || !wheel.url.startsWith('https://files.pythonhosted.org/')) throw new Error('Pinned arithmetic wheel metadata mismatch.')
  await download(overlay.filename, overlay.sha256, wheel.url, overlayDest)
}
console.log(`Runtime prepared with ${needed.size} mathematical packages.`)
