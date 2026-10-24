# TODO — finishing the saved-file sort, folders, and mastery badges

Resume point: sorting and folder helpers + mastery calculation are DONE in
`src/lib/library-store.ts`; only the UI, docs, and tests below remain. Read
`src/routes/saved-files.tsx` (current version in this repo) before editing.

## Already done (do NOT redo)

- `library-store.ts` exports:
  - `FileSort = "newest" | "oldest" | "az" | "za"` and `sortFiles(files, sort)`.
  - `setFileFolder(id, folder)` — empty string removes the folder. Re-uploading
    the same title keeps the file's folder (`saveFile` preserves `prev.folder`).
  - `Mastery = "mastered" | "learning" | "struggling"`, `masteryFor(outcomesNewestFirst)`.
    Mastered = right 3+ times in a row (newest first). Struggling = missed latest
    or accuracy < 50%. Learning = everything else.
  - `computeFileAnalysis(attempts)` → each `QuestionAnalysis` already carries
    `streak` and `mastery`.
- JSZip backup/restore and Practice-missed retest are shipped and tested (36 tests).

## 1. Saved Files page (`src/routes/saved-files.tsx`)

- Add a sort control (Select) in the header area next to "Upload to save":
  Newest first / Oldest first / A → Z / Z → A. Default = newest (current order).
  Apply `sortFiles(files, sort)` to the list; keep selection in local state only.
- Add folder grouping:
  - New folder button: small inline input (folder name) → applies to selected files
    OR a per-file "Move to folder" action (icon button with `FolderInput`/`Folder`
    lucide icon). Empty name = "No folder".
  - List grouped by folder: files with a folder first under a folder heading
    (e.g. `N5 Kanji`), then "No folder" group last. Keep the Analysis + delete
    buttons per row unchanged.
  - Folder headings are labels only (no nested routes, no rename UI) — keep it
    simple, one level deep.

## 2. Analysis page (`src/routes/library.$fileId.tsx`)

- Show mastery stages from `computeFileAnalysis().questions[].mastery`:
  - Summary cards at top: counts of Mastered / Learning / Struggling
    (color: mastered = green, learning = amber/yellow, struggling = red —
    use semantic tokens, never raw `text-green-600` etc.; add tokens in
    `src/styles.css` if missing).
  - Per-question row badge next to accuracy: Mastered / Learning / Struggling.
- Keep everything else on the page unchanged.

## 3. Tests

- `src/lib/library-store.test.ts` already covers `missedQuestionSet` + backup.
  Add: `sortFiles` ordering for all four modes (one test per rule);
  `setFileFolder` set/clear round-trip via fake-indexeddb;
  `masteryFor` boundary cases (3-in-a-row → mastered; latest miss → struggling;
  <50% → struggling). Run with `bunx vitest run`.

## 4. Docs

- `README.md` + `src/routes/instructions.tsx`: one short note each that Saved
  Files can be sorted and grouped into folders, and the Analysis page shows
  Mastered / Learning / Struggling per question.
- `roadmap.md`: after finishing, add and check off items:
  "Add saved-file sorting and folders", "Show mastery stages on the analysis page".

## 5. Verify

- Build clean, all unit tests pass.
- Playwright smoke on `http://localhost:8080/saved-files`:
  sort A→Z reorders the list, moving a file into a folder groups it, and the
  analysis page shows the three mastery badges. Mobile viewport check optional.
- Dev server is already running at localhost:8080 — never restart it.
