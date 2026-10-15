# 🗾 JLPT N4 Daily Practice

A desktop application for daily JLPT N4 mock tests, built with Python and Tkinter. Load custom question sets in JSON format, sit timed practice sessions, and track your progress over time with per-category statistics and streaks.

---

## Features

- **Daily mock tests** — Load any JSON question file and run a timed session
- **Five question categories** — Kanji (漢字), Vocabulary (語彙), Grammar (文法), Reading (読解), and Expression (表現)
- **Countdown timer** — Configurable per session to simulate real exam pressure
- **Results review** — Detailed breakdown after each test with explanations for every question
- **Statistics dashboard** — Lifetime accuracy, total questions answered, daily streak, and per-category performance bars
- **Session history** — Last 12 sessions shown on the dashboard with scores and timestamps
- **Keyboard shortcuts** — Navigate questions and select answers without touching the mouse

---

## Requirements

- Python 3.x
- Tkinter (`python3-tk`)

No third-party Python packages are required.

---

## Installation (Linux — Pop!\_OS / Ubuntu)

Clone or download this repository, then run the install script:

```bash
bash install.sh
```

The installer will:

1. Check for Python 3 and install `python3-tk` if missing
2. Copy the app to `~/.local/share/jlpt_n4/`
3. Register it as a desktop application (searchable in your app launcher)
4. Create a desktop shortcut at `~/Desktop/jlpt-n4.desktop`
5. Clear any previous statistics for a fresh start

After installation, launch the app from your application launcher (search **JLPT**) or directly from the terminal:

```bash
python3 ~/.local/share/jlpt_n4/jlpt_n4_app.py
```

> **Pop!\_OS note:** If the desktop icon doesn't launch, right-click it and select **Allow Launching**.

---

## Running Without Installing

```bash
python3 jlpt_n4_app.py
```

---

## Question File Format

Question sets are plain JSON files. Load them from the **Load Test** screen inside the app. The expected structure is:

```json
{
  "day": "N5-Foundation",
  "date": "2026-03-19",
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
      "explanation": "一 (ichi/hito) = One. e.g. 一つ (hitotsu) = one thing."
    }
  ]
}
```

| Field         | Type     | Description                                              |
|---------------|----------|----------------------------------------------------------|
| `type`        | string   | One of: `kanji`, `vocabulary`, `grammar`, `reading`, `expression` |
| `options`     | array    | 4 answer choices                                         |
| `answer`      | integer  | 0-based index of the correct option                      |
| `reading`     | string   | Optional furigana / reading hint                         |
| `explanation` | string   | Shown after answering; supports free-form text           |

A sample question set (`jlpt_n5_kanji_all.json`, 110 questions) is included.

---

## Data & Statistics

User data is stored locally in `~/.jlpt_n4/`:

| File               | Contents                              |
|--------------------|---------------------------------------|
| `statistics.json`  | Lifetime stats, streak, category data |
| `sessions.json`    | History of completed sessions         |
| `last_results.json`| Results from the most recent test     |

Delete these files to reset all progress.

---

## Project Structure

```
jlpt-main/
├── jlpt_n4_app.py          # Main application
├── jlpt_n5_kanji_all.json  # Sample question set (110 N5 kanji questions)
├── install.sh              # Linux desktop installer
├── make_icon.py            # Icon generator script
├── jlpt_n4_icon.png        # App icon
└── README.md
```
