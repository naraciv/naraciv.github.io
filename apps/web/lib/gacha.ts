/**
 * The gacha backend client: endpoints, localStorage keys and the three-attempt
 * quiz ladder. Changing a storage key discards every visitor's collection.
 *
 * The browser talks to the Cloudflare Worker at /api/gacha/*, a same-origin
 * path on nara.rocks. Where the Worker does not share the site's origin, set
 * NEXT_PUBLIC_GACHA_URL to its absolute URL.
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_GACHA_URL ?? '/api/gacha'

const GACHA_COLLECTION = 'nara_gacha_collection'
const GACHA_LAST_PULL = 'nara_gacha_last_pull'
const GACHA_QUIZ_RESET = 'nara_gacha_quiz_reset'
const GACHA_QUIZ_FAILED = 'nara_gacha_quiz_failed'

export const QUIZ_MAX_PER_DAY = 3
const QUIZ_DIFFICULTY_ORDER = ['easy', 'medium', 'hard'] as const
export type Difficulty = (typeof QUIZ_DIFFICULTY_ORDER)[number]

export type RarityKey = 'LEGENDARY' | 'EPIC' | 'RARE' | 'UNCOMMON' | 'COMMON'

export const RARITY: Record<
  RarityKey,
  { label: string; color: string; glow: string; stars: number; bg: string }
> = {
  LEGENDARY: {
    label: 'Legendary',
    color: '#FF6B35',
    glow: 'rgba(255,107,53,0.6)',
    stars: 5,
    bg: 'linear-gradient(135deg,#FF6B35 0%,#F7C948 100%)',
  },
  EPIC: {
    label: 'Epic',
    color: '#E040FB',
    glow: 'rgba(224,64,251,0.6)',
    stars: 4,
    bg: 'linear-gradient(135deg,#E040FB 0%,#7C4DFF 100%)',
  },
  RARE: {
    label: 'Rare',
    color: '#00BCD4',
    glow: 'rgba(0,188,212,0.6)',
    stars: 3,
    bg: 'linear-gradient(135deg,#00BCD4 0%,#26C6DA 100%)',
  },
  UNCOMMON: {
    label: 'Uncommon',
    color: '#78909C',
    glow: 'rgba(120,144,156,0.4)',
    stars: 2,
    bg: 'linear-gradient(135deg,#78909C 0%,#546E7A 100%)',
  },
  COMMON: {
    label: 'Common',
    color: '#78909C',
    glow: 'rgba(120,144,156,0.4)',
    stars: 1,
    bg: 'linear-gradient(135deg,#78909C 0%,#546E7A 100%)',
  },
}

/** Best first, as /collect sorts and filters them. */
export const RARITY_ORDER: RarityKey[] = ['LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON']

export type Naran = {
  id: string
  name: string
  title: string
  description: string
  rarity: RarityKey
}

/** `firstPulled` is an ISO timestamp the backend records; older entries may lack it. */
export type Collection = Record<string, { count: number; firstPulled?: string }>

export type QuizQuestion = {
  id: string
  question: string
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'date'
  options?: string[]
}

const today = () => new Date().toISOString().slice(0, 10)

/** localStorage throws in some privacy modes; never let that break the page. */
function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}
function remove(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export async function fetchNarans(): Promise<Naran[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/narans`, { credentials: 'include' })
    if (res.ok) return await res.json()
  } catch {
    /* fall through */
  }
  console.warn('[nara] Could not load narans from the gacha backend.')
  return []
}

export type GachaState = { collection: Collection; lastPull: string }

export async function fetchState(): Promise<GachaState> {
  try {
    const res = await fetch(`${BACKEND_URL}/state`, { credentials: 'include' })
    if (res.ok) {
      const state: GachaState = await res.json()
      write(GACHA_COLLECTION, JSON.stringify(state.collection ?? {}))
      if (state.lastPull) write(GACHA_LAST_PULL, state.lastPull)
      return { collection: state.collection ?? {}, lastPull: state.lastPull ?? '' }
    }
  } catch {
    /* fall through */
  }
  return { collection: {}, lastPull: '' }
}

export async function pull(): Promise<{ pick: Naran; collection: Collection }> {
  const res = await fetch(`${BACKEND_URL}/pull`, { method: 'POST', credentials: 'include' })
  const data = await res.json()
  if (!res.ok) throw data
  write(GACHA_COLLECTION, JSON.stringify(data.collection))
  write(GACHA_LAST_PULL, today())
  return data
}

export async function fetchQuestion(difficulty: Difficulty): Promise<QuizQuestion | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/question?difficulty=${difficulty}`, {
      credentials: 'include',
    })
    if (res.ok) return await res.json()
  } catch {
    /* fall through */
  }
  return null
}

export async function submitAnswer(
  id: string,
  answer: unknown,
): Promise<{ correct: boolean; explanation: string }> {
  const res = await fetch(`${BACKEND_URL}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ id, answer }),
  })
  return await res.json()
}

export const canPullToday = (lastPull: string) => lastPull !== today()

export function hasEverPulled(collection: Collection) {
  return !!read(GACHA_LAST_PULL) || Object.keys(collection).length > 0
}

export function resetPullTimer() {
  remove(GACHA_LAST_PULL)
}

export function getQuizCountToday(): number {
  try {
    const raw = read(GACHA_QUIZ_RESET)
    if (!raw) return 0
    const data = JSON.parse(raw)
    return data.date === today() ? data.count || 0 : 0
  } catch {
    return 0
  }
}

export function markQuizUsed() {
  write(GACHA_QUIZ_RESET, JSON.stringify({ date: today(), count: getQuizCountToday() + 1 }))
}

export const hasUsedQuizToday = () => getQuizCountToday() >= QUIZ_MAX_PER_DAY

export const getNextQuizDifficulty = (): Difficulty =>
  QUIZ_DIFFICULTY_ORDER[getQuizCountToday()] ?? 'hard'

export const quizFailedToday = () => read(GACHA_QUIZ_FAILED) === today()

export const markQuizFailed = () => write(GACHA_QUIZ_FAILED, today())

export const starString = (rarity: RarityKey) =>
  '★'.repeat(RARITY[rarity].stars) + '☆'.repeat(5 - RARITY[rarity].stars)

export const getSkinUrl = (username: string, type: 'body' | 'head' = 'body') =>
  type === 'head'
    ? `https://mc-heads.net/avatar/${username}/80`
    : `https://mc-heads.net/body/${username}/150`

/** Seconds until local midnight, formatted HH:MM:SS. */
export function timeUntilMidnight(): string {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  const diff = tomorrow.getTime() - now.getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}
