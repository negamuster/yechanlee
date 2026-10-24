# Note discovery and backup request status

## Goal and acceptance criteria

Find saved investment notes and their evidence without changing personal records. Explain whether saved data differs from the last requested export, without claiming that a browser download finished.

- Notes: search ticker, company, saved prose and judgment reasons; combine latest judgment and review-date filters. Review dates use the site's Korean calendar date: due includes today, upcoming means the next seven days excluding today. Keep latest-modified ordering.
- Evidence: search title, publisher and attachment reason; combine kind, role and active/archived filters, with newest/oldest attachment ordering. Default to active evidence. Show result counts, empty results and reset controls.
- Keep filters in this tab's session, independently for each note. Filtering must not change drafts, evidence IDs, original financial values, judgment references or backups. A direct evidence fragment must remain visible even outside the current filters; historical evidence is always independent of list filters.
- Backup status remains visible while the backup details are collapsed. Show the last export-request time and whether the current saved payload is identical, changed or cannot be compared. A SHA-256 digest detects edits even when record counts and timestamps remain unchanged. A restored identical payload can match again.
- Keep only request time and digest in a separate browser-local status key. Record a request only after the download click succeeds. Metadata/hash failure must not block an otherwise valid export or falsely report a matching payload. Missing or unreadable metadata is not proof that no backup file exists.
- Keep backup v3 and v1/v2 import compatibility unchanged. Export includes all saved records, including archived evidence and judgment references; filters and unsaved drafts are excluded. Import alone does not update export-request status. No server upload or sync is added.

## Scope and verification

Limit changes to the saved-page note list, evidence list, backup status, shared pure selectors/status helpers, related styling and regression checks. README, command entry points, CI redesign, main merge and production deployment are outside this request.

Use deterministic tests for combined filters, Korean date boundaries, immutable ordering, content-level backup comparison, malformed/blocked status storage and legacy backup round trips. Desktop and mobile Chromium scenarios must cover filters and return navigation, drafts, historical/direct evidence visibility, download request status and failed status writes. Run the full existing Node/build/browser checks on the integrated SHA and obtain an implementer-independent review of storage/backup safety before marking the PR ready.

## Limits

Status is specific to this browser and can disappear with site data. It describes the requested file's payload, not the presence or integrity of a file on disk. Session-only drafts remain excluded until saved. Mobile Chromium emulation does not verify a physical device or Safari.
