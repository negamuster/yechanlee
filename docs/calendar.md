# Economic and earnings calendar

The homepage widget sits below Yahoo Finance Live. `/calendar` shows the expanded monthly calendar with month navigation. The monthly grid and selected-day list use New York dates; exact release times display in KST by default, with a New York switch. KST dates are printed alongside times to make midnight rollover explicit. Date-only earnings remain US dates; no exact timestamp is fabricated from pre/after-market labels.

Sources (no new API key required):
- BLS official ICS: employment, CPI, PPI, JOLTS and other BLS releases.
- BEA official ICS: GDP, personal income/outlays (including PCE) and other BEA releases.
- Federal Reserve official calendar JSON: FOMC, minutes, Beige Book, Board speeches/testimony, conferences and calendar notices. Events coverage is limited to this calendar; federal holidays here do not imply equity market closures.
- Nasdaq earnings calendar: estimated schedules, including pre-market/after-hours/unknown. Dates must be confirmed with company IR. Actual results and consensus figures are not provided in this release.

`GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD` supports up to seven days. `mode=month` loads up to 31 days of BLS/BEA/Fed schedules without bulk earnings calls; `mode=earnings` loads only the selected US date. Ranges are bounded to 62 days back and 124 days ahead. Monthly dots show known schedule categories; earnings appear after selecting a date. Korean labels and major-release translations are the default, with original titles and an English title option. Same handler runs in Vite and Vercel. Each source is cached for 15 minutes; failures may reuse a successful response up to 24 hours old, explicitly marked stale. No persistent snapshot is guaranteed across serverless restarts. Failed sources are shown to the user and never interpreted as an empty calendar. The browser refreshes every 15 minutes and updates scheduled-time status every 30 seconds. A passed timestamp is labelled as such, not as confirmation of publication.

`major` is an editorial classification for CPI/PPI/employment/JOLTS/GDP/PCE/FOMC/Beige Book, not a vendor importance score. Coverage does not yet include a complete global economic calendar (e.g. ISM, Census or DOL releases), all company conferences, or Korea releases.

Validation: `node --test tests/calendar.test.mjs`; `npm run build`.

The desktop Live/Movers sidebar is sticky across the dashboard and news column. Its offset follows the measured header height. At widths up to 1000px it returns to normal flow above the articles to avoid covering content.
