import { Component, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { outsideDialog, presentModal } from '../lib/modal'

export function SearchLoadingDialog({ failed = false, onClose }: { failed?: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const release = presentModal(dialog.current!)
    button.current?.focus({ preventScroll: true })
    return release
  }, [])
  return <dialog id="site-command-menu" className="command-menu" ref={dialog} aria-label="통합 검색·빠른 이동"
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget && outsideDialog(event, event.currentTarget.getBoundingClientRect())) onClose() }}>
    <div className="command-heading"><strong>통합 검색·빠른 이동</strong><button ref={button} type="button" onClick={onClose}>검색 닫기</button></div>
    <p className="command-notice" role={failed ? 'alert' : 'status'}>{failed ? '검색을 불러오지 못했습니다. 연결 상태를 확인하고 페이지를 새로고침해 주세요.' : '검색을 불러오는 중…'}</p>
    {failed && <p className="command-notice"><button type="button" onClick={() => window.location.reload()}>페이지 새로고침</button></p>}
  </dialog>
}

export default class SearchLoadBoundary extends Component<{ children: ReactNode; onClose: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <SearchLoadingDialog failed onClose={this.props.onClose} /> : this.props.children
  }
}
