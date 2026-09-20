import { useState } from 'react'
import './MarketLive.css'

// Yahoo Finance's official 24/7 stream, verified using YouTube oEmbed.
// A broadcast restart may require replacing this ID; keep the channel link usable.
const DEFAULT_VIDEO_ID = 'KQp-e_XQnDE'
const configuredId = import.meta.env.VITE_YAHOO_LIVE_VIDEO_ID?.trim()
const videoId = configuredId && /^[A-Za-z0-9_-]{11}$/.test(configuredId) ? configuredId : DEFAULT_VIDEO_ID
const channelUrl = 'https://www.youtube.com/@YahooFinance/live'
const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0`

export default function MarketLive() {
  const [opened, setOpened] = useState(true)

  return (
    <section className="market-live" aria-labelledby="market-live-heading">
      <div className="market-live-heading">
        <h2 id="market-live-heading">Yahoo Finance Live</h2>
        <span>영어 방송</span>
      </div>
      <p className="market-live-description">24/7 Stream · Daily Market Coverage &amp; more</p>
      <div className="market-live-frame" id="market-live-player">
        {opened ? <iframe
          src={embedUrl}
          title="Yahoo Finance 24/7 Stream: Daily Market Coverage & more"
          width="640" height="360"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        /> : <button type="button" className="market-live-open"
          aria-controls="market-live-player" onClick={() => setOpened(true)}>
          <span className="market-live-play" aria-hidden="true">▶</span>
          <strong>방송 플레이어 열기</strong>
          <span>Yahoo Finance 공식 YouTube</span>
        </button>}
      </div>
      <div className="market-live-actions">
        <a href={channelUrl} target="_blank" rel="noopener noreferrer">YouTube에서 보기 ↗</a>
        {opened && <button type="button" onClick={() => setOpened(false)}>영상 닫기</button>}
      </div>
      <p className="market-live-note">음소거 상태로 자동 재생됩니다. 소리는 플레이어에서 켤 수 있습니다. 자동 재생이 차단되면 재생 버튼을 눌러 주세요.</p>
    </section>
  )
}
