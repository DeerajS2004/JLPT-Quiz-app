# 🗾 JLPT Practice

A calm, sidebar-driven JLPT (N5–N1) mock-test app with the hush and precision of a Japanese stationery shop. Built with **TanStack Start + React 19 + Tailwind v4**, and packaged as a cross-platform desktop app with **Electron**.

> Paper & Hanko palette · Modern Sans typography (Space Grotesk / DM Sans) · Sidebar layout

---

## Features

- **Daily mock tests** — load any JSON question set, sit a timed session
- **5 categories** — Kanji (漢字), Vocabulary (語彙), Grammar (文法), Reading (読解), Expression (表現)
- **Configurable timer** — simulate real exam pressure (or turn it off)
- **No-spoiler quiz flow** — answers stay hidden until the end
- **Typed-answer questions** — grade English, Japanese, and other language answers locally against accepted alternatives, with cautious typo tolerance
- **Study mode** — a single scrolling page showing every question with its answer and explanation, with search and no timer or scoring
- **Tabbed review** — Wrong / Correct / All on the results screen, defaulting to Wrong
- **Keyboard shortcuts** — `1–4` to pick an option, `← / →` to navigate, `Enter` to confirm
- **Practice statistics** — accuracy, streaks, per-category progress bars; deleted tests are excluded when totals are recalculated
- **Local-only, persistent** — history and stats use `localStorage`; saved JSON files and full per-file attempts use IndexedDB. Data stays on this device across restarts. No accounts, no cloud; clearing app/browser storage also clears local data.
- **Five recent reviews** — keep full question-by-question details for the five newest tests; deleting a result excludes it from statistics
- **History** — all test names, dates, and marks, with only wrong answers stored in each entry; delete one entry or clear history
- **Saved Files** — a separate tab with **Upload to save** for one or more JSON files, without starting or selecting a test or study session; files remain until deleted
- **File analysis** — every saved file's full attempts, right and wrong answers, best/latest/average marks, score trend, and per-question accuracy

---

## Question file format

Drop a JSON file like this into **Load Test** (or pick the bundled **JLPT N5 Kanji** set):

```json
{
  "title": "JLPT N5 Kanji — Complete Set",
  "description": "Optional description",
  "questions": [
    {
      "id": 1,
      "type": "kanji",
      "question": "「一」の意味は何ですか？",
      "reading": "いち / ひと",
      "options": ["One", "Two", "Three", "Ten"],
      "answer": 0,
      "explanation": "一 (ichi/hito) = One."
    }
  ]
}
```

| Field         | Type    | Notes                                                            |
| ------------- | ------- | ---------------------------------------------------------------- |
| `type`        | string  | `kanji` · `vocabulary` · `grammar` · `reading` · `expression`    |
| `options`     | array   | Required for multiple-choice questions; two or more choices      |
| `answer`      | integer | Required for multiple choice; 0-based index of the correct option |
| `format`      | string  | Set to `"typed"` for typed-answer questions; omit for multiple choice |
| `correctAnswers` | string[] | Required for typed questions; accepted answer forms           |
| `reading`     | string  | Optional furigana / reading hint                                 |
| `explanation` | string  | Shown on the results page                                        |

For typed answers, include accepted alternatives instead of asking for an exact match:

```json
{
  "id": 2,
  "type": "vocabulary",
  "format": "typed",
  "question": "Translate 学校 into English.",
  "correctAnswers": ["school", "a school"],
  "explanation": "学校 (がっこう) means school."
}
```

Grading happens entirely on the device. It normalizes Unicode form, capitalization, spaces, and punctuation, then allows only a small number of spelling differences for longer answers. It does not infer synonyms or semantic equivalence; add valid alternatives to `correctAnswers`.

Choose **Study set** after loading a file to enter the separate study section. Every question, answer, and explanation appears on one searchable scrolling page, without a timer or scoring. The selected set remains available locally after restarting the app.

A sample set lives at `public/quizzes/jlpt_n5_kanji_all.json` (110 N5 kanji questions).

---

## Run in the browser (dev)

```bash
bun install
bun run dev
```

Open <http://localhost:8080>.

Other handy scripts:

```bash
bun run build        # production build (nitro node-server → .output/)
bun run preview      # serve the production build
bun run lint
bun run format
```

---

## Run as a desktop app (Electron)

The app is wired up as an **Electron** desktop shell. The Electron main process lives at `electron/main.cjs`:

- **In dev**, it loads `http://localhost:8080` (the Vite dev server) — full hot reload.
- **In a packaged build**, it spawns the built Nitro node server (`.output/server/index.mjs`) on a free localhost port and points the window at it.

Quiz history, stats, and streaks live in `localStorage`, which Electron scopes to the app's per-user `userData` directory — so your progress persists across launches and updates automatically.

Saved JSON files and their full attempts live in IndexedDB on the same device. Open **Saved Files → Upload to save** to build your library without practicing immediately. Later, open **Load Test**, tick saved files, and choose **Start test** or **Study sets**. Multiple selected files run one after another. Re-uploading a file with the same title updates its saved copy. File deletion asks whether to also delete its attempts and analysis; history and dashboard totals are managed separately through result/history deletion.

