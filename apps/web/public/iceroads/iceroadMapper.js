/*
    Ice Road Mapper (JsMacros CE): https://nara.rocks/iceroads

    Ice roads run below Y -55, so while it runs, everywhere you go down there is
    treated as ice road; climb above -55 and recording pauses until you come back
    down. It reads nothing but your own X, Y and Z: no blocks, no world.

    Every stretch you travel that is not already mapped is saved as a path in
    iceroads.json, next to this script. Roads you have mapped before are skipped,
    and a new branch starts from the road you left, so the file grows into one
    connected network.

    Upload iceroads.json at https://nara.rocks/iceroads (Upload groups, or drop it
    on the page). Upload it again later and the site merges in the new paths.

    Stop: Shift+I. Your current stretch is saved when you stop.
*/

// ── Settings ─────────────────────────────────────────────
const GROUP_ID = 'my-iceroads' // keep this the same to keep adding to one network
const GROUP_NAME = 'My Ice Roads' // the group's name on the website
const FILE = './iceroads.json'
const QUIT_KEY = 'key.keyboard.i' // held with Shift
const BELOW_Y = -55 // only record while your feet are below this height
const KNOWN_RADIUS = 3 // blocks: within roughly 3-6 of a mapped path counts as mapped
const SIMPLIFY = 4 // blocks: wobble smaller than this (inside the road) is smoothed out
const SNAP = 0.1 // segments within ~6° of straight or 45° diagonal are snapped exactly onto it
const MIN_LENGTH = 8 // blocks: shorter new stretches are ignored
const TURN_LOOKBACK = 4 // blocks of travel compared against your next step to spot a turnaround
const SAVE_EVERY = 100 // a stretch in progress is saved to the file every this many new points
const HEAL_GAP = 8 // blocks: a path end this close to another path is joined onto it

// ── File ─────────────────────────────────────────────────
function load() {
    if (FS.exists(FILE)) {
        const text = FS.open(FILE).read()
        try {
            const file = JSON.parse(text)
            if (file && Array.isArray(file.layers)) return file
        } catch {
            /* fall through */
        }
        if (text.trim()) {
            /* Keep the unreadable file rather than overwrite someone's mapping. */
            const backup = 'iceroads.backup-' + Date.now() + '.json'
            FS.createFile('./', backup)
            FS.open('./' + backup).write(text)
            Chat.log('§c[Ice Roads]§r iceroads.json was unreadable; saved a copy as ' + backup + ' and started fresh.')
        }
    }
    return { version: 2, layers: [] }
}

const file = load()
let layer = file.layers.find((l) => l.id === GROUP_ID)
if (!layer) {
    layer = { id: GROUP_ID, name: GROUP_NAME, updated: Date.now(), paths: [] }
    file.layers.push(layer)
}

function save(f = file) {
    f.version = 2
    if (!FS.exists(FILE)) FS.createFile('./', FILE.slice(2))
    FS.open(FILE).write(JSON.stringify(f))
}

// ── Mapped area: a grid of cells every mapped path passes through ──
const CELL = KNOWN_RADIUS
const known = new Set()
const cellKey = (x, z) => Math.floor(x / CELL) + ',' + Math.floor(z / CELL)

function markPath(path) {
    for (let i = 1; i < path.length; i++) {
        const [ax, az] = path[i - 1]
        const [bx, bz] = path[i]
        const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az)))
        for (let s = 0; s <= steps; s++)
            known.add(cellKey(ax + ((bx - ax) * s) / steps, az + ((bz - az) * s) / steps))
    }
}

function isKnown(x, z) {
    const cx = Math.floor(x / CELL)
    const cz = Math.floor(z / CELL)
    for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++) if (known.has(cx + dx + ',' + (cz + dz))) return true
    return false
}

// ── Paths ────────────────────────────────────────────────
const lengthOf = (path) =>
    path.slice(1).reduce((sum, [x, z], i) => sum + Math.hypot(x - path[i][0], z - path[i][1]), 0)

