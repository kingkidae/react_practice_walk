import L from 'leaflet'
import { SIDO_LIST } from './geo.js'

const TONE_COLOR = {
  great: 'var(--score-great)',
  good: 'var(--score-good)',
  fair: 'var(--score-fair)',
  poor: 'var(--score-poor)',
  bad: 'var(--score-bad)',
}
export const toneColor = (tone) => TONE_COLOR[tone] || 'var(--ink-soft)'

export function levelColor(l) {
  return { 1: 'var(--leaf)', 2: 'var(--golden-deep)', 3: 'var(--score-bad)' }[l] || 'var(--ink-soft)'
}

// ---- 지도 마커 ----
const iconCache = new Map()
export function pinIcon({ text = '', color = 'var(--golden-deep)', kind = 'pin', active = false } = {}) {
  const k = `${text}|${color}|${kind}|${active}`
  if (iconCache.has(k)) return iconCache.get(k)
  const size = active ? 40 : 32
  const html =
    kind === 'dot'
      ? `<span class="map-dot${active ? ' is-active' : ''}" style="--c:${color}"></span>`
      : `<span class="map-pin${active ? ' is-active' : ''}" style="--c:${color}"><span>${text}</span></span>`
  const icon = L.divIcon({
    html,
    className: 'map-icon',
    iconSize: kind === 'dot' ? [18, 18] : [size, size],
    iconAnchor: kind === 'dot' ? [9, 9] : [size / 2, size],
    popupAnchor: [0, kind === 'dot' ? -8 : -size],
  })
  iconCache.set(k, icon)
  return icon
}

// ---- 선호 지역 ----
const SIDO_KEY = 'gachi-geotgae:sido'
export function loadSido(fallback = '대구') {
  try {
    const v = localStorage.getItem(SIDO_KEY)
    // 예전 값(광주·전남 → 전남광주 통합)이나 잘못된 값은 무시
    if (v === '광주' || v === '전남') return '전남광주'
    return SIDO_LIST.some((x) => x.short === v) ? v : fallback
  } catch {
    return fallback
  }
}
export function saveSido(s) {
  try {
    localStorage.setItem(SIDO_KEY, s)
  } catch {
    /* 무시 */
  }
}

// ---- 유기동물 ----
export function rememberAnimals(items) {
  try {
    const prev = JSON.parse(sessionStorage.getItem('gachi-geotgae:animals') || '{}')
    for (const a of items) prev[a.id] = a
    sessionStorage.setItem('gachi-geotgae:animals', JSON.stringify(prev))
  } catch {
    /* 무시 */
  }
}
export function recallAnimal(id) {
  try {
    return JSON.parse(sessionStorage.getItem('gachi-geotgae:animals') || '{}')[id] || null
  } catch {
    return null
  }
}
export function dday(end) {
  if (!end || end.length < 8) return null
  const e = Date.UTC(+end.slice(0, 4), +end.slice(4, 6) - 1, +end.slice(6, 8))
  const now = new Date(Date.now() + 9 * 3600e3)
  const t = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((e - t) / 86400e3)
}
export function sexLabel(s) {
  return { M: '수컷', F: '암컷', Q: '성별 미상' }[s] || '성별 미상'
}