### Prerequisites

- **Node + Bun** — required for both the web and desktop builds.
- **Linux system libs** — Electron on Pop!_OS / Ubuntu / Debian needs the standard GTK/graphics stack (usually already installed). If Electron fails to launch:
  ```bash
  sudo apt install -y libnss3 libatk-bridge2.0-0 libgtk-3-0 libgbm1 libasound2
  ```

### Develop the desktop app

```bash
bun run electron:dev
```

This starts `bun run dev` and, once the dev server responds on port 8080, opens the Electron window pointing at it. Edits hot-reload just like in the browser.

### Build a desktop package (Linux)

```bash
bun run electron:build
```

Output lands in `electron-release/JLPT Practice-linux-x64/`. Launch it directly:

```bash
./electron-release/"JLPT Practice-linux-x64"/"JLPT Practice"
```

Or archive it for sharing / installing on another Pop!_OS machine:

```bash
tar czf JLPT-Practice-linux-x64.tar.gz -C electron-release "JLPT Practice-linux-x64"
```

To install system-wide, drop the folder under `/opt/` and create a `.desktop` launcher pointing at the `JLPT Practice` binary inside it.

### Windows / macOS

The `electron:build` script targets Linux by default. To build for other platforms, run `electron-packager` with a different `--platform` flag on a machine of that OS (Electron cross-compiles from Linux for `win32`/`darwin`, but code-signing and installer creation are host-OS specific):

```bash
bunx electron-packager . "JLPT Practice" --platform=win32 --arch=x64 --out=electron-release --overwrite --prune=true
bunx electron-packager . "JLPT Practice" --platform=darwin --arch=arm64 --out=electron-release --overwrite --prune=true
```

For a proper `.msi` / `.dmg` installer you'll want `electron-builder` on Windows / macOS respectively.

---

## Releases via GitHub Actions (Linux and Windows)

`.github/workflows/build.yml` builds Linux AppImage and `.deb` packages plus a Windows `.exe` installer, then uploads them directly to GitHub Releases, not Actions artifacts. Push a `v*` tag to trigger it:

```bash
# bump "version" in package.json
git tag v0.1.1
git push origin v0.1.1
```

You can also run **Build Desktop Apps** manually from the repository's Actions tab. Supply a release tag, or leave it empty to use `v` followed by the version in `package.json`. The workflow creates the release if needed and replaces same-named downloads when rerun. Linux and Windows build on their respective GitHub runners using `bun run electron:dist`; downloads appear as each build finishes, not when the workflow first starts.

No secrets needed — the workflow uses the auto-provisioned `GITHUB_TOKEN`.

---

## Project layout

```
.
├── electron/main.cjs           # Electron main process
├── public/quizzes/             # bundled question sets
├── src/
│   ├── components/             # UI + shadcn primitives
│   ├── lib/                    # local quiz store, types, validation, and answer grading
│   ├── routes/                 # TanStack Start file-based routes
│   │   ├── __root.tsx          # app shell + sidebar
│   │   ├── index.tsx           # Dashboard
│   │   ├── load.tsx            # Load Test
│   │   ├── saved-files.tsx     # upload-to-save and local library management
│   │   ├── history.tsx         # marks and wrong answers for every test
│   │   ├── library.$fileId.tsx # full attempts and per-file analysis
│   │   ├── quiz.tsx            # Active quiz engine
│   │   ├── results.tsx         # Wrong / Correct / All tabs
│   │   ├── study.tsx           # untimed question review
│   │   └── instructions.tsx
│   └── styles.css              # Paper & Hanko design tokens
└── .github/workflows/build.yml    # tag/manual Linux and Windows releases
```

---

## Resetting progress

Use **Reset all progress** at the bottom of the Dashboard, or clear Electron's per-app storage:

- Linux: `~/.config/JLPT Practice/`
- Windows: `%APPDATA%\JLPT Practice\`
- macOS: `~/Library/Application Support/JLPT Practice/`

---

がんばって! 🎌

## Question library (manifest)

Bundled sets are listed in `public/quizzes/index.json`:

```json
[{ "id": "l3-vocab", "lesson": 3, "type": "vocabulary", "url": "/quizzes/l3_vocab.json", "title": "Lesson 3 Vocabulary", "description": "Optional" }]
```

The Load screen groups entries by lesson (newest first) and shows each file's type and question count. If the manifest is missing, the N5 Kanji set is shown instead. Tick several entries to run them one after another, then pick **10 / 20 / 50 / All** questions per set (a random subset). Completed sets count even if you exit between files; finishing early asks whether to save that test to statistics or ignore it.

## Optional question fields

- `hint` (string): shown as a badge and used as the typed-answer placeholder.
- `strict` (boolean, default false): typed answers must match exactly after normalization — no typo tolerance.

## Japanese IME note

Pressing Enter while the IME (e.g. Mozc) is still composing won't submit the answer. The 1–9 keys pick options by physical key, so they work whatever your keyboard layout.