/* Ramer–Douglas–Peucker: keep only the corners. */
function simplify(path) {
    if (path.length < 3) return path
    const [ax, az] = path[0]
    const [bx, bz] = path[path.length - 1]
    const len = Math.hypot(bx - ax, bz - az) || 1
    let far = 0
    let at = 0
    for (let i = 1; i < path.length - 1; i++) {
        const [px, pz] = path[i]
        const d = Math.abs((bx - ax) * (az - pz) - (ax - px) * (bz - az)) / len
        if (d > far) {
            far = d
            at = i
        }
    }
    if (far <= SIMPLIFY) return [path[0], path[path.length - 1]]
    return simplify(path.slice(0, at + 1)).concat(simplify(path.slice(at)).slice(1))
}

/* Snap segments that are nearly straight or nearly 45° onto exactly that, then merge what
   lines up, so a diagonal runs as one segment until the road turns back to straight. */
function straighten(path) {
    const out = [path[0]]
    for (let i = 1; i < path.length; i++) {
        const [px, pz] = out[i - 1]
        let [x, z] = path[i]
        const dx = Math.abs(x - px)
        const dz = Math.abs(z - pz)
        if (dz <= dx * SNAP) z = pz
        else if (dx <= dz * SNAP) x = px
        else if (Math.abs(dx - dz) <= Math.max(dx, dz) * SNAP) {
            const d = Math.round((dx + dz) / 2)
            x = px + Math.sign(x - px) * d
            z = pz + Math.sign(z - pz) * d
        }
        out.push([x, z])
    }
    return simplify(out)
}
const clean = (path) => straighten(simplify(path))

/* Nearest whole-block point to (x, z) on the segment a-b. */
function nearestOn(x, z, a, b) {
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const len2 = dx * dx + dz * dz
    const t = len2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / len2)) : 0
    return [Math.round(a[0] + t * dx), Math.round(a[1] + t * dz)]
}

/* A new stretch starts once you are clear of mapped road, a few blocks past it. Move each
   path end that stops short of another path onto it; add a corner rather than tilt a
   straight road. Same as healGaps on the website. */
function healGaps(paths) {
    const out = paths.map((p) => p.map(([x, z]) => [x, z]))
    out.forEach((path, i) => {
        for (const atStart of [true, false]) {
            const end = atStart ? 0 : path.length - 1
            const [ex, ez] = path[end]
            let best = null
            let bestD = Infinity
            out.forEach((other, j) => {
                if (j === i) return
                for (let k = 1; k < other.length; k++) {
                    const q = nearestOn(ex, ez, other[k - 1], other[k])
                    const d = Math.hypot(q[0] - ex, q[1] - ez)
                    if (d < bestD) [best, bestD] = [q, d]
                }
            })
            if (!best || bestD === 0 || bestD > HEAL_GAP) continue
            const n = path[atStart ? 1 : path.length - 2]
            const straight = n[0] === ex || n[1] === ez
            const moved =
                straight && n[0] !== best[0] && n[1] !== best[1]
                    ? [n[1] === ez ? [best[0], n[1]] : [n[0], best[1]], best]
                    : [best]
            if (atStart) path.splice(0, 1, ...moved.reverse())
            else path.splice(end, 1, ...moved)
        }
    })
    return out
}

/* Join paths that meet end to end into one and re-smooth, so a road saved in pieces
   becomes one path with only its corners. Same as joinPaths on the website. */
function joinPaths(paths) {
    let out = paths
    for (let joined = true; joined; ) {
        joined = false
        const ends = new Map()
        out.forEach((p, i) => {
            for (const [x, z] of [p[0], p[p.length - 1]]) {
                const k = x + ',' + z
                ends.set(k, [...(ends.get(k) || []), i])
            }
        })
        const used = new Set()
        const next = []
        for (const [key, at] of ends) {
            const [i, j] = at.filter((k, n) => !used.has(k) && at.indexOf(k) === n)
            if (j === undefined) continue
            const meet = (p) => p[0][0] + ',' + p[0][1] === key
            const a = meet(out[i]) ? [...out[i]].reverse() : out[i]
            const b = meet(out[j]) ? out[j] : [...out[j]].reverse()
            next.push(clean([...a, ...b.slice(1)]))
            used.add(i).add(j)
            joined = true
        }
        out = [...next, ...out.filter((_, i) => !used.has(i))]
    }
    return out
}

