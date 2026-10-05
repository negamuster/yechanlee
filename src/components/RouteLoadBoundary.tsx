import { Component } from 'react'
import type { ReactNode } from 'react'
export default class RouteLoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <main className="route-loading" role="alert"><p>페이지를 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.</p><button type="button" onClick={() => window.location.reload()}>페이지 새로고침</button></main> : this.props.children
  }
}
