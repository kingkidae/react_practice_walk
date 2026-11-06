import { useEffect, useRef, useState } from 'react'
import { loadLive, saveLive, thin, pathKm } from '../lib/walks.js'
import { walkKcal } from '../lib/calories.js'
import { distanceKm, fmtKm } from '../lib/geo.js'
import { pinIcon } from '../lib/ui-helpers.js'
import MapView from './MapView.jsx'

const nowMs = () => Date.now()

const fmtClock = (ms) => {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(ss).padStart(2, '0')}`
}

/**
 * GPS 산책 기록. 진행 상태는 localStorage 에 계속 저장해서 새로고침해도 이어진다.
 * live = { status: 'running'|'paused', startedAt, accMs, since, points: [[lat,lng,t]] }
 */
export default function WalkTracker({ profile, onSave }) {
  const [live, setLive] = useState(() => loadLive())
  const [now, setNow] = useState(() => Date.now())
  const [msg, setMsg] = useState('')
  const [accuracy, setAccuracy] = useState(null)
  const watchId = useRef(null)
  const wakeLock = useRef(null)

  const running = live?.status === 'running'

  // 1초마다 시계 갱신
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [running])

  // 위치 추적
  useEffect(() => {
    if (!running) return
    if (!navigator.geolocation) return
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy: acc } = pos.coords
        setAccuracy(Math.round(acc))
        if (acc > 40) return // 부정확한 위치는 버림
        setLive((prev) => {
          if (!prev || prev.status !== 'running') return prev
          const last = prev.points[prev.points.length - 1]
          if (last) {
            const d = distanceKm({ lat: last[0], lng: last[1] }, { lat, lng }) * 1000
            const dt = (pos.timestamp - last[2]) / 1000
            if (d < 4) return prev // 제자리 흔들림
            if (dt > 0 && d / dt > 7) return prev // 시속 25km 이상 튐
          }
          const next = { ...prev, points: [...prev.points, [lat, lng, pos.timestamp]] }
          saveLive(next)
          return next
        })
        setMsg('')
      },
      (e) => setMsg(e.code === 1 ? '위치 권한을 허용해야 경로를 기록할 수 있어요. 시간은 계속 기록돼요.' : '위치를 잡는 중이에요. 하늘이 트인 곳에서 잠시 기다려 주세요.'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    )
    // 화면 꺼짐 방지 (지원 브라우저만)
    navigator.wakeLock?.request('screen').then((l) => (wakeLock.current = l)).catch(() => {})
    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current)
      wakeLock.current?.release?.().catch(() => {})
      wakeLock.current = null
    }
  }, [running])

  const update = (v) => {
    saveLive(v)
    setLive(v)
  }
  const start = () => {
    const t = Date.now()
    setNow(t)
    update({ status: 'running', startedAt: t, accMs: 0, since: t, points: [] })
  }
  const pause = () => update({ ...live, status: 'paused', accMs: live.accMs + (Date.now() - live.since), since: null })
  const resume = () => {
    setNow(Date.now())
    update({ ...live, status: 'running', since: Date.now() })
  }
  const elapsed = live ? live.accMs + (running ? now - live.since : 0) : 0
  const km = live ? pathKm(live.points) : 0
  const minutes = elapsed / 60000
  const kcal = walkKcal({ km, minutes, profile })

  const stop = () => {
    if (minutes < 1 && km < 0.05) {
      if (!window.confirm('1분 미만의 산책은 저장하지 않아요. 기록을 지울까요?')) return
      update(null)
      saveLive(null)
      return
    }
    onSave({
      id: `w${live.startedAt}`,
      start: live.startedAt,
      end: nowMs(),
      minutes: Math.round(minutes),
      km: Math.round(km * 100) / 100,
      points: thin(live.points.map((p) => [+p[0].toFixed(6), +p[1].toFixed(6)])),
      source: 'gps',
      kcalDog: kcal.dog,
      kcalOwner: kcal.owner,
      dogName: profile?.name || '',
    })
    saveLive(null)
    setLive(null)
  }

  const noGeo = typeof navigator !== 'undefined' && !navigator.geolocation
  const line = live?.points.map((p) => [p[0], p[1]]) || []
  const lastPt = line[line.length - 1]

  if (!live) {
    return (
      <section className="tracker tracker--idle">
        <div>
          <h2 className="panel__title">{profile?.name ? `${profile.name}와 산책 나가요` : '산책 기록 시작'}</h2>
          <p className="muted">시작을 누르면 휴대폰 위치로 경로·거리·시간을 기록해요. 화면을 켜 둔 상태에서 가장 정확해요.</p>
        </div>
        <button className="btn btn--big" onClick={start}>산책 시작</button>
      </section>
    )
  }

  return (
    <section className="tracker" aria-live="polite">
      <div className="tracker__stats">
        <div><span>시간</span><strong>{fmtClock(elapsed)}</strong></div>
        <div><span>거리</span><strong>{fmtKm(km)}</strong></div>
        <div><span>{profile?.name || '반려견'}</span><strong>{kcal.dog != null ? `${kcal.dog}kcal` : '-'}</strong></div>
        <div><span>보호자</span><strong>{kcal.owner}kcal</strong></div>
      </div>
      {line.length > 0 ? (
        <MapView
          className="map--mid"
          label="지금 걷고 있는 경로"
          center={lastPt}
          zoom={16}
          fit={line.length > 1 ? line : [lastPt]}
          lines={[{ id: 'now', points: line }]}
          markers={[
            { id: 's', lat: line[0][0], lng: line[0][1], icon: pinIcon({ text: '출발', color: 'var(--leaf)' }) },
            { id: 'me', lat: lastPt[0], lng: lastPt[1], icon: pinIcon({ kind: 'dot', color: '#3E7CB1', active: true }), z: 20 },
          ]}
        />
      ) : (
        <p className="tracker__wait">{running ? '위치를 잡는 중이에요…' : '일시정지 중'}</p>
      )}
      {noGeo && <p className="hint hint--error">이 브라우저는 위치 기록을 지원하지 않아요. 시간만 기록되고, 아래에서 직접 기록할 수도 있어요.</p>}
      {(msg || accuracy != null) && <p className="hint">{msg || `위치 정확도 약 ${accuracy}m`}</p>}
      <div className="actions">
        {running ? <button className="btn btn--ghost" onClick={pause}>일시정지</button> : <button className="btn btn--ghost" onClick={resume}>다시 걷기</button>}
        <button className="btn" onClick={stop}>산책 끝내기</button>
      </div>
    </section>
  )
}
