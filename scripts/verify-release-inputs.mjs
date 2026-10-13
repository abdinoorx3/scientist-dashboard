import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const manifest = JSON.parse(await readFile(new URL('../RELEASE_INPUTS.json', import.meta.url), 'utf8'))
for (const [name, expected] of Object.entries(manifest.files_sha256)) {
  const data = await readFile(new URL('../' + name, import.meta.url))
  const actual = createHash('sha256').update(data).digest('hex')
  if (actual !== expected) throw new Error(`Release input changed: ${name}`)
}
console.log(`Verified ${Object.keys(manifest.files_sha256).length} released dashboard and research inputs.`)
