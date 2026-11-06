import { useEffect, useMemo } from 'react'
import { fx } from './fx.js'

const STEPS = 14
const GAP = 0.32 // 발자국 사이 시간(초)
const LIFE = 3.4 // 한 발자국이 보이는 시간(초)
const LINES = ['멍! 산책 가자!', '킁킁… 누가 지나갔지?', '발자국 주인을 찾았어요!', '간식 냄새가 나요 🐾']

/** 화면 왼쪽 아래 귀퉁이로 강아지가 걸어 들어왔다가 나가는 발자국 */
export default function PawTrail({ onDone }) {
  const prints = useMemo(() => {
    // 왼쪽 밖에서 들어와 곡선을 그리며 다시 나가는 길 (2차 베지어, 아래 기준 좌표)
    const P0 = [-30, 30]
    const P1 = [260, 150]
    const P2 = [-30, 290]
    const at = (t) => [
      (1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0],
      (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1],
    ]
    return Array.from({ length: STEPS }, (_, i) => {
      const t = (i + 0.5) / STEPS
      const [x, y] = at(t)
      const [x2, y2] = at(Math.min(1, t + 0.01))
      const dx = x2 - x
      const dy = y2 - y
      const len = Math.hypot(dx, dy) || 1
      const side = i % 2 ? 1 : -1 // 왼발·오른발
      return {
        x: x + (-dy / len) * 9 * side,
        y: y + (dx / len) * 9 * side,
        rot: (Math.atan2(dx, dy) * 180) / Math.PI,
        delay: i * GAP,
      }
    })
  }, [])

  useEffect(() => {
    const t = setTimeout(onDone, (STEPS * GAP + LIFE) * 1000)
    return () => clearTimeout(t)
  }, [onDone])

  const woof = (e) => {
    fx('burst', { x: e.clientX, y: e.clientY, count: 28 })
    fx('bubble', { text: LINES[Math.floor(Math.random() * LINES.length)], x: e.clientX, y: e.clientY - 70 })
  }

  return (
    <div className="paw-trail" aria-hidden="true">
      {prints.map((p, i) => (
        <button
          key={i}
          type="button"
          tabIndex={-1}
          className="paw-trail__print"
          style={{ left: p.x, bottom: p.y, transform: `rotate(${p.rot}deg)`, animationDelay: `${p.delay}s`, animationDuration: `${LIFE}s` }}
          onClick={woof}
        >
          <svg viewBox="0 0 24 24" width="22" height="22">
            <ellipse cx="12" cy="16.2" rx="5.2" ry="4.4" />
            <ellipse cx="5.2" cy="10.6" rx="2.2" ry="2.8" />
            <ellipse cx="18.8" cy="10.6" rx="2.2" ry="2.8" />
            <ellipse cx="9" cy="5.6" rx="2.1" ry="2.8" />
            <ellipse cx="15" cy="5.6" rx="2.1" ry="2.8" />
          </svg>
        </button>
      ))}
    </div>
  )
}
