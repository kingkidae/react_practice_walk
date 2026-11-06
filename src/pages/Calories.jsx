import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DOG_SIZES, SPEEDS, TERRAINS, DOG_STYLES, ownerCalories, dogCalories } from '../lib/calories.js'
import { Segmented } from '../components/ui.jsx'
import { useDogProfile } from '../lib/dogProfile.js'
import { usePageMeta } from '../lib/seo.js'
import { fmtKm, fmtMinutes } from '../lib/geo.js'

const STORE = 'gachi-geotgae:calorie-profile'
function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(STORE) || 'null')
  } catch {
    return null
  }
}

export default function Calories() {
  const [params] = useSearchParams()
  usePageMeta({ title: '강아지 산책 칼로리 계산기', description: '반려견 크기·몸무게·산책 속도와 보호자 키·몸무게로 함께 걸은 산책의 소모 칼로리와 걸음 수를 계산해요.' })
  const saved = loadProfile()
  const presetKm = Number(params.get('km')) || null
  const presetMin = Number(params.get('min')) || null
  const courseName = params.get('name')

  const dp = useDogProfile()
  const [dog, setDog] = useState(dp ? { size: dp.size, weight: Number(dp.weight), neutered: dp.neutered, style: saved?.dog?.style || 'sniff' } : saved?.dog || { size: 'medium', weight: 15, neutered: true, style: 'sniff' })
  const [owner, setOwner] = useState(saved?.owner || { height: 168, weight: 62, age: 30, sex: 'F' })
  const [speed, setSpeed] = useState('normal')
  const [terrain, setTerrain] = useState('flat')
  const [mode, setMode] = useState(presetKm ? 'distance' : 'time')
  const [minutes, setMinutes] = useState(presetMin && !presetKm ? presetMin : 40)
  const [km, setKm] = useState(presetKm || 3)

  const sp = SPEEDS.find((s) => s.id === speed)
  const tr = TERRAINS.find((t) => t.id === terrain)
  const st = DOG_STYLES.find((s) => s.id === dog.style)
  const walkMin = mode === 'time' ? Number(minutes) || 0 : ((Number(km) || 0) / sp.kmh) * 60

  const ok = dog.weight > 0 && owner.weight > 0 && owner.height > 0 && walkMin > 0
  const result = useMemo(() => {
    if (!ok) return null
    const o = ownerCalories({ weightKg: +owner.weight, heightCm: +owner.height, age: +owner.age || 30, sex: owner.sex, kmh: sp.kmh, minutes: walkMin, grade: tr.grade })
    const d = dogCalories({ weightKg: +dog.weight, kmh: sp.kmh, minutes: walkMin, terrainFactor: tr.dogFactor, styleFactor: st.factor, neutered: dog.neutered })
    return { o, d }
  }, [ok, owner, dog, sp, tr, st, walkMin])

  const save = () => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ dog, owner }))
    } catch {
      /* 무시 */
    }
  }

  const sizeInfo = DOG_SIZES.find((s) => s.id === dog.size)
  const pickSize = (id) => {
    const s = DOG_SIZES.find((x) => x.id === id)
    setDog({ ...dog, size: id, weight: s.defaultKg })
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">칼로리 소모 계산기</h1>
        <p className="lead">같이 걸은 만큼, 나와 반려견이 얼마나 썼는지 한 번에 계산해요.</p>
        {courseName && <p className="chip chip--plain">선택한 코스: {courseName}</p>}
        {dp?.name && <p className="chip chip--plain">{dp.name}의 프로필로 채웠어요</p>}
      </header>

      <div className="calc">
        <form className="calc__form" onSubmit={(e) => e.preventDefault()}>
          <section className="panel">
            <h2 className="panel__title">반려견</h2>
            <div className="size-pick" role="radiogroup" aria-label="반려견 크기">
              {DOG_SIZES.map((s) => (
                <button key={s.id} type="button" role="radio" aria-checked={dog.size === s.id} className={`size-pick__item${dog.size === s.id ? ' is-on' : ''}`} onClick={() => pickSize(s.id)}>
                  <DogSilhouette size={s.id} />
                  <strong>{s.label}</strong>
                  <span>{s.range}</span>
                </button>
              ))}
            </div>
            <p className="hint">예: {sizeInfo.example}</p>
            <div className="field-row">
              <NumField id="dog-w" label="몸무게" unit="kg" value={dog.weight} step="0.1" min="0.5" max="100" onChange={(v) => setDog({ ...dog, weight: v })} />
              <label className="field" htmlFor="dog-n">
                <span className="field__label">중성화</span>
                <select id="dog-n" value={dog.neutered ? 'y' : 'n'} onChange={(e) => setDog({ ...dog, neutered: e.target.value === 'y' })}>
                  <option value="y">했어요</option>
                  <option value="n">안 했어요</option>
                </select>
              </label>
            </div>
            <span className="field__label">산책 스타일</span>
            <Segmented options={DOG_STYLES.map((s) => ({ value: s.id, label: s.label }))} value={dog.style} onChange={(v) => setDog({ ...dog, style: v })} label="반려견 산책 스타일" wrap />
          </section>

          <section className="panel">
            <h2 className="panel__title">보호자</h2>
            <div className="field-row">
              <NumField id="o-h" label="키" unit="cm" value={owner.height} min="100" max="230" onChange={(v) => setOwner({ ...owner, height: v })} />
              <NumField id="o-w" label="몸무게" unit="kg" value={owner.weight} step="0.1" min="20" max="250" onChange={(v) => setOwner({ ...owner, weight: v })} />
            </div>
            <div className="field-row">
              <NumField id="o-a" label="나이" unit="세" value={owner.age} min="10" max="100" onChange={(v) => setOwner({ ...owner, age: v })} />
              <div className="field">
                <span className="field__label">성별</span>
                <Segmented options={[{ value: 'F', label: '여성' }, { value: 'M', label: '남성' }]} value={owner.sex} onChange={(v) => setOwner({ ...owner, sex: v })} label="성별" />
              </div>
            </div>
          </section>

          <section className="panel">
            <h2 className="panel__title">산책</h2>
            <span className="field__label">속도</span>
            <div className="speed-pick" role="radiogroup" aria-label="산책 속도">
              {SPEEDS.map((s) => (
                <button key={s.id} type="button" role="radio" aria-checked={speed === s.id} className={`speed-pick__item${speed === s.id ? ' is-on' : ''}`} onClick={() => setSpeed(s.id)}>
                  <strong>{s.label}</strong>
                  <span>{s.kmh}km/h</span>
                  <small>{s.desc}</small>
                </button>
              ))}
            </div>
            <span className="field__label">길 종류</span>
            <Segmented options={TERRAINS.map((t) => ({ value: t.id, label: t.label }))} value={terrain} onChange={setTerrain} label="길 종류" wrap />
            <span className="field__label">입력 방식</span>
            <Segmented options={[{ value: 'time', label: '시간으로' }, { value: 'distance', label: '거리로' }]} value={mode} onChange={setMode} label="입력 방식" />
            {mode === 'time' ? (
              <div className="range">
                <label htmlFor="walk-min" className="range__label">
                  산책 시간 <strong>{minutes}분</strong>
                </label>
                <input id="walk-min" type="range" min="5" max="180" step="5" value={minutes} onChange={(e) => setMinutes(+e.target.value)} />
              </div>
            ) : (
              <NumField id="walk-km" label="거리" unit="km" value={km} step="0.1" min="0.1" max="50" onChange={setKm} />
            )}
            <p className="hint">
              {fmtKm((sp.kmh * walkMin) / 60)} · {fmtMinutes(walkMin)} 걷는 것으로 계산해요.
            </p>
          </section>
          <button type="button" className="btn btn--ghost" onClick={save}>내 정보 이 기기에 저장</button>
        </form>

        {result && (
          <a className="calc__peek" href="#calc-result" aria-label="계산 결과로 이동">
            <span>반려견 <b>{Math.round(result.d.kcal)}</b>kcal</span>
            <span>보호자 <b>{Math.round(result.o.kcal)}</b>kcal</span>
            <span className="calc__peek-go">결과 보기</span>
          </a>
        )}

        <aside className="calc__result" id="calc-result" aria-live="polite">
          {!result ? (
            <div className="panel"><p>몸무게, 키, 산책 시간을 입력하면 결과가 나와요.</p></div>
          ) : (
            <>
              <div className="result-card result-card--dog">
                <span className="result-card__who">반려견</span>
                <strong className="result-card__kcal">{Math.round(result.d.kcal)}<small>kcal</small></strong>
                <ul className="result-card__facts">
                  <li>하루 필요 열량 {Math.round(result.d.mer)}kcal의 <b>{Math.round(result.d.ratio * 100)}%</b></li>
                  <li>강아지 간식(약 10kcal) <b>{Math.max(1, Math.round(result.d.kcal / 10))}개</b>만큼</li>
                  <li>탐색 포함 실제 이동 약 {fmtKm(result.d.distanceKm)}</li>
                </ul>
                <Meter value={walkMin} range={sizeInfo.dailyMin} />
              </div>
              <div className="result-card result-card--owner">
                <span className="result-card__who">보호자</span>
                <strong className="result-card__kcal">{Math.round(result.o.kcal)}<small>kcal</small></strong>
                <ul className="result-card__facts">
                  {!result.o.running && <li>걸음 수 약 <b>{result.o.steps.toLocaleString()}보</b></li>}
                  <li>운동 강도 {result.o.met.toFixed(1)} METs ({result.o.met < 3 ? '가벼움' : result.o.met < 6 ? '중간' : '격렬'})</li>
                  <li>밥 한 공기(약 300kcal)의 <b>{Math.round((result.o.kcal / 300) * 100)}%</b></li>
                  <li>기초대사량 약 {Math.round(result.o.bmr).toLocaleString()}kcal · BMI {result.o.bmi.toFixed(1)}</li>
                </ul>
              </div>
              <div className="result-sum">
                둘이 합쳐 <strong>{Math.round(result.o.kcal + result.d.kcal)}kcal</strong>를 함께 썼어요.
              </div>
              <details className="formula">
                <summary>계산 방법</summary>
                <p>보호자: 미국스포츠의학회(ACSM) 대사 방정식으로 산소 소비량을 구하고, 산소 1L당 5kcal로 환산했어요. 걸음 수는 키 × 0.413~0.415 보폭으로 추정해요.</p>
                <p>반려견: 포유류 이동 에너지 식(Taylor 외, 1982) P = 10.7·M<sup>-0.316</sup>·v + 6.03·M<sup>-0.303</sup> (W/kg)에 길 종류와 산책 스타일 보정을 곱했어요. 하루 필요 열량은 RER(70 × 체중<sup>0.75</sup>) × {dog.neutered ? '1.6' : '1.8'}이에요.</p>
                <p>개체 차이가 크니 참고용으로 봐 주세요. 체중 관리가 필요하면 수의사와 상담하세요.</p>
              </details>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

function NumField({ id, label, unit, value, onChange, ...rest }) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">{label}</span>
      <span className="input-unit">
        <input id={id} type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} {...rest} />
        <span>{unit}</span>
      </span>
    </label>
  )
}

