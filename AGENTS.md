<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep quiz grading and study interactions local, with study mode in its own route, so offline practice stays focused and independently navigable.
- Desktop Actions creates or reuses one GitHub Release before platform builds and uploads packages with the GitHub CLI; this avoids concurrent release creation and keeps downloads on Releases.
- Normalize uploaded and bundled quiz JSON through the shared quiz-store helper before unchanged validation; this keeps compatibility repairs and their counts consistent across import paths.
- Use the shared quiz-file-import helper for uploaded-file validation and library saving; importing must not select or start practice, so the Saved Files page remains independent of Load Test.
- Keep files and full attempts in the local IndexedDB library and manage deletion on Saved Files; Load Test only selects saved files, keeping offline storage separate from session state.
- Route all library backup/restore through src/lib/backup.ts and missed-question retests through missedQuestionSet, so ids, dedupe, and stats-leadger rules stay consistent everywhere.
