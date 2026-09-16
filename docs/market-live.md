# Yahoo Finance live player

The home page places Yahoo Finance's official YouTube player below Market
Overview and above Market Movers. It uses the same sidebar on desktop and the
existing stacked layout on mobile.

- Official video: https://www.youtube.com/watch?v=KQp-e_XQnDE
- Official channel fallback: https://www.youtube.com/@YahooFinance/live
- YouTube oEmbed returned HTTP 200, author `Yahoo Finance`, the requested title,
  and an iframe for this video on September 16, 2026. This verifies the published
  embed metadata; it does not guarantee uninterrupted live or regional playback.
- Load the privacy-enhanced youtube-nocookie iframe only when the visitor opens
  the player. `autoplay=0`: playback starts with YouTube's own play control.
- Preserve native playback/fullscreen/picture-in-picture controls and send an
  origin referrer using `strict-origin-when-cross-origin`. Do not suppress this
  referrer, which YouTube may need to identify the embedding client.
- Closing the video unmounts the iframe and stops audio/network playback.
- Use 16:9 sizing with a 200px minimum height for smaller layouts, following
  YouTube's minimum player viewport guidance. No new package, API key or server
  endpoint is required.
- No stream scraping, restreaming, download, embedding-restriction bypass,
  autoplay, or guessed "live now" status. A permanent channel link lets the user
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
