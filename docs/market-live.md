# Yahoo Finance live player

The home page places Yahoo Finance's official YouTube player in the sidebar above Market Movers, below the page-wide market ticker. It uses the same sidebar on desktop and the
existing stacked layout on mobile.

- Official video: https://www.youtube.com/watch?v=KQp-e_XQnDE
- Official channel fallback: https://www.youtube.com/@YahooFinance/live
- YouTube oEmbed returned HTTP 200, author `Yahoo Finance`, the requested title,
  and an iframe for this video on September 16, 2026. This verifies the published
  embed metadata; it does not guarantee uninterrupted live or regional playback.
- Load the privacy-enhanced youtube-nocookie iframe on page open with
  `autoplay=1&mute=1` and autoplay permission. Visitors can unmute with native controls.
  Browser settings can still require pressing play.
- Preserve native playback/fullscreen/picture-in-picture controls and send an
  origin referrer using `strict-origin-when-cross-origin`. Do not suppress this
  referrer, which YouTube may need to identify the embedding client.
- Closing the video unmounts the iframe and stops audio/network playback.
- Use 16:9 sizing with a 200px minimum height for smaller layouts, following
  YouTube's minimum player viewport guidance. No new package, API key or server
  endpoint is required.
- No stream scraping, restreaming, download, embedding-restriction bypass,
  or guessed "live now" status. A permanent channel link lets the user
  view the official broadcast if the embedded video stops or becomes restricted.
- The video ID is intentionally fixed, not dynamically discovered. If Yahoo
  restarts the stream under another ID, update `DEFAULT_VIDEO_ID` or set the
  optional build-time `VITE_YAHOO_LIVE_VIDEO_ID` to its verified 11-character ID
  and redeploy. Invalid overrides fall back to the verified default.

References:
- https://developers.google.com/youtube/player_parameters
- https://support.google.com/youtube/answer/171780

Validation: TypeScript and production build. Playback inside an authenticated
Vercel preview/browser has not been verified by the agent.