function Meter({ value, range }) {
  const [lo, hi] = range
  const pct = Math.min(100, (value / hi) * 100)
  const msg = value < lo ? `권장 산책 시간(${lo}~${hi}분)보다 ${Math.round(lo - value)}분 부족해요` : value <= hi ? '하루 권장 산책 시간을 채웠어요!' : '권장 시간을 넘겼어요. 물과 휴식을 챙겨 주세요.'
  return (
    <div className="meter">
      <div className="meter__track" aria-hidden="true">
        <div className="meter__goal" style={{ left: `${(lo / hi) * 100}%`, width: `${100 - (lo / hi) * 100}%` }} />
        <div className="meter__fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="meter__msg">{msg}</p>
    </div>
  )
}

function DogSilhouette({ size }) {
  const s = { small: 0.62, medium: 0.8, large: 1 }[size]
  return (
    <svg viewBox="0 0 64 48" width={56 * s + 8} height={42 * s + 6} aria-hidden="true">
      <path d="M14 22c0-6 6-10 14-10h14c5 0 8 3 9 6l5-2c3-1 5 1 4 4l-3 6c-1 2-3 3-5 3h-2l-1 13h-5l-1-10H24l-2 10h-5l-1-12c-2-2-2-5-2-8z" fill="currentColor" />
      <path d="M14 22c-4-2-7-6-6-10 2 3 5 5 8 6z" fill="currentColor" />
    </svg>
  )
}
