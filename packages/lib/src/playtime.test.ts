/* Local-time maths below must not depend on the machine running the tests. */
process.env.TZ = 'UTC'

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  activityWeeks,
  addLocalDays,
  dailySeries,
  dailyTotals,
  heatColor,
  heatmap,
  history,
  localWeekStart,
  logOnChance,
  monthlyTotals,
  monthTicks,
  summary,
  weeklySeries,
  weekStartsSunday,
} from './playtime.ts'

const H = 3_600_000
const at = (iso: string) => Date.parse(iso)

test('history keeps completed sessions and notices an open one', () => {
  const data = {
    mcNames: [],
    loginTimestamps: [at('2026-09-01T10:00Z'), at('2026-09-03T08:00Z'), at('2026-09-02T09:00Z')],
    logoutTimestamps: [at('2026-09-01T12:00Z'), null, at('2026-09-02T09:30Z')],
  }
  const h = history(data, at('2026-09-03T09:00Z'))
  /* civinfo missed the logout: two days on, they are not still online. */
  assert.equal(history(data, at('2026-09-05T09:00Z')).onlineSince, null)
  assert.equal(h.sessions.length, 2)
  assert.equal(h.sessions[0].login, at('2026-09-01T10:00Z'))
  assert.equal(h.onlineSince, at('2026-09-03T08:00Z'))
  assert.equal(h.lastLogout, at('2026-09-02T09:30Z'))
  const s = summary(h, at('2026-09-03T09:00Z'))
  assert.equal(s.totalHours, 2.5)
  assert.equal(s.lastSeen, at('2026-09-03T09:00Z'))
})

test('a session across midnight counts on both days, and weeks start on Monday', () => {
  const sessions = [{ login: at('2026-09-06T23:00Z'), logout: at('2026-09-07T02:00Z') }]
  const daily = dailyTotals(sessions)
  assert.deepEqual(dailySeries(daily), [
    { date: at('2026-09-06T00:00Z'), hours: 1 },
    { date: at('2026-09-07T00:00Z'), hours: 2 },
  ])
  /* 6 Sep 2026 is a Sunday, so its hour belongs to the week of Monday 31 Aug. */
  assert.deepEqual(weeklySeries(daily), [
    { date: at('2026-08-31T00:00Z'), hours: 1 },
    { date: at('2026-09-07T00:00Z'), hours: 2 },
  ])
  assert.deepEqual([...monthlyTotals(sessions)], [['2026-09', 3]])
})

test('the heatmap splits a session at hour boundaries', () => {
  const grid = heatmap([{ login: at('2026-09-07T10:30Z'), logout: at('2026-09-07T12:15Z') }])
  /* Monday = 1 */
  assert.equal(grid[1][10], 30)
  assert.equal(grid[1][11], 60)
  assert.equal(grid[1][12], 15)
})

test('log-on chance only counts weeks with five hours or more', () => {
  const long = { login: at('2026-09-07T10:00Z'), logout: at('2026-09-07T16:00Z') }
  const short = { login: at('2026-09-14T10:00Z'), logout: at('2026-09-14T11:00Z') }
  const { grid, weeks } = logOnChance([long, short])
  assert.equal(weeks, 1)
  assert.equal(grid[1][10], 100)
  assert.equal(grid[1][16], 0)
})

test('activity weeks follow the viewer: Sunday start in US zones, ongoing time included', () => {
  assert.equal(weekStartsSunday('America/Chicago'), true)
  assert.equal(weekStartsSunday('Europe/London'), false)
  const h = {
    sessions: [{ login: at('2026-09-08T10:00Z'), logout: at('2026-09-08T11:00Z') }],
    onlineSince: at('2026-09-09T10:00Z'),
    lastLogout: null,
  }
  const [week] = activityWeeks(h, false, at('2026-09-09T12:00Z'))
  assert.equal(week.start, at('2026-09-07T00:00Z'))
  assert.equal(week.totalMs, 3 * H)

  /* Sunday 23:00 to Monday 02:00 shows in both weeks, split by the boundary. */
  const late = { login: at('2026-09-06T23:00Z'), logout: at('2026-09-07T02:00Z') }
  const split = activityWeeks({ sessions: [late], onlineSince: null, lastLogout: null }, false, 0)
  assert.deepEqual(
    split.map((w) => [w.totalMs / H, w.sessions.length]),
    [
      [1, 1],
      [2, 1],
    ],
  )
})

test('local days and weeks survive a DST change', () => {
  const zone = process.env.TZ
  process.env.TZ = 'Europe/London'
  /* Clocks go back on 25 Oct 2026: that Monday-start week is 169 hours long. */
  const start = localWeekStart(at('2026-10-28T12:00Z'), false)
  assert.equal(start, at('2026-10-26T00:00Z'))
  assert.equal(addLocalDays(at('2026-10-19T00:00+01:00'), 7), at('2026-10-26T00:00Z'))
  assert.equal(
    addLocalDays(at('2026-10-19T00:00+01:00'), 7) - at('2026-10-19T00:00+01:00'),
    169 * H,
  )
  process.env.TZ = zone
})

test('colours and ticks', () => {
  assert.equal(heatColor(0, 10), 'rgba(55, 65, 81, 0.3)')
  assert.equal(heatColor(10, 10), 'hsla(0, 75%, 60%, 1)')
  assert.deepEqual(monthTicks(at('2026-01-15T00:00Z'), at('2026-04-02T00:00Z')), [
    at('2026-02-01T00:00Z'),
    at('2026-03-01T00:00Z'),
    at('2026-04-01T00:00Z'),
  ])
})
