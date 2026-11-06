import { useSyncExternalStore } from 'react'

const KEY = 'gachi-geotgae:favorites'
const listeners = new Set()
let cache = null

function read() {
  if (cache) return cache
  try {
    cache = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(cache)) cache = []
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
    /* 저장 공간이 없거나 막혀 있어도 화면 동작은 유지 */
  }
  listeners.forEach((l) => l())
}

export function useFavorites() {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      const onStorage = (e) => {
        if (e.key === KEY) {
          cache = null
          cb()
        }
      }
      window.addEventListener('storage', onStorage)
      return () => {
        listeners.delete(cb)
        window.removeEventListener('storage', onStorage)
      }
    },
    read,
    () => [],
  )
  const has = (id) => list.some((a) => a.id === id)
  const toggle = (animal) => {
    if (has(animal.id)) write(list.filter((a) => a.id !== animal.id))
    else write([{ ...animal, savedAt: Date.now() }, ...list])
  }
  return { list, has, toggle }
}
