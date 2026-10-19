# History tab and saved quiz library

## What you will get

1. **History page (new sidebar tab)**
   - Lists every test you've taken: test name, date, score (e.g. 18/20, 90%).
   - Each entry keeps only the questions you got wrong (question, your answer, correct answer, explanation). Right answers are not stored here, so the history stays small and can grow without limit.
   - Delete a single entry, or clear all history (with a confirmation).
   - Deleting history entries also recalculates dashboard stats, same as deleting a saved result today.

2. **Saved quiz files (kept until you delete them)**
   - Every JSON file you upload is saved in the app automatically and stays there after closing or restarting.
   - On the Load page, a "My files" section lists them so you can test or study them again without re-uploading. Each has a delete button.
   - Uploading the same file again updates it instead of making a duplicate.

3. **Per-file analysis page**
   - Open any saved file to see:
     - Every attempt on that file: date, marks, percentage.
     - Best, latest and average score, and trend over attempts.
     - Per-question breakdown: times seen, times right, times wrong, accuracy; hardest questions first.
     - For each attempt, the full list of right and wrong answers.
   - Deleting a file asks whether to also delete its attempts.

## How the pieces relate

```text
Saved file  ──< full attempts (all answers)  -> file analysis page
Any test    ──> history entry (marks + wrong answers only) -> History tab
Dashboard stats = recalculated from history entries that still exist
```

The existing "last five results" on the dashboard stays as it is.

## Technical details

- Storage moves to IndexedDB (via a small `idb-keyval`-style helper) for files and full attempts, since localStorage (~5 MB) would fill up "forever"; history entries and the stats ledger can stay in localStorage or move alongside — both fully local/offline.
- New module `src/lib/library-store.ts`: `saveFile` (keyed by content hash + title), `listFiles`, `deleteFile`, `saveAttempt`, `listAttempts(fileId)`, `computeFileAnalysis`.
- `finalizeSession` also writes a history entry (wrong answers only) and, when the set came from a saved file, a full attempt. Merged/queued sets carry their source file id.
- Ledger keyed by history id so deleting history removes it from stats.
- New routes: `src/routes/history.tsx`, `src/routes/library.$fileId.tsx`; sidebar gets "History" link; load.tsx gets "My files".
- Uploads still go through `normalizeQuizJson` + `validateQuestionSet` before saving.
- Unit tests: history stores only wrong answers; deleting history recalculates stats; file analysis per-question counts; re-upload dedupes.
