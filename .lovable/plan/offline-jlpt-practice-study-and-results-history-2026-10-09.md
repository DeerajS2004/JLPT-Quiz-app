# Offline JLPT practice, study, and results history

## What will change
- Remove Gemini generation completely, including its screen, server files, performance-data prompt support, environment-variable documentation, and related dependencies.
- Remove the public MCP/agent integration and its generated endpoints and registration, so the app no longer exposes online agent tools.
- Add a Study section for uploaded JSON question sets. Study one question at a time, reveal its answer and explanation, and move between questions without a timer or score. Keep the selected study set available locally after restarting the desktop app.
- Add typed-answer questions to imported JSON while retaining existing multiple-choice sets. Grade answers locally using normalized text, listed acceptable answers, and conservative typo tolerance; show typed answers in the completed review.
- Keep complete details for only the five most recent tests. Show test name, percentage, and correct/total, with access to each saved test’s full review. Allow deleting a selected result with confirmation.
- Preserve lifetime statistics when a saved result is removed, as requested; result removal changes the saved result history only.
- Keep quiz sets, study, answers, and history local so ordinary use requires no internet connection.

## Technical details
- Extend the existing question JSON format with optional typed-answer fields and update validation without breaking existing multiple-choice files.
- Keep imported study material and the capped result archive in the existing local persistence approach used by the Electron app.
- Add a Study navigation entry and use the existing results screen for the five-item history and selected-test review.
- Update the README to describe offline behavior, typed-answer JSON fields, study mode, and five-result history; remove Gemini/MCP setup instructions.
- Verify legacy and typed JSON loading, fuzzy answer grading, five-result retention, deleting one result without changing lifetime totals, study reveal/navigation, and that the preview builds without the removed integrations.
