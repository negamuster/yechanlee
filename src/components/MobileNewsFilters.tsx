import { useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Drawer } from '@base-ui/react/drawer'
import { Check, X } from 'lucide-react'
import { defaultNewsFilters, matchingNews } from '../lib/newsFilters'
import type { NewsFilters } from '../lib/newsFilters'
import { TOPICS } from './newsSelection'
import type { NewsItem } from './newsSelection'
import './MobileNewsFilters.css'

export type MobileNewsFiltersProps = {
  id: string; value: NewsFilters; items: NewsItem[]; available: boolean; isRead: (url: string) => boolean
  onApply: (filters: NewsFilters) => void; onDismiss: () => void; returnFocus: RefObject<HTMLButtonElement | null>
}

export default function MobileNewsFilters({ id, value, items, available, isRead, onApply, onDismiss, returnFocus }: MobileNewsFiltersProps) {
  // Only a confirmed draft reaches the feed. Closing or resizing simply discards it.
  const [draft, setDraft] = useState<NewsFilters>(() => ({ ...value }))
  const close = useRef<HTMLButtonElement>(null)
  const resultCount = matchingNews(items, draft, isRead).length
  return <Drawer.Root open swipeDirection="down" onOpenChange={open => { if (!open) onDismiss() }}>
    <Drawer.Portal>
      <Drawer.Backdrop className="news-filter-backdrop" />
      <Drawer.Viewport className="news-filter-viewport">
        <Drawer.Popup id={id} className="news-filter-sheet" initialFocus={close} finalFocus={returnFocus}
          aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
    <div className="news-sheet-drag-area" aria-hidden="true"><span /></div>
    <header className="news-sheet-header">
      <div><Drawer.Title id={`${id}-title`}>뉴스 필터</Drawer.Title><Drawer.Description id={`${id}-description`}>원하는 조건을 고른 뒤 적용해 주세요.</Drawer.Description></div>
      <Drawer.Close ref={close} className="news-sheet-close" aria-label="뉴스 필터 닫기"><X size={20} aria-hidden="true" /></Drawer.Close>
    </header>
    <Drawer.Content className="news-sheet-body" data-base-ui-swipe-ignore>
      <fieldset><legend>지역</legend><div className="news-sheet-options news-sheet-regions">
        {([{ value: 'all', label: '전체' }, { value: 'global', label: '해외' }, { value: 'kr', label: '국내' }] as const).map(option =>
          <label key={option.value}><input type="radio" name={`${id}-region`} value={option.value} checked={draft.region === option.value} onChange={() => setDraft(current => ({ ...current, region: option.value }))} /><span><Check aria-hidden="true" />{option.label}</span></label>)}
      </div></fieldset>
      <fieldset><legend>주제</legend><div className="news-sheet-options">
        {[{ value: 'all' as const, label: '전체 주제' }, ...TOPICS].map(option =>
          <label key={option.value}><input type="radio" name={`${id}-topic`} value={option.value} checked={draft.topic === option.value} onChange={() => setDraft(current => ({ ...current, topic: option.value }))} /><span><Check aria-hidden="true" />{option.label}</span></label>)}
      </div></fieldset>
      <fieldset><legend>읽기 설정</legend>
        <label className="news-sheet-read"><input type="checkbox" checked={draft.hideRead} onChange={event => setDraft(current => ({ ...current, hideRead: event.target.checked }))} />
          <span>읽은 기사 숨기기<small>이 브라우저에서 연 기사 기준</small></span>
        </label>
      </fieldset>
      <fieldset><legend>표시 방식</legend><div className="news-sheet-options">
        {([{ value: 'list', label: '목록' }, { value: 'cards', label: '이미지 포함' }] as const).map(option =>
          <label key={option.value}><input type="radio" name={`${id}-view`} value={option.value} checked={draft.view === option.value} onChange={() => setDraft(current => ({ ...current, view: option.value }))} /><span><Check aria-hidden="true" />{option.label}</span></label>)}
      </div></fieldset>
      {(draft.query.trim() || draft.sector) && <section className="news-sheet-extra" aria-label="추가 적용 조건">
        <h3>추가 적용 조건</h3>
        {draft.query.trim() && <div><p>검색어: {draft.query}</p><button type="button" aria-label="검색 조건 해제" onClick={() => setDraft(current => ({ ...current, query: '' }))}>해제</button></div>}
        {draft.sector && <div><p>업종: {draft.sector.name} · 제목 키워드 기준</p><button type="button" aria-label="업종 조건 해제" onClick={() => setDraft(current => ({ ...current, sector: null }))}>해제</button></div>}
      </section>}
      <p className="news-sheet-note">주제는 기사 제목과 매체 분류를 기준으로 자동 분류합니다.</p>
    </Drawer.Content>
    <footer className="news-sheet-footer" data-base-ui-swipe-ignore>
      <p role="status">{available ? `이 조건에 맞는 기사 ${resultCount.toLocaleString('ko-KR')}개` : '뉴스를 불러오면 선택한 조건으로 표시합니다.'}</p>
      <div><button type="button" className="news-sheet-reset" onClick={() => setDraft(defaultNewsFilters(draft.view))}>조건 초기화</button>
        <button type="button" className="news-sheet-apply" onClick={() => onApply(draft)}>적용하기</button></div>
    </footer>
        </Drawer.Popup>
      </Drawer.Viewport>
    </Drawer.Portal>
  </Drawer.Root>
}
