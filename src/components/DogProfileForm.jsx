import { useState } from 'react'
import { BREEDS, COATS, AGES, saveDogProfile, useDogProfile, comfortShift } from '../lib/dogProfile.js'
import { DOG_SIZES } from '../lib/calories.js'
import { Segmented } from './ui.jsx'

const EMPTY = { name: '', breed: '', size: 'medium', weight: 15, age: 'adult', coat: 'medium', brachy: false, allergy: false, neutered: true }

export default function DogProfileForm({ onSaved }) {
  const saved = useDogProfile()
  const [p, setP] = useState(saved || EMPTY)
  const [done, setDone] = useState(false)
  const set = (patch) => {
    setP((x) => ({ ...x, ...patch }))
    setDone(false)
  }
  const pickBreed = (name) => {
    const b = BREEDS.find((x) => x.name === name)
    if (!b) return set({ breed: '' })
    set({ breed: b.name, size: b.size, coat: b.coat, brachy: !!b.brachy, weight: b.kg })
  }
  const shift = comfortShift(p)
  const submit = (e) => {
    e.preventDefault()
    saveDogProfile({ ...p, name: p.name.trim(), weight: Number(p.weight) || 10 })
    setDone(true)
    onSaved?.()
  }

  return (
    <form className="panel dog-form" onSubmit={submit}>
      <h2 className="panel__title">우리 강아지</h2>
      <p className="muted">한 번만 입력하면 산책지수, 산책 기록, 칼로리 계산이 우리 아이에게 맞춰져요. 정보는 이 기기에만 저장돼요.</p>

      <div className="field-row">
        <label className="field" htmlFor="dog-name">
          <span className="field__label">이름</span>
          <input id="dog-name" type="search" autoComplete="off" placeholder="예: 보리" maxLength={12} value={p.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="field" htmlFor="dog-breed">
          <span className="field__label">견종</span>
          <select id="dog-breed" value={p.breed} onChange={(e) => pickBreed(e.target.value)}>
            <option value="">직접 입력</option>
            {BREEDS.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
          </select>
        </label>
      </div>

      <div className="field">
        <span className="field__label">크기</span>
        <Segmented options={DOG_SIZES.map((s) => ({ value: s.id, label: `${s.label} (${s.range})` }))} value={p.size} onChange={(v) => set({ size: v })} label="크기" />
      </div>
      <div className="field-row">
        <label className="field" htmlFor="dog-kg">
          <span className="field__label">몸무게</span>
          <span className="input-unit">
            <input id="dog-kg" type="number" inputMode="decimal" min="0.5" max="100" step="0.1" value={p.weight} onChange={(e) => set({ weight: e.target.value })} />
            <span>kg</span>
          </span>
        </label>
        <div className="field">
          <span className="field__label">나이</span>
          <Segmented options={AGES.map((a) => ({ value: a.id, label: a.label }))} value={p.age} onChange={(v) => set({ age: v })} label="나이" />
        </div>
      </div>
      <div className="field">
        <span className="field__label">털</span>
        <Segmented options={COATS.map((c) => ({ value: c.id, label: c.label }))} value={p.coat} onChange={(v) => set({ coat: v })} label="털 종류" />
      </div>
      <div className="checks">
        <label><input type="checkbox" checked={p.brachy} onChange={(e) => set({ brachy: e.target.checked })} /> 코가 짧은 단두종이에요 (퍼그·불독·시츄 등)</label>
        <label><input type="checkbox" checked={p.allergy} onChange={(e) => set({ allergy: e.target.checked })} /> 꽃가루·풀 알레르기가 있어요</label>
        <label><input type="checkbox" checked={p.neutered} onChange={(e) => set({ neutered: e.target.checked })} /> 중성화했어요</label>
      </div>

      {shift.reasons.length > 0 && (
        <div className="shift-note">
          <strong>이렇게 맞춰 드려요</strong>
          <ul>
            {shift.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
          <p className="muted">
            쾌적한 체감온도: 약 {10 + shift.cold}°C ~ {22 - shift.heat}°C
          </p>
        </div>
      )}

      <div className="actions">
        <button className="btn" type="submit">{saved ? '변경 내용 저장' : '저장하고 맞춤 지수 켜기'}</button>
        {saved && (
          <button className="btn btn--ghost" type="button" onClick={() => { saveDogProfile(null); setP(EMPTY) }}>
            프로필 지우기
          </button>
        )}
        {done && <span className="saved-msg" role="status">저장했어요</span>}
      </div>
    </form>
  )
}
