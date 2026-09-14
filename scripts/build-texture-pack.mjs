/**
 * Builds a minimal Minecraft resource pack for the schematic viewer.
 *
 *   node scripts/build-texture-pack.mjs
 *
 * The renderer only ever resolves paths under `blockstates/`, `models/` and
 * `textures/` — it never reads a texture directory by name, it follows the
 * references in the model JSON. So rather than guessing which directories to
 * keep, this walks the actual reference graph:
 *
 *   blockstates/*.json  ->  model ids
 *   models/**.json      ->  parent chain + texture ids
 *   textures/**.png     ->  kept only if something referenced it
 *
 * Everything unreferenced goes, which is most of the pack: the stock pack's
 * single largest entry is `pack.png`, a 1.55 MB icon, followed by GUI and
 * entity textures that a block renderer never touches.
 *
 * Input is the upstream pack from the renderer's own npm package, so the
 * textures match the version of the library we load.
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import AdmZip from 'adm-zip'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(ROOT, 'data', 'pack.zip')
const OUT = join(ROOT, 'apps', 'web', 'public', 'schematic-pack.zip')

const NS = 'assets/minecraft'

/** "minecraft:block/stone" and "block/stone" both mean the same file. */
const stripNamespace = (id) => (id.includes(':') ? id.slice(id.indexOf(':') + 1) : id)

function main() {
  const zip = new AdmZip(SOURCE)
  const entries = new Map()
  for (const entry of zip.getEntries()) {
    if (!entry.isDirectory) entries.set(entry.entryName, entry)
  }

  const read = (path) => {
    const entry = entries.get(path)
    return entry ? entry.getData() : null
  }
  const readJson = (path) => {
    const data = read(path)
    if (!data) return null
    try {
      return JSON.parse(data.toString('utf8'))
    } catch {
      return null
    }
  }

  const keep = new Set()
  const models = new Set()
  const textures = new Set()

  /* ── 1. every blockstate, and the models it names ── */
  for (const path of entries.keys()) {
    if (!path.startsWith(`${NS}/blockstates/`) || !path.endsWith('.json')) continue
    keep.add(path)
    const state = readJson(path)
    if (!state) continue

    const collect = (variant) => {
      for (const option of Array.isArray(variant) ? variant : [variant]) {
        if (option?.model) models.add(stripNamespace(option.model))
      }
    }
    for (const variant of Object.values(state.variants ?? {})) collect(variant)
    for (const part of state.multipart ?? []) collect(part.apply)
  }

  /* ── 2. resolve model parents, gathering texture ids ── */
  const seenModels = new Set()
  const queue = [...models]
  while (queue.length > 0) {
    const id = queue.pop()
    if (seenModels.has(id)) continue
    seenModels.add(id)

    const path = `${NS}/models/${id}.json`
    const model = readJson(path)
    /* builtin/* models have no file; that is expected, not an error. */
    if (!model) continue
    keep.add(path)

    if (model.parent) queue.push(stripNamespace(model.parent))
    for (const value of Object.values(model.textures ?? {})) {
      /* "#side" points at another key in the same model, not a file. */
      if (typeof value === 'string' && !value.startsWith('#')) {
        textures.add(stripNamespace(value))
      }
    }
  }

  /* ── 3. the textures those models actually use ── */
  let missing = 0
  for (const id of textures) {
    const png = `${NS}/textures/${id}.png`
    if (entries.has(png)) {
      keep.add(png)
      /* Frame timings for animated textures (water, lava, fire). Without the
         .mcmeta the tall strip renders as one squashed frame. */
      const meta = `${png}.mcmeta`
      if (entries.has(meta)) keep.add(meta)
    } else {
      missing++
    }
  }

  /* ── 4. atlas definitions and the pack manifest ── */
  for (const path of entries.keys()) {
    if (path.startsWith(`${NS}/atlases/`)) keep.add(path)
  }
  keep.add('pack.mcmeta')

  /* ── 5. write it ──
   * JSON is minified on the way out: the stock pack ships it pretty-printed,
   * which is 29% wasted bytes and needless parse work in the browser. PNGs are
   * already optimal, so they are copied verbatim.
   *
   * Note the floor here: zip stores a local header and a central-directory
   * entry per file, roughly 166 bytes each at these path lengths, so ~4,400
   * files carry ~0.7 MB of pure container overhead. Cutting further means
   * cutting files, not bytes. */
  const out = new AdmZip()
  let bytes = 0
  let minified = 0
  for (const path of [...keep].sort()) {
    let data = read(path)
    if (!data) continue
    if (path.endsWith('.json') || path.endsWith('.mcmeta')) {
      try {
        const compact = Buffer.from(JSON.stringify(JSON.parse(data.toString('utf8'))))
        minified += data.length - compact.length
        data = compact
      } catch {
        /* leave anything unparseable exactly as it was */
      }
    }
    out.addFile(path, data)
    bytes += data.length
  }
  out.writeZip(OUT)

  const sourceSize = new AdmZip(SOURCE).toBuffer().length
  const outSize = out.toBuffer().length
  console.log(`blockstates + models + textures kept: ${keep.size} files`)
  console.log(`  models resolved:   ${seenModels.size}`)
  console.log(`  textures resolved: ${textures.size} (${missing} referenced but absent)`)
  console.log(`  uncompressed:      ${(bytes / 1e6).toFixed(2)} MB`)
  console.log(`  saved by minifying JSON: ${(minified / 1e6).toFixed(2)} MB`)
  console.log('')
  console.log(`source ${SOURCE}`)
  console.log(`  ${(sourceSize / 1e6).toFixed(2)} MB  (${entries.size} files)`)
  console.log(`output ${OUT}`)
  console.log(
    `  ${(outSize / 1e6).toFixed(2)} MB  (${keep.size} files)  ` +
      `— ${(100 - (outSize / sourceSize) * 100).toFixed(1)}% smaller`,
  )
}

main()
