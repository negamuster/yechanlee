# Selection, briefing and bookmark feedback

Maps, Market Movers and home briefing selectors share a Motion selection highlight. Each group has a React-generated layout ID so multiple widgets do not share an indicator. The transition lasts 180ms; existing native button semantics, saved selections, compact desktop sizes and mobile touch targets are retained.

Mobile briefing summaries and detail panels expand and collapse with height and opacity transitions. Closed and exiting panels become inert and hidden from assistive technology immediately. The detail content is removed after its exit transition. Desktop briefing sections crossfade without changing their data, citations or price/time basis. Initial renders do not animate.

Bookmark controls pulse only after a successful browser-storage write. Sonner shows a six-second save or unsave notice with an undo action. Undo reads the latest stored collection and changes only the affected article. Existing bulk-delete/stock-removal undo retains its thirty-second deadline in a separate, stacked notice. Notifications sit above mobile navigation, use the site's blue-gray controls and retain 44px touch targets.

Motion respects the device's reduced-motion setting; custom height/fade/pulse durations also become zero. Sonner's reduced-motion styles disable its transitions.

Validation: `node --test tests/*.test.mjs` and `npm run build`. The interaction tests use jsdom and real React events to cover selections, interruption, collapsed-content accessibility, duplicate bookmark state, storage failures, other-tab additions and undo. jsdom does not validate painted positions, actual touch gestures or animation appearance; these still require a real browser.
