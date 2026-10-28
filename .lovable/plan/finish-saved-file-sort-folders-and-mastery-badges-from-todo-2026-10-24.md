# Finish saved-file sort, folders, and mastery badges (from TODO.md)

The logic layer is already done and tested by hand-verification only: `sortFiles`,
`setFileFolder`, `masteryFor`, and `computeFileAnalysis` (with `streak` + `mastery`
per question) all exist in `src/lib/library-store.ts`. This plan adds the UI,
tests, docs, and verification described in TODO.md.

## 1. Saved Files page — `src/routes/saved-files.tsx`

- Sort control: a `Select` next to the header buttons with
  Newest first / Oldest first / A → Z / Z → A. Default `newest` (current order),
  kept in local state only. Render the list as `sortFiles(files, sort)`.
- Folder move: a per-row icon button (lucide `FolderInput`, label "Move to folder")
  that opens a small inline input for the folder name; empty name = "No folder"
  (calls `setFileFolder(file.id, name)` and refreshes the list). No selection
  checkbox, no rename UI — one level deep, labels only.
- Grouped list: files with a folder first, grouped under a folder heading
  (e.g. "N5 Kanji", folders sorted A→Z, files inside follow the chosen sort),
  then a "No folder" group last. Analysis and delete buttons stay per row, unchanged.

## 2. Analysis page — `src/routes/library.$fileId.tsx`

- Summary cards at top: counts of Mastered / Learning / Struggling, derived from
  `computeFileAnalysis(attempts).questions[].mastery`. Colors via new semantic
  tokens: mastered = green, learning = amber, struggling = red
  (`--mastery-mastered` / `--mastery-learning` / `--mastery-struggling` in
  `src/styles.css`, mapped in `@theme inline`, with `.dark` variants — no raw
  `text-green-600` style classes).
- Per-question badge (Mastered / Learning / Struggling) next to the existing
  accuracy line, using the same tokens.
- Everything else on the page stays unchanged.

## 3. Tests — extend `src/lib/library-store.test.ts`

- `sortFiles`: one test per rule (newest, oldest, az, za) on a fixed file list.
- `setFileFolder`: set then clear round-trip against fake-indexeddb.
- `masteryFor`: 3 right in a row → mastered; latest miss → struggling;
  accuracy under 50% → struggling (boundary cases).
- Run with `bunx vitest run`.

## 4. Docs

- `README.md` and `src/routes/instructions.tsx`: one short note each — Saved Files
  can be sorted and grouped into folders; the Analysis page shows
  Mastered / Learning / Struggling per question.
- `roadmap.md`: add and check off "Add saved-file sorting and folders" and
  "Show mastery stages on the analysis page".

## 5. Verify

- `bunx vitest run` — all tests pass (existing 36 + new ones).
- Build clean (check the build log; fix any errors it shows).
- Playwright smoke on `http://localhost:8080/saved-files` (dev server already
  running — never restart): A→Z reorders the list, moving a file into a folder
  groups it, and the analysis page shows the three mastery badges. Mobile
  viewport check optional.
