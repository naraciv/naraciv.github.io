import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  duration,
  mergeAccounts,
  parseLeaderboard,
  playersFromSessions,
  sortPlayers,
  topPlayers,
} from './players.ts'

const HOUR = 3_600_000
const now = 1_000 * HOUR

test('an open session is online, unless it has been open a day or more', () => {
  const players = playersFromSessions(
    {
      mcNames: ['fresh', 'stale', 'left'],
      loginTimestamps: [now - 2 * HOUR, now - 30 * HOUR, now - 5 * HOUR],
      logoutTimestamps: [null, null, now - 4 * HOUR],
    },
    now,
  )
  assert.equal(players.get('fresh')!.isOnline, true)
  assert.equal(players.get('stale')!.isOnline, false)
  assert.equal(players.get('left')!.isOnline, false)
  assert.equal(players.get('left')!.logoutTime, now - 4 * HOUR)
})

test("a player's latest session wins, whatever order the API returns them in", () => {
  const players = playersFromSessions(
    {
      mcNames: ['a', 'a'],
      loginTimestamps: [now - 1 * HOUR, now - 9 * HOUR],
      logoutTimestamps: [null, now - 8 * HOUR],
    },
    now,
  )
  assert.equal(players.get('a')!.isOnline, true)
})

test('accounts add unseen players and replace older session data', () => {
  const players = playersFromSessions(
    {
      mcNames: ['known', 'stale', 'current'],
      loginTimestamps: [now - 10 * HOUR, now - 2000 * HOUR, now - 3 * HOUR],
      logoutTimestamps: [now - 9 * HOUR, null, null],
    },
    now,
  )
  mergeAccounts(
    players,
    {
      mcNames: ['known', 'stale', 'current', 'new', null],
      lastLoginTimestamps: [now - 1 * HOUR, now - 30 * HOUR, now - 3 * HOUR, now - 50 * HOUR, 1],
      lastLogoutTimestamps: [now - 2 * HOUR, now - 29 * HOUR, now - 20 * HOUR, now - 49 * HOUR, 0],
    },
    now,
  )
  assert.equal(players.get('known')!.isOnline, true)
  /* A never-closed session from months ago; the account knows they left yesterday. */
  assert.equal(players.get('stale')!.logoutTime, now - 29 * HOUR)
  assert.equal(players.get('current')!.isOnline, true)
  assert.equal(players.get('new')!.isOnline, false)
  assert.equal(players.size, 4)
})

test('online players sort first by time online, offline by most recently seen', () => {
  const p = (username: string, isOnline: boolean, loginTime: number, logoutTime = loginTime) => ({
    username,
    isOnline,
    loginTime,
    logoutTime,
  })
  const order = sortPlayers([
    p('off-old', false, 1, 1),
    p('on-new', true, 50),
    p('off-new', false, 5, 9),
    p('on-old', true, 10),
  ]).map((x) => x.username)
  assert.deepEqual(order, ['on-old', 'on-new', 'off-new', 'off-old'])
  assert.equal(duration(3 * HOUR + 12 * 60_000), '3h 12m')
})

test('the committed leaderboard parses and ranks', () => {
  const rows = parseLeaderboard(
    readFileSync(new URL('../../../data/leaderboard.csv', import.meta.url), 'utf8'),
  )
  assert.ok(rows.length > 1000)
  const top = topPlayers(rows, 'allTime')
  assert.equal(top.length, 10)
  assert.ok(top[0].allTime >= top[9].allTime)
})