layer.paths = joinPaths(healGaps(layer.paths.map(clean)))
layer.paths.forEach(markPath)

let current = [] // the stretch being recorded
let prev = null // last position on the road, mapped or not
/* Write the file as if the stretch so far had ended, without ending it: a crash loses at
   most SAVE_EVERY points, and the road stays one unbroken path. */
function saveInProgress() {
    const paths = joinPaths(healGaps([...layer.paths, clean(current)]))
    save({ ...file, layers: file.layers.map((l) => (l === layer ? { ...l, paths } : l)) })
}

function finish() {
    const path = clean(current)
    current = []
    const length = lengthOf(path)
    if (path.length < 2 || length < MIN_LENGTH) return
    layer.paths = joinPaths(healGaps([...layer.paths, path]))
    layer.updated = Date.now()
    markPath(path)
    save()
    const total = layer.paths.reduce((sum, p) => sum + lengthOf(p), 0)
    Chat.log('§b[Ice Roads]§r +' + Math.round(length) + ' blocks mapped (' + Math.round(total) + ' total)')
}

// ── Main loop ────────────────────────────────────────────
/* Your own block position, or null when there is no player yet or you are above BELOW_Y. */
function position() {
    const player = Player.getPlayer()
    if (!player || player.getY() >= BELOW_Y) return null
    return [Math.floor(player.getX()), Math.floor(player.getZ())]
}

function quitPressed() {
    const keys = KeyBind.getPressedKeys()
    return (
        keys.contains(QUIT_KEY) &&
        (keys.contains('key.keyboard.left.shift') || keys.contains('key.keyboard.right.shift'))
    )
}

/* True when the step to `at` heads back the way the stretch was going over its last few
   blocks: you reached a dead end and turned round. */
function turnedAround(at) {
    const last = current[current.length - 1]
    let i = current.length - 2
    while (i >= 0 && Math.hypot(last[0] - current[i][0], last[1] - current[i][1]) < TURN_LOOKBACK) i--
    if (i < 0) return false
    const u = [last[0] - current[i][0], last[1] - current[i][1]]
    const v = [at[0] - last[0], at[1] - last[1]]
    const len = Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1])
    return len > 0 && (u[0] * v[0] + u[1] * v[1]) / len < -0.7
}

function tick() {
    const at = position()
    if (!at) {
        finish()
        prev = null
        return
    }
    const [x, z] = at
    /* A jump this big is a teleport or a respawn, not a road. */
    if (prev && Math.hypot(x - prev[0], z - prev[1]) > 50) {
        finish()
        prev = null
    }

    if (isKnown(x, z)) {
        /* Back on mapped road: close the stretch where it rejoins. */
        if (current.length) {
            current.push(at)
            finish()
        }
    } else {
        /* New road: start from where it left the mapped road, so it connects. */
        if (!current.length) current.push(prev || at)
        const last = current[current.length - 1]
        if (turnedAround(at)) {
            /* A dead end: save the way out up to here. It now counts as mapped, so the
               way back is skipped instead of drawn over it a second time. */
            finish()
        } else if (x !== last[0] || z !== last[1]) current.push(at)
        if (current.length && current.length % SAVE_EVERY === 0) saveInProgress()
    }
    prev = at
}

Chat.log(
    '§b[Ice Roads]§r Mapping "' + layer.name + '" (' + layer.paths.length + ' paths so far). ' +
        'Recording below Y ' + BELOW_Y + '; Shift+I to stop.'
)
try {
    while (!quitPressed()) {
        tick()
        Client.waitTick(1)
    }
} finally {
    finish()
    save()
    Chat.log('§b[Ice Roads]§r Stopped. Upload iceroads.json at nara.rocks/iceroads')
}
