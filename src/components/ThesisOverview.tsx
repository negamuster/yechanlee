import { Link, useNavigate } from 'react-router-dom'
import { useSavedItems } from '../hooks/useSavedItems'
import { useSessionState } from '../hooks/useSessionState'
import { JUDGMENTS } from '../lib/thesis'
import { defaultNoteFilters, findNotes, validNoteFilters, REVIEW_FILTERS } from '../lib/noteDiscovery'

export default function ThesisOverview() {
  const { items } = useSavedItems(), navigate = useNavigate()
  const [filters, setFilters] = useSessionState('theses.filters', defaultNoteFilters, validNoteFilters)
  const notes = items.theses ?? [], visible = findNotes(notes, filters)
  return <section className="thesis-overview" aria-labelledby="thesis-title">
    <h2 id="thesis-title">투자 논점 추적 <span>{notes.length}/50</span></h2>
    <p className="saved-note">투자 근거·반대 근거·다음 확인 사항을 기록하고 판단의 변화를 남겨보세요. 관심 종목을 해제해도 노트는 유지됩니다.</p>
    {!!items.stocks.length && <label>노트 만들기·열기 <select aria-label="투자 노트를 작성할 관심 종목" value="" onChange={e => { if (e.target.value) navigate(`/saved/thesis/${encodeURIComponent(e.target.value)}`) }}><option value="">관심 종목 선택</option>{items.stocks.map(s => <option value={s.ticker} key={s.ticker}>{s.ticker} · {s.name}</option>)}</select></label>}
    {!!notes.length && <>
      <div className="research-filters" role="group" aria-label="투자 노트 검색과 필터">
        <label className="research-query">노트 검색<input type="search" maxLength={120} placeholder="티커·기업명·저장한 노트 내용" value={filters.query} onChange={e => setFilters({ ...filters, query: e.target.value })} /></label>
        <label>최신 판단<select value={filters.judgment} onChange={e => setFilters({ ...filters, judgment: e.target.value as typeof filters.judgment })}><option value="all">전체 판단</option>{Object.entries(JUDGMENTS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}<option value="none">판단 기록 없음</option></select></label>
        <label>확인 예정일<select value={filters.review} onChange={e => setFilters({ ...filters, review: e.target.value as typeof filters.review })}>{Object.entries(REVIEW_FILTERS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <button type="button" onClick={() => setFilters(defaultNoteFilters())}>노트 조건 초기화</button>
      </div>
      <p className="saved-note" role="status">노트 {visible.length}개 표시 · 전체 {notes.length}개 · 최근 수정순{filters.review !== 'all' && ' · 확인일은 한국 날짜 기준'}</p>
    </>}
    {visible.length ? <ul className="thesis-note-list">{visible.map(n => <li key={n.ticker}><Link to={`/saved/thesis/${encodeURIComponent(n.ticker)}`}><strong>{n.ticker}</strong><span>{n.name}</span><small>{n.history.length ? JUDGMENTS[n.history[n.history.length - 1].judgment] : '판단 기록 없음'} · 근거 {n.evidence?.filter(e => !e.archivedAt).length || 0}개 · 수정 {new Date(n.updatedAt).toLocaleDateString('ko-KR')}{n.reviewDate ? ` · 확인 예정 ${n.reviewDate}` : ''}</small></Link></li>)}</ul>
      : <p className="saved-note">{notes.length ? '조건에 맞는 투자 노트가 없습니다. 검색어나 필터를 바꿔보세요.' : '관심 종목을 선택해 첫 투자 노트를 만들어 보세요.'}</p>}
  </section>
}
