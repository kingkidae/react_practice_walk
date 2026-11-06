import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useWalks, stats, dayKey } from '../lib/walks.js'
import { useDogProfile, SIZE_DAILY_MIN } from '../lib/dogProfile.js'
import { walkKcal } from '../lib/calories.js'
import { fmtKm, fmtMinutes } from '../lib/geo.js'
import { usePageMeta } from '../lib/seo.js'
import { Segmented, Empty } from '../components/ui.jsx'
import WalkTracker from '../components/WalkTracker.jsx'
import DogProfileForm from '../components/DogProfileForm.jsx'
import MapView from '../components/MapView.jsx'
import { pinIcon } from '../lib/ui-helpers.js'

export default function Me() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'dog' ? 'dog' : 'record'
  const profile = useDogProfile()
  const walks = useWalks()
  usePageMeta({ title: '내 산책 기록', description: '반려견과의 산책 경로·거리·시간을 기록하고, 달력과 주간 목표로 산책 습관을 확인하세요.', noindex: true })

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">{profile?.name ? `${profile.name}의 산책` : '내 산책'}</h1>
        <p className="lead">걸은 길을 기록하고 산책 습관을 확인해요. 기록은 이 기기에만 저장돼요.</p>
      </header>
      <Segmented
        options={[{ value: 'record', label: '산책 기록' }, { value: 'dog', label: profile ? '우리 강아지' : '우리 강아지 등록' }]}
        value={tab}
        onChange={(v) => setParams(v === 'dog' ? { tab: 'dog' } : {})}
        label="내 산책 메뉴"
      />
      {tab === 'dog' ? (
        <DogProfileForm onSaved={() => setParams({})} />
      ) : (
        <RecordTab profile={profile} walks={walks} onNeedProfile={() => setParams({ tab: 'dog' })} />
      )}
    </div>
  )
}

