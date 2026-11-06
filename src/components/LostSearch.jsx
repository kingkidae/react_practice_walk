import { useMemo, useState } from 'react'
import { useApi, qs } from '../lib/api.js'
import { Loading, ErrorBox, Empty, Segmented } from './ui.jsx'

const pad = (n) => String(n).padStart(2, '0')
const kstYmd = (offsetDays = 0) => {
  const d = new Date(Date.now() + 9 * 3600e3 - offsetDays * 86400e3)
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
}
const toInput = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`

/** 잃어버린 날짜 이후 구조된 동물 중 조건이 맞는 아이를 찾는다 */
export default function LostSearch({ sidoList, fav, Grid, defaultUpr = '' }) {
  const [form, setForm] = useState(() => ({ date: kstYmd(3), upr: defaultUpr, org: '', upkind: '417000', sex: '', color: '', keyword: '' }))
  const [query, setQuery] = useState(null)
  const sgg = useApi(form.upr ? `/api/adopt/sigungu?upr_cd=${form.upr}` : null)
  const res = useApi(query ? `/api/adopt/list?${qs({ bgnde: query.date, endde: kstYmd(0), upr_cd: query.upr, org_cd: query.org, upkind: query.upkind, numOfRows: 500 })}` : null)
  const set = (p) => setForm((f) => ({ ...f, ...p }))

  const matches = useMemo(() => {
    if (!res.data || !query) return []
    const color = query.color.trim()
    const kw = query.keyword.trim()
    return res.data.items
      .filter((a) => !query.sex || a.sex === query.sex)
      .filter((a) => !color || a.color.includes(color))
      .filter((a) => !kw || `${a.kind} ${a.special} ${a.happenPlace}`.includes(kw))
      .sort((a, b) => (a.happenDt || '').localeCompare(b.happenDt || ''))
  }, [res.data, query])

  const submit = (e) => {
    e.preventDefault()
    setQuery({ ...form })
  }

  return (
    <>
      <form className="panel" onSubmit={submit}>
        <h2 className="panel__title">잃어버린 아이 찾기</h2>
        <p className="muted">잃어버린 날 이후 보호소에 들어온 아이들 중에서 조건이 맞는 아이를 찾아요. 구조된 아이는 공고 기간(보통 10일)이 지나면 다른 가족에게 입양될 수 있으니 서둘러 확인해 주세요.</p>
        <div className="field-row">
          <label className="field" htmlFor="lost-date">
            <span className="field__label">잃어버린 날</span>
            <input id="lost-date" type="date" value={toInput(form.date)} max={toInput(kstYmd(0))} onChange={(e) => e.target.value && set({ date: e.target.value.replace(/-/g, '') })} />
          </label>
          <div className="field">
            <span className="field__label">동물</span>
            <Segmented options={[{ value: '417000', label: '강아지' }, { value: '422400', label: '고양이' }, { value: '429900', label: '기타' }]} value={form.upkind} onChange={(v) => set({ upkind: v })} label="동물" />
          </div>
        </div>
        <div className="field-row">
          <label className="field" htmlFor="lost-sido">
            <span className="field__label">잃어버린 곳 (시도)</span>
            <select id="lost-sido" value={form.upr} onChange={(e) => set({ upr: e.target.value, org: '' })}>
              <option value="">전국</option>
              {sidoList.map((s) => <option key={s.orgCd} value={s.orgCd}>{s.orgdownNm}</option>)}
            </select>
          </label>
          <label className="field" htmlFor="lost-sgg">
            <span className="field__label">시군구</span>
            <select id="lost-sgg" value={form.org} disabled={!form.upr} onChange={(e) => set({ org: e.target.value })}>
              <option value="">전체</option>
              {(sgg.data || []).map((s) => <option key={s.orgCd} value={s.orgCd}>{s.orgdownNm}</option>)}
            </select>
          </label>
        </div>
        <div className="field-row">
          <div className="field">
            <span className="field__label">성별</span>
            <Segmented options={[{ value: '', label: '모름' }, { value: 'M', label: '수컷' }, { value: 'F', label: '암컷' }]} value={form.sex} onChange={(v) => set({ sex: v })} label="성별" />
          </div>
          <label className="field" htmlFor="lost-color">
            <span className="field__label">털색</span>
            <input id="lost-color" type="search" placeholder="예: 흰, 갈색, 검정" value={form.color} onChange={(e) => set({ color: e.target.value })} />
          </label>
        </div>
        <label className="field" htmlFor="lost-kw">
          <span className="field__label">품종·특징 (선택)</span>
          <input id="lost-kw" type="search" placeholder="예: 푸들, 빨간 목줄, 중성화" value={form.keyword} onChange={(e) => set({ keyword: e.target.value })} />
        </label>
        <div className="actions">
          <button className="btn" type="submit">찾아보기</button>
        </div>
      </form>

      {res.loading && <Loading text="보호소에 들어온 아이들을 살펴보고 있어요" />}
      {res.error && <ErrorBox error={res.error} />}
      {query && res.data && (
        matches.length ? (
          <>
            <p className="count">조건에 맞는 아이 {matches.length}마리 (구조된 날짜 순) · 전체 {res.data.items.length}마리 중</p>
            <Grid items={matches} fav={fav} />
          </>
        ) : (
          <Empty title="조건에 맞는 아이를 찾지 못했어요">털색이나 특징을 비우고 다시 찾아보세요. 매일 새로 구조되는 아이들이 있으니 자주 확인해 주세요.</Empty>
        )
      )}
    </>
  )
}
