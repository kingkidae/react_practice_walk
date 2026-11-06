import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApi, qs } from '../lib/api.js'
import { usePageMeta } from '../lib/seo.js'
import { computeWalkScore, pmGrade, PTY_LABEL, SKY_LABEL, feelsLike, uvGrade, POLLEN_LABEL } from '../lib/walkScore.js'
import { useDogProfile } from '../lib/dogProfile.js'
import { kstParts, uvAt, pollenToday } from '../lib/indices.js'
import ShareButton from '../components/ShareButton.jsx'
import WarningBanner from '../components/WarningBanner.jsx'
import { fmtKm, fmtMinutes, fmtArea, parkLoopKm, LEVEL_LABEL } from '../lib/geo.js'
import PetNearby from '../components/PetNearby.jsx'
import { ScoreTag, Loading, ErrorBox, Empty } from '../components/ui.jsx'
import MapView from '../components/MapView.jsx'
import { pinIcon, toneColor } from '../lib/ui-helpers.js'

export default function WalkDetail() {
  const { sido, id } = useParams()
  const region = useApi(`/api/walk/region?sido=${encodeURIComponent(sido)}`)
  const isHere = id === 'here'
  const isPark = id.startsWith('park-')
  const isCourse = !isHere && !isPark
  const course = isHere ? region.data?.here : isPark ? region.data?.parks?.find((p) => p.id === id) : region.data?.courses.find((c) => c.id === id)
  const point = course?.start
  const fc = useApi(course ? `/api/weather/forecast?${qs(point ? { lat: point.lat, lng: point.lng } : { nx: course.grid.nx, ny: course.grid.ny })}` : null)
  const track = useApi(isCourse && course?.gpxpath ? `/api/trails/track?id=${encodeURIComponent(id)}` : null)

  const profile = useDogProfile()
  const idx = useApi(`/api/indices?sido=${encodeURIComponent(sido)}`)
  const [{ ymd, hh, month }] = useState(() => kstParts())
  const uvSeries = idx.data?.uv?.series
  const uv = uvAt(uvSeries, ymd, hh)
  const pollen = pollenToday(idx.data?.pollen)
  usePageMeta({
    title: course ? `${course.name} 산책지수` : '산책지수 상세',
    description: course ? `${course.name}의 지금 반려견 산책지수와 기온·미세먼지·바람, 앞으로 24시간 산책하기 좋은 시간대를 확인하세요.` : undefined,
  })
  const score = useMemo(() => (course ? computeWalkScore({ weather: course.weather, air: course.air, profile, uv, pollen, month }) : null), [course, profile, uv, pollen, month])
  const hourly = useMemo(() => {
    if (!fc.data || !course) return []
    return fc.data.slice(0, 24).map((h) => ({ ...h, uv: uvAt(uvSeries, h.date, h.time.slice(0, 2)), score: computeWalkScore({ weather: h, air: course.air, profile, uv: uvAt(uvSeries, h.date, h.time.slice(0, 2)), pollen, month: Number(h.date.slice(4, 6)) }) }))
  }, [fc.data, course, profile, uvSeries, pollen])
  const bestWindow = useMemo(() => findBestWindow(hourly), [hourly])

  if (region.loading) return <div className="page"><Loading text="산책로 정보를 불러오고 있어요" /></div>
  if (region.error) return <div className="page"><ErrorBox error={region.error} /></div>
  if (!course) return <div className="page"><Empty title="산책로를 찾지 못했어요"><Link to="/walk">산책지수 목록으로</Link></Empty></div>

  const w = course.weather || {}
  const a = course.air || {}
  const feel = feelsLike(w.t, w.wsd, w.reh)

  return (
    <div className="page">
      <Link to="/walk" className="back">산책지수 목록</Link>
      {idx.data?.warnings?.items?.length > 0 && <WarningBanner warnings={idx.data.warnings} />}

      <section className="detail-head">
        <ScoreTag score={score.total} tone={score.grade.tone} size={132} label={score.grade.label} />
        <div className="detail-head__text">
          <span className="chip" style={{ '--chip': toneColor(score.grade.tone) }}>{score.grade.label}</span>
          {profile ? (
            <span className="personal-chip">{profile.name || '우리 아이'} 맞춤 점수 · <Link to="/me?tab=dog">프로필 수정</Link></span>
          ) : (
            <span className="personal-chip"><Link to="/me?tab=dog">우리 강아지 등록하고 맞춤 점수 보기</Link></span>
          )}
          <h1 className="page-title page-title--sm">{course.name}</h1>
          {isHere ? (
            <p className="muted">{course.spot} 기준 · 지금 우리 동네 산책지수</p>
          ) : isPark ? (
            <p className="muted">{course.addr} · {course.kind} · {fmtArea(course.areaM2)}</p>
          ) : (
            <p className="muted">{course.sigun} · {fmtKm(course.distanceKm)} · {fmtMinutes(course.minutes)} · {LEVEL_LABEL[course.level] || '-'}</p>
          )}
        </div>
      </section>

      <div className="grid-2">
        <section className="panel">
          <h2 className="panel__title">점수는 이렇게 나왔어요</h2>
          <ul className="bars">
            {score.parts.map((p) => (
              <li key={p.key} className="bar">
                <div className="bar__head">
                  <span>{p.label}</span>
                  <span className="bar__value">{p.value}</span>
                  <strong>{p.score}/{p.max}</strong>
                </div>
                <div className="bar__track" aria-hidden="true">
                  <div className="bar__fill" style={{ width: `${(p.score / p.max) * 100}%`, background: toneColor(barTone(p.score / p.max)) }} />
                </div>
              </li>
            ))}
            {score.deductions.map((d) => (
              <li key={d.key} className="bar bar--minus">
                <div className="bar__head">
                  <span>{d.label}</span>
                  <span className="bar__value">{d.value}</span>
                  <strong>{d.score}</strong>
                </div>
              </li>
            ))}
          </ul>
          {score.reasons.length > 0 && <p className="hint">{profile.name || '우리 아이'} 맞춤: {score.reasons.join(', ')}</p>}
          <h3 className="panel__sub">산책 팁</h3>
          <ul className="tips">
            {score.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </section>

        <section className="panel">
          <h2 className="panel__title">지금 날씨와 공기</h2>
          <dl className="facts">
            <Fact label="기온" value={w.t != null ? `${w.t}°C` : '-'} sub={feel != null ? `체감 ${Math.round(feel)}°C` : ''} />
            <Fact label="강수" value={PTY_LABEL[w.pty ?? 0]} sub={w.rn1 ? `1시간 ${w.rn1}mm` : ''} />
            <Fact label="습도" value={w.reh != null ? `${w.reh}%` : '-'} />
            <Fact label="바람" value={w.wsd != null ? `${w.wsd}m/s` : '-'} sub={w.vec != null ? windDir(w.vec) : ''} />
            <Fact label="미세먼지" value={pmGrade('pm10', a.pm10).label} sub={a.pm10 != null ? `${a.pm10}㎍/㎥` : ''} tone={pmTone(pmGrade('pm10', a.pm10).level)} />
            <Fact label="초미세먼지" value={pmGrade('pm25', a.pm25).label} sub={a.pm25 != null ? `${a.pm25}㎍/㎥` : ''} tone={pmTone(pmGrade('pm25', a.pm25).level)} />
            <Fact label="자외선" value={uv != null ? uvGrade(uv).label : '정보 없음'} sub={uv != null ? `지수 ${uv}` : ''} tone={uvGrade(uv).tone} />
            <Fact label="진드기" value={score.tick?.level ? score.tick.label : '적음'} sub="계절·기온 기준" tone={score.tick?.level === 2 ? 'poor' : score.tick?.level === 1 ? 'fair' : null} />
            {idx.data?.pollen?.inSeason && pollen != null && <Fact label="꽃가루" value={POLLEN_LABEL[pollen]} sub={idx.data.pollen.items.map((p) => p.label.replace(' 꽃가루', '')).join('·')} />}
          </dl>
          <p className="fine">
            관측: 기상청 초단기실황 {w.baseTime ? fmtBase(w.baseTime) : ''} (격자 {course.grid.nx},{course.grid.ny})<br />
            대기질: {a.stationName || '-'} 측정소{a.distKm != null ? ` (${isHere ? course.spot : isPark ? '공원' : '출발점'}에서 ${a.distKm}km)` : ''}{a.dataTime ? ` · ${a.dataTime}` : ''}
          </p>
        </section>
      </div>

      <section className="panel">
        <div className="panel__headrow">
          <h2 className="panel__title">앞으로 24시간 산책지수</h2>
          {bestWindow && (
            <p className="best-time">
              추천 시간 <strong>{bestWindow.label}</strong> <span className="muted">평균 {bestWindow.avg}점</span>
            </p>
          )}
        </div>
        {fc.loading && <Loading text="예보를 불러오고 있어요" />}
        {fc.error && <ErrorBox error={fc.error} />}
        {hourly.length > 0 && <HourlyChart hourly={hourly} best={bestWindow} />}
        <div className="actions">
          <ShareButton
            data={{
              place: course.name,
              score: score.total,
              grade: score.grade.label,
              toneColor: toneColor(score.grade.tone),
              note: score.notes[0],
              dogName: profile?.name,
              bestTime: bestWindow?.label,
              facts: [['기온', w.t != null ? `${w.t}°C` : '-'], ['미세먼지', pmGrade('pm10', a.pm10).label], ['바람', w.wsd != null ? `${w.wsd}m/s` : '-'], ['자외선', uv != null ? uvGrade(uv).label : '-']],
            }}
          />
        </div>
        <p className="fine">시간별 점수는 기상청 단기예보(기온·강수확률·습도·바람)와 현재 미세먼지 값으로 계산했어요.</p>
      </section>

      {isPark && <ParkPanel park={course} />}

      {isCourse && (
      <section className="panel">
        <div className="panel__headrow">
          <h2 className="panel__title">코스 미리 보기</h2>
          <Link to={`/trails/${course.id}`} className="btn btn--ghost btn--sm">산책로 자세히</Link>
        </div>
        {track.data?.track ? (
          <MapView
            className="map--mid"
            label="코스 지도"
            fit={track.data.track.points.map((p) => [p[0], p[1]])}
            lines={[{ id: 'route', points: track.data.track.points.map((p) => [p[0], p[1]]) }]}
            markers={[
              { id: 's', lat: track.data.track.start.lat, lng: track.data.track.start.lng, icon: pinIcon({ text: '출발', color: 'var(--leaf)' }), z: 10 },
              { id: 'e', lat: track.data.track.end.lat, lng: track.data.track.end.lng, icon: pinIcon({ text: '도착', color: 'var(--ink)' }) },
            ]}
          />
        ) : track.loading ? (
          <Loading text="경로를 불러오고 있어요" />
        ) : (
          <p className="muted">이 코스는 경로 정보가 제공되지 않아요.</p>
        )}
        <div className="actions">
          <Link className="btn" to={`/calories?${qs({ km: course.distanceKm ?? course.trackKm, min: course.minutes, name: course.name })}`}>이 코스로 칼로리 계산</Link>
          {point && (
            <a className="btn btn--ghost" href={`https://map.kakao.com/link/to/${encodeURIComponent(course.name + ' 출발점')},${point.lat},${point.lng}`} target="_blank" rel="noreferrer">
              출발점 길찾기
            </a>
          )}
        </div>
      </section>
      )}

      {point && <PetNearby lat={point.lat} lng={point.lng} />}
    </div>
  )
}

function ParkPanel({ park }) {
  const loop = parkLoopKm(park.areaM2)
  return (
    <section className="panel">
      <div className="panel__headrow">
        <h2 className="panel__title">공원 정보</h2>
        <a className="btn btn--ghost btn--sm" href={`https://map.kakao.com/link/to/${encodeURIComponent(park.name)},${park.lat},${park.lng}`} target="_blank" rel="noreferrer">길찾기</a>
      </div>
      <MapView
        className="map--mid"
        label="공원 위치 지도"
        center={[park.lat, park.lng]}
        zoom={15}
        fit={[[park.lat, park.lng]]}
        circle={loop ? { center: [park.lat, park.lng], radius: Math.sqrt(park.areaM2 / Math.PI) } : null}
        markers={[{ id: park.id, lat: park.lat, lng: park.lng, icon: pinIcon({ text: '공원', color: 'var(--leaf)' }) }]}
      />
      <dl className="facts">
        <Fact label="공원 종류" value={park.kind || '-'} />
        <Fact label="면적" value={fmtArea(park.areaM2)} />
        {loop && <Fact label="한 바퀴 (추정)" value={fmtKm(loop)} sub="원형 기준 둘레" />}
        {park.since && <Fact label="지정일" value={park.since} />}
      </dl>
      {Object.keys(park.facilities).length > 0 && (
        <ul className="facility-list">
          {Object.entries(park.facilities).map(([k, v]) => (
            <li key={k}><strong>{k}시설</strong> {v}</li>
          ))}
        </ul>
      )}
      <div className="actions">
        {loop && <Link className="btn" to={`/calories?${qs({ km: loop.toFixed(1), name: park.name })}`}>한 바퀴 칼로리 계산</Link>}
        {park.tel && <a className="btn btn--ghost" href={`tel:${park.tel.replace(/[^d]/g, '')}`}>관리기관 {park.tel}</a>}
      </div>
      <p className="fine">출처: 전국도시공원정보표준데이터{park.org ? ` · 관리 ${park.org}` : ''}{park.updated ? ` · 기준일 ${park.updated}` : ''}. 공원마다 반려견 출입 규칙이 다를 수 있으니 현장 안내를 확인해 주세요.</p>
    </section>
  )
}

function Fact({ label, value, sub, tone }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>
        <strong style={tone ? { color: toneColor(tone) } : undefined}>{value}</strong>
        {sub && <span>{sub}</span>}
      </dd>
    </div>
  )
}