function RecordTab({ profile, walks, onNeedProfile }) {
  const s = useMemo(() => stats(walks.list), [walks.list])
  const [open, setOpen] = useState(null)
  const [daily] = SIZE_DAILY_MIN[profile?.size || 'medium']
  const weekGoal = daily * 7
  const pct = Math.min(100, Math.round((s.weekMinutes / weekGoal) * 100))

  return (
    <>
      {!profile && (
        <div className="notice notice--prompt">
          <span>우리 강아지를 등록하면 반려견 칼로리와 맞춤 목표가 계산돼요.</span>
          <button className="btn btn--sm" onClick={onNeedProfile}>등록하기</button>
        </div>
      )}

      <WalkTracker profile={profile} onSave={walks.add} />

      <div className="me-stats">
        <div className="me-stat">
          <span>연속 산책</span>
          <strong>{s.streak}일</strong>
        </div>
        <div className="me-stat">
          <span>이번 주</span>
          <strong>{fmtMinutes(s.weekMinutes) === '-' ? '0분' : fmtMinutes(s.weekMinutes)}</strong>
          <span>{s.weekCount}번 · {fmtKm(s.weekKm)}</span>
        </div>
        <div className="me-stat me-stat--goal">
          <span>주간 목표 {fmtMinutes(weekGoal)}</span>
          <div className="meter__track" aria-hidden="true"><div className="meter__fill" style={{ width: `${pct}%` }} /></div>
          <span>{pct}% 달성{profile ? ` · ${profile.name || '우리 아이'} 하루 ${daily}분 기준` : ''}</span>
        </div>
        <div className="me-stat">
          <span>지금까지</span>
          <strong>{fmtKm(s.totalKm)}</strong>
          <span>{walks.list.length}번 산책</span>
        </div>
      </div>

      <div className="grid-2">
        <Calendar byDay={s.byDay} daily={daily} />
        <ManualAdd profile={profile} onAdd={walks.add} />
      </div>

      <section className="panel">
        <h2 className="panel__title">최근 산책</h2>
        {!walks.list.length && <Empty title="아직 기록이 없어요">위의 산책 시작 버튼을 눌러 첫 산책을 기록해 보세요.</Empty>}
        <ul className="walk-log">
          {walks.list.slice(0, 30).map((w) => (
            <li key={w.id} className="walk-log__item">
              <button className="walk-log__main" onClick={() => setOpen(open === w.id ? null : w.id)} aria-expanded={open === w.id}>
                <span className="walk-log__date">{fmtDate(w.start)}</span>
                <span className="walk-log__nums">
                  {fmtMinutes(w.minutes)} · {fmtKm(w.km)}
                  {w.kcalDog != null && ` · 반려견 ${w.kcalDog}kcal`}
                </span>
                <span className="chip chip--plain">{w.source === 'gps' ? '경로 기록' : '직접 입력'}</span>
              </button>
              {open === w.id && (
                <div className="walk-log__detail">
                  {w.points?.length > 1 && (
                    <MapView
                      className="map--mid"
                      label="산책 경로"
                      fit={w.points}
                      lines={[{ id: 'p', points: w.points }]}
                      markers={[
                        { id: 's', lat: w.points[0][0], lng: w.points[0][1], icon: pinIcon({ text: '출발', color: 'var(--leaf)' }) },
                        { id: 'e', lat: w.points.at(-1)[0], lng: w.points.at(-1)[1], icon: pinIcon({ text: '도착', color: 'var(--ink)' }) },
                      ]}
                    />
                  )}
                  <p className="muted">보호자 {w.kcalOwner}kcal{w.dogName ? ` · ${w.dogName}` : ''}</p>
                  <button className="link-btn" onClick={() => window.confirm('이 기록을 지울까요?') && walks.remove(w.id)}>기록 삭제</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

const todayKey = () => dayKey(Date.now())

function fmtDate(t) {
  const d = new Date(t)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function Calendar({ byDay, daily }) {
  const [offset, setOffset] = useState(0)
  const base = new Date()
  const first = new Date(base.getFullYear(), base.getMonth() + offset, 1)
  const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const lead = first.getDay()
  const today = todayKey()
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1))]
  const monthTotal = cells.filter(Boolean).reduce((s, d) => s + (byDay.get(dayKey(d))?.minutes || 0), 0)
  return (
    <section className="panel">
      <div className="panel__headrow">
        <h2 className="panel__title">{first.getFullYear()}년 {first.getMonth() + 1}월</h2>
        <div className="actions">
          <button className="btn btn--ghost btn--sm" onClick={() => setOffset((o) => o - 1)} aria-label="이전 달">이전</button>
          <button className="btn btn--ghost btn--sm" onClick={() => setOffset((o) => Math.min(0, o + 1))} disabled={offset >= 0} aria-label="다음 달">다음</button>
        </div>
      </div>
      <div className="cal" role="grid" aria-label="월간 산책 달력">
        {['일', '월', '화', '수', '목', '금', '토'].map((d) => <span key={d} className="cal__dow">{d}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`x${i}`} />
          const k = dayKey(d)
          const v = byDay.get(k)
          const level = !v ? 0 : v.minutes >= daily ? 3 : v.minutes >= daily / 2 ? 2 : 1
          return (
            <span key={k} className={`cal__day lv${level}${k === today ? ' is-today' : ''}`} title={v ? `${v.minutes}분 · ${v.km.toFixed(1)}km` : ''}>
              {d.getDate()}
            </span>
          )
        })}
      </div>
      <p className="fine">이번 달 {fmtMinutes(monthTotal) === '-' ? '0분' : fmtMinutes(monthTotal)} · 진한 칸은 하루 권장 시간({daily}분)을 채운 날이에요.</p>
    </section>
  )
}

function ManualAdd({ profile, onAdd }) {
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const [date, setDate] = useState(iso)
  const [time, setTime] = useState('19:00')
  const [minutes, setMinutes] = useState(30)
  const [km, setKm] = useState('')
  const [done, setDone] = useState(false)
  const submit = (e) => {
    e.preventDefault()
    const start = new Date(`${date}T${time}:00`).getTime()
    const m = Math.max(1, Number(minutes) || 0)
    const k = km === '' ? Math.round((m / 60) * 4 * 10) / 10 : Number(km)
    const kcal = walkKcal({ km: k, minutes: m, profile })
    onAdd({ id: `m${start}`, start, end: start + m * 60000, minutes: m, km: k, points: [], source: 'manual', kcalDog: kcal.dog, kcalOwner: kcal.owner, dogName: profile?.name || '' })
    setDone(true)
  }
  return (
    <form className="panel" onSubmit={submit}>
      <h2 className="panel__title">직접 기록하기</h2>
      <p className="muted">휴대폰 없이 다녀왔다면 시간과 거리를 직접 남겨요.</p>
      <div className="field-row">
        <label className="field" htmlFor="m-date"><span className="field__label">날짜</span><input id="m-date" type="date" value={date} max={iso} onChange={(e) => { setDate(e.target.value); setDone(false) }} /></label>
        <label className="field" htmlFor="m-time"><span className="field__label">시작 시각</span><input id="m-time" type="time" className="input-time" value={time} onChange={(e) => { setTime(e.target.value); setDone(false) }} /></label>
      </div>
      <div className="field-row">
        <label className="field" htmlFor="m-min"><span className="field__label">시간</span><span className="input-unit"><input id="m-min" type="number" inputMode="numeric" min="1" max="600" value={minutes} onChange={(e) => { setMinutes(e.target.value); setDone(false) }} /><span>분</span></span></label>
        <label className="field" htmlFor="m-km"><span className="field__label">거리 (선택)</span><span className="input-unit"><input id="m-km" type="number" inputMode="decimal" min="0" max="50" step="0.1" placeholder="자동" value={km} onChange={(e) => { setKm(e.target.value); setDone(false) }} /><span>km</span></span></label>
      </div>
      <div className="actions">
        <button className="btn" type="submit">기록 추가</button>
        {done && <span className="saved-msg" role="status">추가했어요</span>}
      </div>
    </form>
  )
}
