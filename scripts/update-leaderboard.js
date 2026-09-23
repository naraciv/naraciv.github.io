const fs = require('fs')
const path = require('path')
// Node 22.18+ strips the types, so the script shares the site's parsers and session maths.
const { parseLeaderboard, topPlayers } = require('../packages/lib/src/players.ts')
const { history } = require('../packages/lib/src/playtime.ts')

const HOUR = 60 * 60 * 1000
const BATCH = 10
const RETRIES = 3
const dataDir = path.join(__dirname, '../data')
const csvPath = path.join(dataDir, 'leaderboard.csv')

// civinfo only answers nara.rocks; since July 2026 a request without this Origin and Referer
// gets a 403. Sending them from the job is what civinfo told us to do.
const fetchOptions = {
  headers: {
    'User-Agent': 'nara.rocks/stats leaderboard updater',
    Origin: 'https://nara.rocks',
    Referer: 'https://nara.rocks/',
  },
}

const now = Date.now()
const windows = { weekly: now - 7 * 24 * HOUR, monthly: now - 30 * 24 * HOUR, allTime: 0 }

// Completed sessions, plus the open one up to now — history() already drops an open session
// older than a day, since civinfo misses some logouts.
async function playtime(username) {
  const res = await fetch(
    `https://api.civinfo.net/mc-sessions/all?mcName=${encodeURIComponent(username)}`,
    fetchOptions,
  )
  if (!res.ok) throw new Error(`sessions ${res.status}`)
  const { sessions, onlineSince } = history(await res.json(), now)
  if (onlineSince) sessions.push({ login: onlineSince, logout: now })

  const totals = { username, weekly: 0, monthly: 0, allTime: 0 }
  for (const { login, logout } of sessions)
    for (const [period, from] of Object.entries(windows))
      totals[period] += Math.max(0, logout - Math.max(login, from))
  return totals
}

async function main() {
  console.log('Fetching active player list...')
  const response = await fetch('https://api.civinfo.net/mc-accounts/all?limit=100000', fetchOptions)
  if (!response.ok) throw new Error(`Failed to fetch player list: ${response.status}`)
  // Parallel arrays, one entry per account.
  const {
    mcNames = [],
    uuids = [],
    lastLoginTimestamps = [],
    lastLogoutTimestamps = [],
  } = await response.json()

  // Every spelling + UUID, for case-insensitive profile lookup. First spelling wins.
  const seenNames = new Map()
  mcNames.forEach((name, i) => {
    if (name && !seenNames.has(name.toLowerCase()))
      seenNames.set(name.toLowerCase(), [name, uuids[i] || null])
  })
  const sortedEntries = [...seenNames].sort(([a], [b]) => a.localeCompare(b)).map(([, e]) => e)
  fs.mkdirSync(dataDir, { recursive: true })
  fs.writeFileSync(
    path.join(dataDir, 'player_names.json'),
    JSON.stringify(Object.fromEntries(sortedEntries), null, 2),
  )
  console.log(`Saved ${sortedEntries.length} unique player names + UUIDs to data/player_names.json`)

  // Anyone active in the past week, plus the previous top 20 monthly and all-time.
  const users = new Set(
    mcNames.filter(
      (name, i) =>
        name &&
        ((lastLoginTimestamps[i] || 0) > windows.weekly ||
          (lastLogoutTimestamps[i] || now) > windows.weekly),
    ),
  )
  const previousRows = new Map()
  if (fs.existsSync(csvPath)) {
    const rows = parseLeaderboard(fs.readFileSync(csvPath, 'utf8'))
    rows.forEach((r) => previousRows.set(r.username, r))
    for (const period of ['monthly', 'allTime'])
      topPlayers(rows, period, 20).forEach((r) => users.add(r.username))
  }

  const stats = {}
  let queue = [...users]
  console.log(`Found ${queue.length} players to fetch.`)
  for (let attempt = 0; attempt <= RETRIES && queue.length; attempt++) {
    if (attempt) {
      console.log(`Retry ${attempt}/${RETRIES} for ${queue.length} users...`)
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    const failed = []
    for (let i = 0; i < queue.length; i += BATCH) {
      const batch = queue.slice(i, i + BATCH)
      const results = await Promise.allSettled(batch.map(playtime))
      results.forEach((result, j) => {
        if (result.status === 'rejected') failed.push(batch[j])
        else if (result.value.allTime > 0) stats[batch[j]] = result.value
      })
      if (!attempt) console.log(`[${Math.min(i + BATCH, queue.length)}/${queue.length}] Processed`)
    }
    queue = failed
  }

  // Keep the previous numbers for anyone still failing instead of dropping them: a player
  // not active this week would never be fetched again and would vanish from the board.
  if (queue.length) console.log(`⚠ ${queue.length} users still failed: ${queue.join(', ')}`)
  for (const username of queue) {
    const r = previousRows.get(username)
    if (r)
      stats[username] = {
        username,
        weekly: r.weekly * HOUR,
        monthly: r.monthly * HOUR,
        allTime: r.allTime * HOUR,
      }
  }

  if (Object.keys(stats).length === 0)
    throw new Error('No player stats fetched; keeping the old CSV.')

  // Usernames are [A-Za-z0-9_], so no field needs quoting. CRLF, no trailing newline:
  // the format the committed file has always had, so a run diffs only changed rows.
  const hours = (ms) => (ms / HOUR).toFixed(1)
  const rows = Object.values(stats)
    .sort((a, b) => hours(b.weekly) - hours(a.weekly))
    .map((s) => [s.username, hours(s.weekly), hours(s.monthly), hours(s.allTime)].join(','))
  fs.writeFileSync(csvPath, ['Username,Weekly,Monthly,AllTime', ...rows].join('\n'))
  console.log(`Leaderboard updated successfully with ${rows.length} players.`)
}

main().catch((error) => {
  console.error('Fatal error:', error.message)
  process.exit(1)
})
