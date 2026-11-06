import { useSyncExternalStore } from 'react'
import { distanceKm } from './geo.js'

// 산책 기록 (이 기기에만 저장)
const KEY = 'gachi-geotgae:walks'
const LIVE_KEY = 'gachi-geotgae:walk-live'
const listeners = new Set()
let cache

function read() {
  if (cache !== undefined) return cache
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    cache = Array.isArray(v) ? v : []
  } catch {
    cache = []
  }
  return cache
}
function write(list) {
  cache = list
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* 저장 공간 부족 시에도 화면은 유지 */
  }
  listeners.forEach((l) => l())
}
export function useWalks() {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    read,
    () => [],
  )
  return {
    list,
    add: (w) => write([w, ...list].sort((a, b) => b.start - a.start)),
    remove: (id) => write(list.filter((w) => w.id !== id)),
  }
}

// 진행 중인 산책 (새로고침해도 이어서 기록)
export function loadLive() {
  try {
    return JSON.parse(localStorage.getItem(LIVE_KEY) || 'null')
  } catch {
    return null
  }
}
export function saveLive(v) {
  try {
    if (v) localStorage.setItem(LIVE_KEY, JSON.stringify(v))
    else localStorage.removeItem(LIVE_KEY)
  } catch {
    /* 무시 */
  }
}

// 경로 저장용: 최대 n개 지점으로 줄임
export function thin(points, n = 300) {
  if (points.length <= n) return points
  const step = points.length / n
  const out = []
  for (let i = 0; i < n; i++) out.push(points[Math.floor(i * step)])
  out.push(points[points.length - 1])
  return out
}

export function pathKm(points) {
  let d = 0
  for (let i = 1; i < points.length; i++) d += distanceKm({ lat: points[i - 1][0], lng: points[i - 1][1] }, { lat: points[i][0], lng: points[i][1] })
  return d
}

export const dayKey = (t) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function stats(list) {
  const byDay = new Map()
  for (const w of list) {
    const k = dayKey(w.start)
    const v = byDay.get(k) || { minutes: 0, km: 0, count: 0 }
    v.minutes += w.minutes
    v.km += w.km
    v.count++
    byDay.set(k, v)
  }
  // 연속 산책 일수 (오늘 또는 어제부터 거슬러 올라감)
  let streak = 0
  const d = new Date()
  if (!byDay.has(dayKey(d))) d.setDate(d.getDate() - 1)
  while (byDay.has(dayKey(d))) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  // 이번 주 (월요일 시작)
  const now = new Date()
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const week = list.filter((w) => w.start >= monday.getTime())
  return {
    byDay,
    streak,
    weekMinutes: week.reduce((s, w) => s + w.minutes, 0),
    weekKm: week.reduce((s, w) => s + w.km, 0),
    weekCount: week.length,
    totalKm: list.reduce((s, w) => s + w.km, 0),
  }
}
