import { Component, lazy, Suspense, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { MobileNewsFiltersProps } from './MobileNewsFilters'
import { outsideDialog, presentModal } from '../lib/modal'
import './MobileNewsFilters.css'

const MobileNewsFilters = lazy(() => import('./MobileNewsFilters'))

function FilterLoading({ id, failed = false, onDismiss }: { id: string; failed?: boolean; onDismiss: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const backdropPointer = useRef(false)
  useEffect(() => presentModal(dialog.current!), [])
  return <dialog ref={dialog} id={id} className="news-filter-sheet news-filter-loading" aria-label="뉴스 필터"
    onCancel={event => { event.preventDefault(); onDismiss() }}
    onPointerDown={event => { backdropPointer.current = event.target === event.currentTarget && outsideDialog(event, event.currentTarget.getBoundingClientRect()) }}
    onClick={event => {
      if (backdropPointer.current && event.target === event.currentTarget && outsideDialog(event, event.currentTarget.getBoundingClientRect())) onDismiss()
      backdropPointer.current = false
    }}>
    <header className="news-sheet-header"><h2>뉴스 필터</h2><button type="button" className="news-sheet-close" aria-label="뉴스 필터 닫기" autoFocus onClick={onDismiss}>×</button></header>
    <div className="news-sheet-body"><p role={failed ? 'alert' : 'status'}>{failed ? '필터를 불러오지 못했습니다. 연결 상태를 확인하고 페이지를 새로고침해 주세요.' : '필터를 불러오는 중…'}</p>
      {failed && <button type="button" onClick={() => window.location.reload()}>페이지 새로고침</button>}
    </div>
  </dialog>
}

class FilterLoadBoundary extends Component<{ children: ReactNode; id: string; onDismiss: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <FilterLoading id={this.props.id} failed onDismiss={this.props.onDismiss} /> : this.props.children }
}

export default function MobileNewsFiltersLoader(props: MobileNewsFiltersProps) {
  return <FilterLoadBoundary id={props.id} onDismiss={props.onDismiss}>
    <Suspense fallback={<FilterLoading id={props.id} onDismiss={props.onDismiss} />}><MobileNewsFilters {...props} /></Suspense>
  </FilterLoadBoundary>
}