function HourlyChart({ hourly, best }) {
  return (
    <div className="hourly" role="img" aria-label="시간별 산책지수 막대 그래프">
      <div className="hourly__bars">
        {hourly.map((h, i) => {
          const inBest = best && i >= best.start && i < best.start + best.len
          return (
            <div key={h.date + h.time} className={`hourly__col${inBest ? ' is-best' : ''}`} title={`${Number(h.time.slice(0, 2))}시 · ${h.score.total}점 · ${h.t}°C · ${h.pty ? PTY_LABEL[h.pty] : SKY_LABEL[h.sky] || ''} · 강수확률 ${h.pop}%${h.uv != null ? ` · 자외선 ${h.uv}` : ''}`}>
              <span className="hourly__num">{h.score.total}</span>
              <span className="hourly__bar" style={{ height: `${Math.max(4, h.score.total)}%`, background: toneColor(h.score.grade.tone) }} />
            </div>
          )
        })}
      </div>
      <div className="hourly__axis" aria-hidden="true">
        {hourly.map((h, i) => (
          <span key={h.date + h.time}>{i % 3 === 0 ? `${Number(h.time.slice(0, 2))}시` : ''}</span>
        ))}
      </div>
      <div className="hourly__axis hourly__axis--sub" aria-hidden="true">
        {hourly.map((h, i) => (
          <span key={h.date + h.time}>{i % 3 === 0 ? `${h.t}°` : ''}</span>
        ))}
      </div>
    </div>
  )
}

