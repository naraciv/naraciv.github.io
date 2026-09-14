const fs = require('fs')
const path = require('path')
// Node 22.18+ strips the types, so the script shares the site's parser.
const { parseLeaderboard, topPlayers } = require('../packages/lib/src/players.ts')

const HOUR = 60 * 60 * 1000

// civinfo only answers nara.rocks; since July 2026 a request without this Origin and Referer
// gets a 403. Sending them from the job is what civinfo told us to do.
const fetchOptions = {
  headers: {
    'User-Agent': 'nara.rocks/stats leaderboard updater',
    Origin: 'https://nara.rocks',
    Referer: 'https://nara.rocks/',
  },
}

async function main() {
  try {
    console.log('Fetching active player list...')
    // Step 1: Get list of players from the mc-accounts endpoint
    const response = await fetch(
      'https://api.civinfo.net/mc-accounts/all?limit=100000',
      fetchOptions,
    )
    if (!response.ok) throw new Error(`Failed to fetch player list: ${response.status}`)

    const data = await response.json()

    // API format: parallel arrays with account info
    const names = data.mcNames || []

    // Save all player names + UUIDs for case-sensitivity spell checking
    const uuids = data.uuids || []
    const seenNames = new Map() // lowercase -> [name, uuid], first spelling wins
    names.forEach((name, i) => {
      if (name && !seenNames.has(name.toLowerCase()))
        seenNames.set(name.toLowerCase(), [name, uuids[i] || null])
    })
    const sortedEntries = [...seenNames].sort(([a], [b]) => a.localeCompare(b)).map(([, e]) => e)
    const dataDir = path.join(__dirname, '../data')

    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(
      path.join(dataDir, 'player_names.json'),
      JSON.stringify(Object.fromEntries(sortedEntries), null, 2),
    )
    console.log(
      `Saved ${sortedEntries.length} unique player names + UUIDs to data/player_names.json`,
    )
    const lastLogins = data.lastLoginTimestamps || []
    const lastLogouts = data.lastLogoutTimestamps || []

    const now = Date.now()
    const oneWeekAgo = now - 7 * 24 * HOUR
    const oneMonthAgo = now - 30 * 24 * HOUR

    // Extract unique usernames who have been active in the past week
    const uniqueUsers = new Set()
    for (let i = 0; i < names.length; i++) {
      const lastLogin = lastLogins[i] || 0
      const lastLogout = lastLogouts[i] || now
      const username = names[i]

      // Only include players who have been active in the past week
      if (lastLogin > oneWeekAgo || lastLogout > oneWeekAgo) {
        if (username) uniqueUsers.add(username)
      }
    }

    // Add anyone in top 20 for monthly or all-time just in case from current csv
    const currentCsvPath = path.join(__dirname, '../data/leaderboard.csv')
    const previousRows = new Map()
    if (fs.existsSync(currentCsvPath)) {
      const rows = parseLeaderboard(fs.readFileSync(currentCsvPath, 'utf8'))
      rows.forEach((r) => previousRows.set(r.username, r))
      for (const period of ['monthly', 'allTime'])
        topPlayers(rows, period, 20).forEach((r) => uniqueUsers.add(r.username))
    }

    const usersArray = Array.from(uniqueUsers)
    console.log(
      `Found ${usersArray.length} unique players active in the last week. Fetching details...`,
    )

    const stats = {}
    let processedCount = 0
    const failedUsers = []

    // Worker function to process a single user
    // Completed sessions, plus an open one up to now if it began within a day —
    // civinfo misses some logouts, so anything older is not really still going.
    const processUser = async (username) => {
      try {
        const historyRes = await fetch(
          `https://api.civinfo.net/mc-sessions/all?mcName=${encodeURIComponent(username)}`,
          fetchOptions,
        )

        if (!historyRes.ok) {
          return { success: false, username }
        }

        const history = await historyRes.json()
        const logins = history.loginTimestamps || []
        const logouts = history.logoutTimestamps || []

        let weekly = 0
        let monthly = 0
        let allTime = 0

        const pairs = Math.min(logins.length, logouts.length)
        for (let i = 0; i < pairs; i++) {
          const li = logins[i]
          const lo = logouts[i] ?? (now - li < 24 * HOUR ? now : null)
          if (!li || lo === null) continue

          const start = li
          const end = lo
          if (end <= start) continue

          const duration = end - start
          allTime += duration

          // Weekly overlap
          const weekStart = Math.max(start, oneWeekAgo)
          const weekEnd = Math.min(end, now)
          if (weekEnd > weekStart) {
            weekly += weekEnd - weekStart
          }

          // Monthly overlap
          const monthStart = Math.max(start, oneMonthAgo)
          const monthEnd = Math.min(end, now)
          if (monthEnd > monthStart) {
            monthly += monthEnd - monthStart
          }
        }

        if (allTime > 0) {
          return { success: true, username, weekly, monthly, allTime }
        }
        return { success: true, username, noData: true }
      } catch (err) {
        console.error(`Error processing ${username}:`, err.message)
        return { success: false, username }
      }
    }

    // Process in chunks to control concurrency (approx 10 threads)
    const chunkSize = 10
    for (let i = 0; i < usersArray.length; i += chunkSize) {
      const chunk = usersArray.slice(i, i + chunkSize)
      const promises = chunk.map((username) => processUser(username))

      const results = await Promise.all(promises)

      results.forEach((result) => {
        if (result.success && !result.noData) {
          stats[result.username] = result
        } else if (!result.success) {
          failedUsers.push(result.username)
        }
        processedCount++
      })

      if (processedCount % 20 === 0 || processedCount === usersArray.length) {
        console.log(`[${processedCount}/${usersArray.length}] Processed`)
      }
    }

    // Retry failed users
    if (failedUsers.length > 0) {
      console.log(`\nRetrying ${failedUsers.length} failed users...`)
      const maxRetries = 3
      let retryQueue = [...failedUsers]

      for (let attempt = 1; attempt <= maxRetries && retryQueue.length > 0; attempt++) {
        console.log(`Retry attempt ${attempt}/${maxRetries} for ${retryQueue.length} users...`)
        const stillFailed = []

        // Add a small delay before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000))

        for (let i = 0; i < retryQueue.length; i += chunkSize) {
          const chunk = retryQueue.slice(i, i + chunkSize)
          const promises = chunk.map((username) => processUser(username))

          const results = await Promise.all(promises)

          results.forEach((result) => {
            if (result.success && !result.noData) {
              stats[result.username] = result
              console.log(`  ✓ Successfully retried: ${result.username}`)
            } else if (!result.success) {
              stillFailed.push(result.username)
            }
          })
        }

        retryQueue = stillFailed
      }

      if (retryQueue.length > 0) {
        console.log(`\n⚠ ${retryQueue.length} users still failed after ${maxRetries} retries:`)
        retryQueue.forEach((u) => console.log(`  - ${u}`))
      }

      // Keep the previous numbers for anyone still failing instead of dropping them: a player
      // not active this week would never be fetched again and would vanish from the board.
      retryQueue.forEach((username) => {
        const r = previousRows.get(username)
        if (r)
          stats[username] = {
            username,
            weekly: r.weekly * HOUR,
            monthly: r.monthly * HOUR,
            allTime: r.allTime * HOUR,
          }
      })
    }

    if (Object.keys(stats).length === 0)
      throw new Error('No player stats fetched; keeping the old CSV.')

    // Usernames are [A-Za-z0-9_], so no field needs quoting. CRLF, no trailing newline:
    // the format the committed file has always had, so a run diffs only changed rows.
    const hours = (ms) => (ms / HOUR).toFixed(1)
    const rows = Object.values(stats)
      .sort((a, b) => hours(b.weekly) - hours(a.weekly))
      .map((s) => [s.username, hours(s.weekly), hours(s.monthly), hours(s.allTime)].join(','))
    const csv = ['Username,Weekly,Monthly,AllTime', ...rows].join('\r\n')

    fs.writeFileSync(path.join(dataDir, 'leaderboard.csv'), csv)
    console.log(`Leaderboard updated successfully with ${rows.length} players.`)
  } catch (error) {
    console.error('Fatal error:', error.message)
    process.exit(1)
  }
}

main()
