import { useSyncExternalStore } from 'react'

// 우리 강아지 프로필 (이 기기에만 저장)
const KEY = 'gachi-geotgae:dog'
const listeners = new Set()
let cache

// 대표 견종 프리셋: 크기, 털, 단두종 여부, 기본 몸무게
export const BREEDS = [
  { name: '말티즈', size: 'small', coat: 'long', kg: 3 },
  { name: '푸들 (토이)', size: 'small', coat: 'curly', kg: 3 },
  { name: '포메라니안', size: 'small', coat: 'double', kg: 2.5 },
  { name: '치와와', size: 'small', coat: 'short', kg: 2 },
  { name: '요크셔테리어', size: 'small', coat: 'long', kg: 3 },
  { name: '시츄', size: 'small', coat: 'long', brachy: true, kg: 6 },
  { name: '퍼그', size: 'small', coat: 'short', brachy: true, kg: 8 },
  { name: '프렌치 불독', size: 'medium', coat: 'short', brachy: true, kg: 11 },
  { name: '닥스훈트', size: 'small', coat: 'short', kg: 8 },
  { name: '비숑 프리제', size: 'small', coat: 'curly', kg: 6 },
  { name: '미니어처 슈나우저', size: 'small', coat: 'medium', kg: 7 },
  { name: '웰시코기', size: 'medium', coat: 'double', kg: 12 },
  { name: '시바견', size: 'medium', coat: 'double', kg: 10 },
  { name: '비글', size: 'medium', coat: 'short', kg: 11 },
  { name: '보더콜리', size: 'medium', coat: 'double', kg: 18 },
  { name: '진돗개', size: 'medium', coat: 'double', kg: 18 },
  { name: '불독', size: 'medium', coat: 'short', brachy: true, kg: 23 },
  { name: '골든 리트리버', size: 'large', coat: 'double', kg: 30 },
  { name: '래브라도 리트리버', size: 'large', coat: 'short', kg: 30 },
  { name: '사모예드', size: 'large', coat: 'double', kg: 25 },
  { name: '시베리안 허스키', size: 'large', coat: 'double', kg: 23 },
  { name: '저먼 셰퍼드', size: 'large', coat: 'double', kg: 32 },
  { name: '믹스 (소형)', size: 'small', coat: 'medium', kg: 6 },
  { name: '믹스 (중형)', size: 'medium', coat: 'medium', kg: 15 },
  { name: '믹스 (대형)', size: 'large', coat: 'medium', kg: 28 },
]
export const COATS = [
  { id: 'short', label: '짧은 털' },
  { id: 'medium', label: '중간 털' },
  { id: 'long', label: '긴 털' },
  { id: 'curly', label: '곱슬 털' },
  { id: 'double', label: '이중모 (속털 많음)' },
]
export const AGES = [
  { id: 'puppy', label: '1살 미만' },
  { id: 'adult', label: '1~7살' },
  { id: 'senior', label: '8살 이상' },
]

function read() {
  if (cache !== undefined) return cache
  try {
    cache = JSON.parse(localStorage.getItem(KEY) || 'null')
  } catch {
    cache = null
  }
  return cache
}
export function saveDogProfile(p) {
  cache = p
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p))
    else localStorage.removeItem(KEY)
  } catch {
    /* 저장이 막혀 있어도 화면 동작은 유지 */
  }
  listeners.forEach((l) => l())
}
export function useDogProfile() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    read,
    () => null,
  )
}

/**
 * 프로필로 체감 쾌적 범위를 옮긴다.
 * heat: 더위에 약할수록 큰 값 (쾌적 상한을 그만큼 낮춤)
 * cold: 추위에 약할수록 큰 값 (쾌적 하한을 그만큼 올림), 음수면 추위에 강함
 */
export function comfortShift(p) {
  if (!p) return { heat: 0, cold: 0, reasons: [] }
  let heat = 0
  let cold = 0
  const reasons = []
  if (p.brachy) {
    heat += 5
    reasons.push('단두종이라 더위에 특히 약해요')
  }
  if (p.age === 'senior') {
    heat += 2
    cold += 3
    reasons.push('노견이라 체온 조절이 어려워요')
  } else if (p.age === 'puppy') {
    heat += 1
    cold += 3
    reasons.push('어린 강아지라 추위에 약해요')
  }
  if (p.coat === 'double') {
    heat += 3
    cold -= 6
    reasons.push('이중모라 추위엔 강하고 더위엔 약해요')
  } else if (p.coat === 'short') {
    cold += 3
    reasons.push('털이 짧아 추위를 잘 타요')
  } else if (p.coat === 'long' || p.coat === 'curly') {
    heat += 1
  }
  if (p.size === 'small') {
    cold += 2
    reasons.push('작은 몸집이라 체온을 빨리 잃어요')
  } else if (p.size === 'large') {
    heat += 2
    cold -= 2
  }
  return { heat, cold, reasons }
}

export const SIZE_DAILY_MIN = { small: [30, 60], medium: [60, 90], large: [90, 120] }