// 낮 시간(06~21시) 중 2시간 연속 평균 점수가 가장 높은 구간
function findBestWindow(hourly) {
  let best = null
  for (let i = 0; i + 1 < hourly.length; i++) {
    const h0 = Number(hourly[i].time.slice(0, 2))
    if (h0 < 6 || h0 > 20) continue
    const avg = Math.round((hourly[i].score.total + hourly[i + 1].score.total) / 2)
    if (!best || avg > best.avg) best = { start: i, len: 2, avg, h0, date: hourly[i].date }
  }
  if (!best) return null
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '')
  const day = best.date === today ? '오늘' : '내일'
  return { ...best, label: `${day} ${best.h0}시~${best.h0 + 2}시` }
}

function barTone(r) {
  return r >= 0.85 ? 'great' : r >= 0.7 ? 'good' : r >= 0.5 ? 'fair' : r >= 0.3 ? 'poor' : 'bad'
}
function pmTone(level) {
  return ['great', 'fair', 'poor', 'bad'][level] || null
}
function windDir(deg) {
  const dirs = ['북', '북동', '동', '남동', '남', '남서', '서', '북서']
  return `${dirs[Math.round(deg / 45) % 8]}풍`
}
function fmtBase(s) {
  const [d, t] = s.split(' ')
  return `${Number(d.slice(4, 6))}/${Number(d.slice(6, 8))} ${t.slice(0, 2)}:${t.slice(2)}`
}
