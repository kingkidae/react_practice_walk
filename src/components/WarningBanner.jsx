/** 기상청 기상특보 — 이 시도에 발효 중인 육상 특보와 해당 지역 */
export default function WarningBanner({ warnings }) {
  return (
    <div className="notice notice--warn" role="alert">
      <div className="notice__row">
        <strong>기상특보 발효 중</strong>
        <span>{warnings.items.join(', ')}</span>
      </div>
      <ul className="notice__list">
        {warnings.detail.map((d) => <li key={d}>{d}</li>)}
      </ul>
      <p className="hint">위 지역에 계신다면 산책 점수가 좋아도 짧게 다녀오거나 실내 놀이로 대신해 주세요. 산책지수는 현재 관측값 기준이라 특보와 다를 수 있어요.</p>
    </div>
  )
}
