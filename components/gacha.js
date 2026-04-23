/**
 * Collect-a-Naran — Gacha System
 * Shared module for the gacha machine, cookie storage, and Naran data.
 * Character data is loaded from /data/narans.json
 */

const GACHA_COOKIE = 'nara_gacha_collection';
const GACHA_LAST_PULL = 'nara_gacha_last_pull';
const GACHA_QUIZ_RESET = 'nara_gacha_quiz_reset';

/* ── Rarity tiers (bright color scheme) ─────────────────── */
const RARITY = {
  LEGENDARY: { label: 'Legendary',  color: '#FF6B35', glow: 'rgba(255,107,53,0.6)',  chance: 0.02, stars: 5, bg: 'linear-gradient(135deg,#FF6B35 0%,#F7C948 100%)' },
  EPIC:      { label: 'Epic',       color: '#E040FB', glow: 'rgba(224,64,251,0.6)', chance: 0.08, stars: 4, bg: 'linear-gradient(135deg,#E040FB 0%,#7C4DFF 100%)' },
  RARE:      { label: 'Rare',       color: '#00BCD4', glow: 'rgba(0,188,212,0.6)', chance: 0.15, stars: 3, bg: 'linear-gradient(135deg,#00BCD4 0%,#26C6DA 100%)' },
  UNCOMMON:    { label: 'Uncommon',     color: '#78909C', glow: 'rgba(120,144,156,0.4)',chance: 0.25, stars: 2, bg: 'linear-gradient(135deg,#78909C 0%,#546E7A 100%)' },
  COMMON:    { label: 'Common',     color: '#78909C', glow: 'rgba(120,144,156,0.4)',chance: 0.50, stars: 1, bg: 'linear-gradient(135deg,#78909C 0%,#546E7A 100%)' },

};

/* ── Config ──────────────────────────────────────── */
const BACKEND_URL = '/api/gacha';

/* ── Naran roster (loaded async from backend) ────────── */
let NARANS = [];

/* ── Load NARANS from backend ───────────────────────────────── */
async function loadNarans() {
  if (NARANS.length > 0) return NARANS;
  try {
    const res = await fetch(`${BACKEND_URL}/narans`, { credentials: 'include' });
    if (res.ok) {
      NARANS = await res.json();
      if (window.GachaNara) window.GachaNara.NARANS = NARANS;
      return NARANS;
    }
  } catch {}
  console.warn('Could not load narans from backend');
  return NARANS;
}

// Start loading immediately
const _naransReady = loadNarans();

/* ── Skin URL helper ─────────────────────────────────────── */
function getSkinUrl(username, type = 'body') {
  if (type === 'body') return `https://mc-heads.net/body/${username}/150`;
  if (type === 'head') return `https://mc-heads.net/avatar/${username}/80`;
  return `https://mc-heads.net/body/${username}/150`;
}

/* ── State variables ──────────────────────────────────────── */
let backendState = { collection: {}, lastPull: '' };

async function fetchState() {
  try {
    const res = await fetch(`${BACKEND_URL}/state`, { credentials: 'include' });
    if (res.ok) {
      backendState = await res.json();
      localStorage.setItem(GACHA_COOKIE, JSON.stringify(backendState.collection));
      if (backendState.lastPull) localStorage.setItem(GACHA_LAST_PULL, backendState.lastPull);
    }
  } catch {}
}

// Start loading
const _stateReady = fetchState();

/* ── Cookie helpers (now mirrored to backend) ──────────────────────────────────────── */
function getCollection() {
  return backendState.collection || {};
}

function saveCollection(collection) {
  backendState.collection = collection;
  localStorage.setItem(GACHA_COOKIE, JSON.stringify(collection));
}

function getLastPullDate() {
  return backendState.lastPull || '';
}

function setLastPullDate() {
  const today = new Date().toISOString().slice(0, 10);
  backendState.lastPull = today;
  localStorage.setItem(GACHA_LAST_PULL, today);
}

function canPullToday() {
  const today = new Date().toISOString().slice(0, 10);
  return getLastPullDate() !== today;
}

/* ── Quiz reset (allows up to 3 per day) ─────────────── */
const QUIZ_MAX_PER_DAY = 3;
const QUIZ_DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];

function resetPullTimer() {
  localStorage.removeItem(GACHA_LAST_PULL);
  backendState.lastPull = '';
}

function getQuizCountToday() {
  try {
    const raw = localStorage.getItem(GACHA_QUIZ_RESET);
    if (!raw) return 0;
    const data = JSON.parse(raw);
    const today = new Date().toISOString().slice(0, 10);
    return data.date === today ? (data.count || 0) : 0;
  } catch { return 0; }
}

function incrementQuizCount() {
  const today = new Date().toISOString().slice(0, 10);
  const count = getQuizCountToday() + 1;
  localStorage.setItem(GACHA_QUIZ_RESET, JSON.stringify({ date: today, count }));
}

function hasUsedQuizToday() {
  return getQuizCountToday() >= QUIZ_MAX_PER_DAY;
}

function markQuizUsed() {
  incrementQuizCount();
}

function getNextQuizDifficulty() {
  const count = getQuizCountToday();
  return QUIZ_DIFFICULTY_ORDER[count] || 'hard';
}

function hasEverPulled() {
  return !!localStorage.getItem(GACHA_LAST_PULL) || Object.keys(getCollection()).length > 0;
}

/* ── Quiz failed state (persists until next day) ──── */
const GACHA_QUIZ_FAILED = 'nara_gacha_quiz_failed';

function quizFailedToday() {
  try {
    const raw = localStorage.getItem(GACHA_QUIZ_FAILED);
    if (!raw) return false;
    const today = new Date().toISOString().slice(0, 10);
    return raw === today;
  } catch { return false; }
}

function markQuizFailed() {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(GACHA_QUIZ_FAILED, today);
}

/* ── Async random pull ────────────────────────────────── */
async function pullNaranAsync() {
  const res = await fetch(`${BACKEND_URL}/pull`, { method: 'POST', credentials: 'include' });
  const data = await res.json();
  if (!res.ok) throw data;
  
  saveCollection(data.collection);
  setLastPullDate();
  
  return data.pick;
}

/* ── Weighted random pull (deprecated) ────────────────────────────────── */
function pullNaran() {
  // kept for legacy, should not be called
  return Object.values(NARANS)[0];
}

/* ── Star string ──────────────────────────────────────────── */
function starString(rarity) {
  return '★'.repeat(RARITY[rarity].stars) + '☆'.repeat(5 - RARITY[rarity].stars);
}

/* ── Get rarity for a username ────────────────────────────── */
function getNaranByName(username) {
  return NARANS.find(n => n.name.toLowerCase() === username.toLowerCase()) || null;
}

/* ── Export on window for non-module usage ─────────────── */
window.GachaNara = {
  RARITY, NARANS, getSkinUrl, getCollection, saveCollection,
  getLastPullDate, setLastPullDate, canPullToday, pullNaran, pullNaranAsync, starString,
  loadNarans, _naransReady, _stateReady, fetchState, resetPullTimer, hasUsedQuizToday, markQuizUsed,
  getNaranByName, getQuizCountToday, getNextQuizDifficulty, hasEverPulled,
  QUIZ_MAX_PER_DAY, quizFailedToday, markQuizFailed,
};
