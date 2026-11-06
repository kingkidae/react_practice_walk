import { useEffect, useState } from 'react'

const memory = new Map()
const TTL = 10 * 60e3 // 날씨가 바뀌므로 화면 쪽 캐시는 10분만 유지

export async function getJson(path) {
  const hit = memory.get(path)
  if (hit && Date.now() - hit.t < TTL) return hit.p
  const p = fetch(path)
    .then(async (r) => {
      const body = await r.json().catch(() => ({ error: { message: '서버 응답을 읽지 못했습니다.' } }))
      if (!r.ok || body.error) {
        const err = new Error(body.error?.message || `요청 실패 (${r.status})`)
        err.info = body.error
        throw err
      }
      return body
    })
    .catch((e) => {
      memory.delete(path)
      throw e
    })
  memory.set(path, { p, t: Date.now() })
  return p
}

// { data, meta, error, loading }
export function useApi(path) {
  const [state, setState] = useState({ loading: !!path, data: null, meta: null, error: null, path })
  if (state.path !== path) setState({ loading: !!path, data: null, meta: null, error: null, path })

  useEffect(() => {
    if (!path) return
    let alive = true
    getJson(path)
      .then((b) => alive && setState({ loading: false, data: b.data, meta: b.meta || null, error: null, path }))
      .catch((e) => alive && setState({ loading: false, data: null, meta: null, error: e, path }))
    return () => {
      alive = false
    }
  }, [path])
  return state
}

export function qs(obj) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(obj)) if (v !== '' && v != null) p.set(k, v)
  return p.toString()
}
