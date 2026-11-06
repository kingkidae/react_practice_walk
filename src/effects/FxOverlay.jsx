import { useEffect, useRef, useState } from 'react'
import { fx, reducedMotion } from './fx.js'
import PawTrail from './PawTrail.jsx'

/**
 * 전역 효과 담당
 * - 'burst' / 'pawrain': three.js 발바닥 효과 (처음 쓸 때만 three.js 를 불러옴)
 * - 'bubble': 말풍선
 * - 'trail': 귀퉁이 발자국 이스터 에그
 * 이스터 에그: 한동안 가만히 있으면 발자국, 코나미 커맨드면 발바닥 비
 */
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']
const IDLE_MS = 25000
const TRAIL_COOLDOWN = 90000

export default function FxOverlay() {
  const [bubble, setBubble] = useState(null)
  const [trail, setTrail] = useState(0)
  const lastTrail = useRef(0)

  // 효과 이벤트
  useEffect(() => {
    const onFx = async (e) => {
      const { type, ...d } = e.detail || {}
      if (type === 'bubble') {
        setBubble({ ...d, key: Date.now() })
        return
      }
      if (type === 'trail') {
        lastTrail.current = Date.now()
        setTrail(Date.now())
        return
      }
      if (reducedMotion()) return
      try {
        const m = await import('./burst.js')
        if (type === 'burst') m.burst(d)
        if (type === 'pawrain') m.pawRain(d)
      } catch {
        /* WebGL 을 쓸 수 없으면 조용히 넘어감 */
      }
    }
    window.addEventListener('gachi:fx', onFx)
    return () => window.removeEventListener('gachi:fx', onFx)
  }, [])

  // 말풍선 자동 닫기
  useEffect(() => {
    if (!bubble) return
    const t = setTimeout(() => setBubble(null), 2200)
    return () => clearTimeout(t)
  }, [bubble])

  // 이스터 에그: 가만히 있으면 발자국 / 코나미 커맨드
  useEffect(() => {
    let idle = 0
    let seq = []
    const arm = () => {
      clearTimeout(idle)
      idle = setTimeout(() => {
        if (document.hidden || reducedMotion()) return arm()
        if (Date.now() - lastTrail.current > TRAIL_COOLDOWN) fx('trail')
        arm()
      }, IDLE_MS)
    }
    const onKey = (e) => {
      arm()
      seq = [...seq, e.key.length === 1 ? e.key.toLowerCase() : e.key].slice(-KONAMI.length)
      if (seq.join() === KONAMI.join()) {
        seq = []
        fx('pawrain', { duration: 5 })
        fx('bubble', { text: '멍멍! 숨은 발바닥을 찾았어요', x: window.innerWidth / 2, y: 90 })
      }
    }
    const events = ['pointerdown', 'wheel', 'touchstart', 'scroll']
    events.forEach((ev) => window.addEventListener(ev, arm, { passive: true }))
    window.addEventListener('keydown', onKey)
    arm()
    return () => {
      clearTimeout(idle)
      events.forEach((ev) => window.removeEventListener(ev, arm))
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <>
      {trail > 0 && <PawTrail key={trail} onDone={() => setTrail(0)} />}
      {bubble && (
        <div
          key={bubble.key}
          className="fx-bubble"
          role="status"
          style={{ left: Math.min(Math.max(bubble.x ?? window.innerWidth / 2, 110), window.innerWidth - 110), top: Math.max(bubble.y ?? 80, 60) }}
        >
          {bubble.text}
        </div>
      )}
    </>
  )
}
