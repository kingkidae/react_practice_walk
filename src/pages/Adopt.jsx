import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi, qs } from '../lib/api.js'
import { usePageMeta } from '../lib/seo.js'
import { useFavorites } from '../lib/favorites.js'
import { fmtDate } from '../lib/geo.js'
import { Loading, ErrorBox, Segmented, Empty } from '../components/ui.jsx'
import { rememberAnimals, dday, sexLabel, loadSido } from '../lib/ui-helpers.js'
import { SIDO_LIST } from '../lib/geo.js'
import Shelters from '../components/Shelters.jsx'
import LostSearch from '../components/LostSearch.jsx'

const UPKIND = [
  { value: '', label: '전체' },
  { value: '417000', label: '강아지' },
  { value: '422400', label: '고양이' },
  { value: '429900', label: '기타' },
]
const PERIODS = [
  { value: 7, label: '1주' },
  { value: 30, label: '1개월' },
  { value: 90, label: '3개월' },
  { value: 'custom', label: '직접 선택' },
]
const STATES = [
  { value: '', label: '전체' },
  { value: 'notice', label: '공고 중' },
  { value: 'protect', label: '보호 중' },
]
const ROWS = 24

const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '')
const daysAgo = (n) => ymd(new Date(Date.now() + 9 * 3600e3 - n * 86400e3))
const toInput = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`

export default function Adopt() {
  const fav = useFavorites()
  usePageMeta({ title: '유기동물 입양 (입양하개)', description: '전국 보호소에서 새 가족을 기다리는 유기견·유기묘를 지역·품종·기간별로 찾아보고 찜해 두세요.' })
  const [tab, setTab] = useState('list')
  const [f, setF] = useState({ upr_cd: '', org_cd: '', upkind: '', kind: '', period: 30, bgnde: daysAgo(30), endde: daysAgo(0), state: '' })
  const [page, setPage] = useState(1)
  const set = (patch) => {
    setF((x) => ({ ...x, ...patch }))
    setPage(1)
  }

  const sidoRes = useApi('/api/adopt/sido')
  // 저장된 내 지역을 보호소 API의 시도 코드로 변환
  const myFull = SIDO_LIST.find((s) => s.short === loadSido(''))?.full
  const myUpr = (sidoRes.data || []).find((s) => myFull && s.orgdownNm === myFull)?.orgCd || ''
  const sggRes = useApi(f.upr_cd ? `/api/adopt/sigungu?upr_cd=${f.upr_cd}` : null)
  const kindRes = useApi(f.upkind ? `/api/adopt/kind?up_kind_cd=${f.upkind}` : null)
  const listPath = `/api/adopt/list?${qs({ upr_cd: f.upr_cd, org_cd: f.org_cd, care_reg_no: f.care_reg_no, upkind: f.upkind, kind: f.kind, bgnde: f.bgnde, endde: f.endde, state: f.state, pageNo: page, numOfRows: ROWS })}`
  const listRes = useApi(tab === 'list' ? listPath : null)
  const items = useMemo(() => listRes.data?.items || [], [listRes.data])
  const total = listRes.data?.totalCount || 0
  const pages = Math.max(1, Math.ceil(total / ROWS))

  useEffect(() => {
    if (items.length) rememberAnimals(items)
  }, [items])


  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">입양하개</h1>
        <p className="lead">보호소에서 새 가족을 기다리는 아이들이에요. 마음에 남는 아이는 찜해 두고 천천히 다시 보세요.</p>
      </header>

      <Segmented
        options={[{ value: 'list', label: '기다리는 아이들' }, { value: 'shelter', label: '보호소' }, { value: 'lost', label: '잃어버린 아이 찾기' }, { value: 'fav', label: `찜 ${fav.list.length}` }]}
        value={tab}
        onChange={setTab}
        label="목록 선택"
      />

      {tab === 'list' && (
        <>
          <div className="filters filters--adopt">
            <label className="field" htmlFor="a-sido">
              <span className="field__label">시도</span>
              <select id="a-sido" value={f.upr_cd} onChange={(e) => set({ upr_cd: e.target.value, org_cd: '' })}>
                <option value="">전국</option>
                {(sidoRes.data || []).map((s) => <option key={s.orgCd} value={s.orgCd}>{s.orgdownNm}</option>)}
              </select>
            </label>
            <label className="field" htmlFor="a-sgg">
              <span className="field__label">시군구</span>
              <select id="a-sgg" value={f.org_cd} disabled={!f.upr_cd} onChange={(e) => set({ org_cd: e.target.value })}>
                <option value="">전체</option>
                {(sggRes.data || []).map((s) => <option key={s.orgCd} value={s.orgCd}>{s.orgdownNm}</option>)}
              </select>
            </label>
            <div className="field">
              <span className="field__label">동물</span>
              <Segmented options={UPKIND} value={f.upkind} onChange={(v) => set({ upkind: v, kind: '' })} label="동물 종류" />
            </div>
            <label className="field" htmlFor="a-kind">
              <span className="field__label">품종</span>
              <select id="a-kind" value={f.kind} disabled={!f.upkind} onChange={(e) => set({ kind: e.target.value })}>
                <option value="">{f.upkind ? '전체 품종' : '동물을 먼저 골라 주세요'}</option>
                {(kindRes.data || []).map((k) => <option key={k.kindCd} value={k.kindCd}>{k.kindNm || k.knm}</option>)}
              </select>
            </label>
            <div className="field">
              <span className="field__label">구조된 날짜</span>
              <Segmented
                options={PERIODS}
                value={f.period}
                onChange={(v) => set(v === 'custom' ? { period: v } : { period: v, bgnde: daysAgo(v), endde: daysAgo(0) })}
                label="기간"
              />
            </div>
            {f.period === 'custom' && (
              <div className="field-row">
                <label className="field" htmlFor="a-bg">
                  <span className="field__label">시작일</span>
                  <input id="a-bg" type="date" value={toInput(f.bgnde)} max={toInput(f.endde)} onChange={(e) => e.target.value && set({ bgnde: e.target.value.replace(/-/g, '') })} />
                </label>
                <label className="field" htmlFor="a-ed">
                  <span className="field__label">종료일</span>
                  <input id="a-ed" type="date" value={toInput(f.endde)} min={toInput(f.bgnde)} max={toInput(daysAgo(0))} onChange={(e) => e.target.value && set({ endde: e.target.value.replace(/-/g, '') })} />
                </label>
              </div>
            )}
            <div className="field">
              <span className="field__label">상태</span>
              <Segmented options={STATES} value={f.state} onChange={(v) => set({ state: v })} label="보호 상태" />
            </div>
          </div>
          {f.care_reg_no && (
            <div className="extras">
              <span className="chip">보호소: {f.careName}</span>
              <button className="link-btn" onClick={() => set({ care_reg_no: '', careName: '' })}>보호소 조건 지우기</button>
            </div>
          )}
          {listRes.loading && <Loading text="보호 중인 아이들을 찾고 있어요" />}
          {listRes.error && <ErrorBox error={listRes.error} />}
          {listRes.data && (
            <>
              <p className="count">
                {fmtDate(f.bgnde)} ~ {fmtDate(f.endde)} 구조 · {total.toLocaleString()}마리
              </p>
              {!items.length ? (
                <Empty title="조건에 맞는 아이가 없어요">기간을 넓히거나 지역을 바꿔 보세요.</Empty>
              ) : (
                <AnimalGrid items={items} fav={fav} />
              )}
              {pages > 1 && (
                <nav className="pager" aria-label="페이지">
                  <button className="btn btn--ghost btn--sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>이전</button>
                  <span>{page} / {pages}</span>
                  <button className="btn btn--ghost btn--sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>다음</button>
                </nav>
              )}
            </>
          )}
        </>
      )}

      {tab === 'shelter' && <Shelters key={myUpr} defaultUpr={myUpr} sidoList={sidoRes.data || []} onPick={(s) => { setF((x) => ({ ...x, upr_cd: s.uprCd || x.upr_cd, org_cd: '', care_reg_no: s.id, careName: s.name, period: 90, bgnde: daysAgo(90), endde: daysAgo(0) })); setPage(1); setTab('list') }} />}
      {tab === 'lost' && <LostSearch key={myUpr} defaultUpr={myUpr} sidoList={sidoRes.data || []} fav={fav} Grid={AnimalGrid} />}

      {tab === 'fav' &&
        (fav.list.length ? (
          <>
            <p className="count">이 기기에 저장된 찜 목록이에요. 공고 기간이 지나면 입양이 어려울 수 있으니 보호소에 먼저 연락해 주세요.</p>
            <AnimalGrid items={fav.list} fav={fav} />
          </>
        ) : (
          <Empty title="아직 찜한 아이가 없어요">목록에서 하트를 눌러 마음에 드는 아이를 저장해 보세요.</Empty>
        ))}
    </div>
  )
}

export function AnimalGrid({ items, fav }) {
  return (
    <ul className="animal-grid">
      {items.map((a) => (
        <li key={a.id} className="animal">
          <Link to={`/adopt/${a.id}`} state={{ animal: a }} className="animal__link">
            <AnimalPhoto a={a} />
            <div className="animal__body">
              <div className="animal__row">
                <strong className="animal__kind">{a.kind || a.upKind}</strong>
                <StateBadge state={a.state} end={a.noticeEnd} />
              </div>
              <span className="animal__meta">{sexLabel(a.sex)} · {a.age} · {a.weight}</span>
              <span className="animal__place">{a.careName || a.orgName}</span>
            </div>
          </Link>
          <HeartButton on={fav.has(a.id)} onClick={() => fav.toggle(a)} name={a.kind} />
        </li>
      ))}
    </ul>
  )
}

export function AnimalPhoto({ a, large }) {
  const [broken, setBroken] = useState(false)
  if (!a.image || broken) {
    return (
      <div className={`animal__photo animal__photo--empty${large ? ' is-large' : ''}`}>
        <svg viewBox="0 0 64 48" width="64" aria-hidden="true">
          <path d="M20 30c0-9 5-16 12-16s12 7 12 16v6H20z" fill="var(--golden-light)" />
          <path d="M22 18c-4 1-6 8-4 12 3-1 5-5 6-9zM42 18c4 1 6 8 4 12-3-1-5-5-6-9z" fill="var(--golden)" />
          <circle cx="28" cy="25" r="1.6" fill="var(--ink)" /><circle cx="36" cy="25" r="1.6" fill="var(--ink)" />
          <ellipse cx="32" cy="30" rx="2.4" ry="1.7" fill="var(--ink)" />
        </svg>
        <span>사진 준비 중</span>
      </div>
    )
  }
  return <img className={`animal__photo${large ? ' is-large' : ''}`} src={a.image} alt={`${a.kind} ${a.color} ${sexLabel(a.sex)}`} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
}

export function HeartButton({ on, onClick, name, big }) {
  return (
    <button type="button" className={`heart${on ? ' is-on' : ''}${big ? ' heart--big' : ''}`} aria-pressed={on} aria-label={on ? `${name} 찜 해제` : `${name} 찜하기`} onClick={onClick}>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20.5S3 15 3 8.8A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 9 2.2C21 15 12 20.5 12 20.5z" />
      </svg>
      {big && <span>{on ? '찜했어요' : '찜하기'}</span>}
    </button>
  )
}

export function StateBadge({ state, end }) {
  const d = dday(end)
  if (/공고/.test(state) && d != null) return <span className={`chip ${d <= 3 ? 'chip--alert' : 'chip--plain'}`}>{d >= 0 ? `공고 D-${d}` : '공고 종료'}</span>
  return <span className="chip chip--plain">{state || '보호 중'}</span>
}

