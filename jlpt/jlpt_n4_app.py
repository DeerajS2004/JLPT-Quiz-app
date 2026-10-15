#!/usr/bin/env python3
"""
JLPT N4 Daily Mock Test — v4
CRASH-PROOF: No bind_all, direct widget scroll binding only.
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import json, datetime, random, traceback
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────
DATA_DIR     = Path.home() / ".jlpt_n4"
STATS_FILE   = DATA_DIR / "statistics.json"
SESSION_FILE = DATA_DIR / "sessions.json"
RESULTS_FILE = DATA_DIR / "last_results.json"
DATA_DIR.mkdir(exist_ok=True)

# ── Palette ────────────────────────────────────────────────────────────────
C = {
    "bg"       : "#12111A",
    "panel"    : "#1C1B28",
    "panel2"   : "#252438",
    "border"   : "#2E2D42",
    "accent"   : "#E8445A",
    "gold"     : "#F0B429",
    "green"    : "#3DDC84",
    "red"      : "#FF5A5F",
    "blue"     : "#5B8CFF",
    "text"     : "#EEE8D5",
    "muted"    : "#7C7A95",
    "hover"    : "#2A2940",
    "sel"      : "#2E1F3B",
    "sel_bdr"  : "#9B5DE5",
    "correct"  : "#1A3A2F",
    "correct_b": "#3DDC84",
    "wrong"    : "#3A1A1E",
    "wrong_b"  : "#FF5A5F",
    "sidebar"  : "#0F0E18",
}

FN = {
    "h1"   : ("Helvetica", 22, "bold"),
    "h2"   : ("Helvetica", 16, "bold"),
    "h3"   : ("Helvetica", 13, "bold"),
    "body" : ("Helvetica", 12),
    "sm"   : ("Helvetica", 10),
    "xs"   : ("Helvetica", 9),
    "jp"   : ("TkDefaultFont", 15),
    "jp_sm": ("TkDefaultFont", 12),
    "mono" : ("Courier", 10),
    "btn"  : ("Helvetica", 11, "bold"),
    "timer": ("Courier", 20, "bold"),
}

QTYPES = {
    "kanji"      : ("漢字", "Kanji",       C["blue"]),
    "vocabulary" : ("語彙", "Vocabulary",  C["gold"]),
    "grammar"    : ("文法", "Grammar",     "#A78BFA"),
    "reading"    : ("読解", "Reading",     "#38BDF8"),
    "expression" : ("表現", "Expression",  "#FB923C"),
}

# ── JSON helpers ───────────────────────────────────────────────────────────
def load_json(p, default):
    try:
        return json.loads(Path(p).read_text("utf-8"))
    except Exception:
        return default

def save_json(p, d):
    Path(p).write_text(json.dumps(d, ensure_ascii=False, indent=2), "utf-8")

def load_stats():
    return load_json(STATS_FILE, {
        "total_tests": 0, "total_questions": 0, "total_correct": 0,
        "by_type": {}, "daily_scores": [], "streak": 0, "last_test_date": None
    })

def save_stats(s):     save_json(STATS_FILE, s)
def load_sessions():   return load_json(SESSION_FILE, [])
def save_sessions(s):  save_json(SESSION_FILE, s)

def fmt_time(secs):
    m, s = divmod(int(max(0, secs)), 60)
    return f"{m:02d}:{s:02d}"

# ── Scroll helper — NO bind_all, ever ─────────────────────────────────────
def _attach_scroll(widget, canvas_or_text):
    """Bind mousewheel on widget (and recursively its children) to scroll target."""
    target = canvas_or_text

    def _scroll(e):
        try:
            if not target.winfo_exists():
                return
            # Linux uses Button-4/5; Windows/Mac uses MouseWheel delta
            if e.num == 4 or (hasattr(e, 'delta') and e.delta > 0):
                target.yview_scroll(-1, "units")
            elif e.num == 5 or (hasattr(e, 'delta') and e.delta < 0):
                target.yview_scroll(1, "units")
        except Exception:
            pass

    def _bind_tree(w):
        try:
            w.bind("<MouseWheel>", _scroll)   # Windows / Mac
            w.bind("<Button-4>",   _scroll)   # Linux scroll up
            w.bind("<Button-5>",   _scroll)   # Linux scroll down
        except Exception:
            pass
        for child in w.winfo_children():
            _bind_tree(child)

    _bind_tree(widget)


def make_scrollable(parent, bg=None):
    """
    Returns (outer_frame, inner_frame).
    Scroll is bound directly — no bind_all, no global state.
    """
    bg = bg or C["bg"]
    outer  = tk.Frame(parent, bg=bg)
    canvas = tk.Canvas(outer, bg=bg, highlightthickness=0, bd=0)
    sb     = ttk.Scrollbar(outer, orient="vertical", command=canvas.yview)
    inner  = tk.Frame(canvas, bg=bg)

    win = canvas.create_window((0, 0), window=inner, anchor="nw")

    def _on_canvas_resize(e):
        try:
            canvas.itemconfig(win, width=canvas.winfo_width())
        except Exception:
            pass

    def _on_inner_resize(e):
        try:
            canvas.configure(scrollregion=canvas.bbox("all"))
        except Exception:
            pass

    canvas.bind("<Configure>", _on_canvas_resize)
    inner.bind("<Configure>",  _on_inner_resize)
    canvas.configure(yscrollcommand=sb.set)

    # Bind scroll directly on canvas and inner frame — safe, no global binding
    _attach_scroll(canvas, canvas)
    _attach_scroll(inner,  canvas)

    sb.pack(side="right", fill="y")
    canvas.pack(side="left", fill="both", expand=True)
    return outer, inner


# ── Widget helpers ─────────────────────────────────────────────────────────
def card(parent, **kw):
    kw.setdefault("bg", C["panel"])
    kw.setdefault("padx", 18)
    kw.setdefault("pady", 14)
    return tk.Frame(parent, relief="flat",
                    highlightthickness=1,
                    highlightbackground=C["border"], **kw)

def divider(parent, color=None):
    return tk.Frame(parent, bg=color or C["border"], height=1)

def mkbtn(parent, text, cmd, accent=False, **kw):
    bg = C["accent"] if accent else C["panel2"]
    ab = "#FF6B7A"   if accent else C["hover"]
    return tk.Button(
        parent, text=text, command=cmd,
        bg=bg, fg=C["text"], relief="flat", cursor="hand2",
        font=kw.pop("font", FN["btn"]),
        padx=kw.pop("padx", 18), pady=kw.pop("pady", 10),
        activebackground=ab, activeforeground=C["text"], bd=0, **kw
    )

def selectable_text(parent, content, height=None, font=None, **kw):
    """
    A read-only but fully selectable Text widget with safe scroll binding.
    Returns the Text widget.
    """
    kw.setdefault("bg", C["panel2"])
    kw.setdefault("fg", C["text"])
    f = tk.Frame(parent, bg=kw["bg"],
                 highlightthickness=1, highlightbackground=C["border"])
    f.pack(fill="both", expand=True)

    cfg = dict(
        font=font or FN["mono"],
        bg=kw["bg"], fg=kw["fg"],
        selectbackground=C["sel_bdr"], selectforeground="white",
        insertbackground=C["text"],
        relief="flat", padx=14, pady=10,
        wrap="word", cursor="xterm",
    )
    if height:
        cfg["height"] = height

    sb = ttk.Scrollbar(f, orient="vertical")
    t  = tk.Text(f, yscrollcommand=sb.set, **cfg)
    sb.config(command=t.yview)
    sb.pack(side="right", fill="y")
    t.pack(fill="both", expand=True)

    if content:
        t.insert("1.0", content)
    t.config(state="disabled")

    # Safe direct scroll binding
    _attach_scroll(t,  t)
    _attach_scroll(sb, t)
    return t


# ══════════════════════════════════════════════════════════════════════════
class JLPTApp(tk.Tk):

    def __init__(self):
        super().__init__()
        self.title("JLPT N4 — Daily Practice")
        self.configure(bg=C["bg"])
        self.geometry("1060x700")
        self.minsize(880, 560)

        self.stats     = load_stats()
        self.sessions  = load_sessions()
        self.questions = []
        self.answers   = []
        self.cur_q     = 0
        self.meta      = {}
        self._sel_var  = tk.IntVar(value=-1)
        self._timer_id = None
        self._elapsed  = 0
        self._running  = False
        self._in_test  = False
        self._opt_frames  = []
        self._qmap_btns   = []
        self._q_start     = 0
        self._time_per_q  = []

        self._build_shell()
        self._bind_keys()
        self._show_dashboard()

    # ── Shell ──────────────────────────────────────────────────────────────
    def _build_shell(self):
        self.sidebar = tk.Frame(self, bg=C["sidebar"], width=210)
        self.sidebar.pack(side="left", fill="y")
        self.sidebar.pack_propagate(False)

        logo = tk.Frame(self.sidebar, bg=C["sidebar"], pady=22)
        logo.pack(fill="x")
        tk.Label(logo, text="N4", font=("Helvetica", 36, "bold"),
                 bg=C["sidebar"], fg=C["accent"]).pack()
        tk.Label(logo, text="JLPT Practice",   font=FN["sm"],
                 bg=C["sidebar"], fg=C["muted"]).pack()
        tk.Label(logo, text="日本語能力試験", font=FN["jp_sm"] if "jp_sm" in FN else FN["sm"],
                 bg=C["sidebar"], fg=C["muted"]).pack()

        divider(self.sidebar).pack(fill="x", padx=12)

        self._nav_btns = {}
        for key, ico, txt, cmd in [
            ("dashboard", "⌂", " Dashboard",  self._show_dashboard),
            ("load",      "↑", " Load Test",  self._show_load),
            ("stats",     "◉", " Statistics", self._show_stats),
        ]:
            b = tk.Button(self.sidebar,
                          text=f"  {ico}  {txt}",
                          bg=C["sidebar"], fg=C["muted"],
                          relief="flat", anchor="w",
                          font=FN["body"], cursor="hand2",
                          activebackground=C["hover"],
                          activeforeground=C["text"],
                          bd=0, padx=14, pady=11,
                          command=cmd)
            b.pack(fill="x")
            self._nav_btns[key] = b

        self._qmap_container  = tk.Frame(self.sidebar, bg=C["sidebar"])
        self._qmap_container.pack(fill="x", padx=8, pady=4)

        self._shortcut_panel = tk.Frame(self.sidebar, bg=C["sidebar"])
        self._shortcut_panel.pack(side="bottom", fill="x", padx=12, pady=14)

        self.content = tk.Frame(self, bg=C["bg"])
        self.content.pack(side="right", fill="both", expand=True)

    def _set_nav(self, key):
        for k, b in self._nav_btns.items():
            b.config(bg=C["hover"] if k == key else C["sidebar"],
                     fg=C["text"]  if k == key else C["muted"])

    def _clear(self):
        """Destroy all content widgets. Safe — no global scroll bindings to worry about."""
        for w in list(self.content.winfo_children()):
            try:
                w.destroy()
            except Exception:
                pass

    def _clear_sidebar_dynamic(self):
        for container in [self._qmap_container, self._shortcut_panel]:
            for w in list(container.winfo_children()):
                try:
                    w.destroy()
                except Exception:
                    pass

    # ── Keyboard ───────────────────────────────────────────────────────────
    def _bind_keys(self):
        self.bind("<Right>",  lambda e: self._kb_next())
        self.bind("<Return>", lambda e: self._kb_next())
        self.bind("<Left>",   lambda e: self._kb_prev())
        for i in range(4):
            self.bind(f"<Key-{i+1}>",    lambda e, n=i: self._kb_sel(n))
            self.bind(f"<Key-KP_{i+1}>", lambda e, n=i: self._kb_sel(n))

    def _kb_next(self):
        if not self._in_test: return
        if self.cur_q < len(self.questions) - 1:
            self._nav(1)
        else:
            self._confirm_finish()

    def _kb_prev(self):
        if self._in_test: self._nav(-1)

    def _kb_sel(self, idx):
        if not self._in_test: return
        q = self.questions[self.cur_q]
        if idx < len(q.get("options", [])):
            self._sel_var.set(idx)
            self._highlight_option(idx)

    # ── Timer ──────────────────────────────────────────────────────────────
    def _start_timer(self):
        self._elapsed = 0
        self._running = True
        self._tick()

    def _tick(self):
        if not self._running: return
        self._elapsed += 1
        try:
            if hasattr(self, "_tlabel") and self._tlabel.winfo_exists():
                self._tlabel.config(text=fmt_time(self._elapsed))
        except Exception:
            pass
        self._timer_id = self.after(1000, self._tick)

    def _stop_timer(self):
        self._running = False
        if self._timer_id:
            try: self.after_cancel(self._timer_id)
            except Exception: pass
            self._timer_id = None

    # ══════════════════════════════════════════════════════════════════════
    #  Dashboard
    # ══════════════════════════════════════════════════════════════════════
    def _show_dashboard(self):
        self._stop_timer()
        self._in_test = False
        self._set_nav("dashboard")
        self._clear()
        self._clear_sidebar_dynamic()
        s = self.stats

        pad = tk.Frame(self.content, bg=C["bg"], padx=28, pady=20)
        pad.pack(fill="both", expand=True)

        tk.Label(pad, text=datetime.date.today().strftime("%A, %d %B %Y"),
                 font=FN["xs"], bg=C["bg"], fg=C["muted"]).pack(anchor="w")
        tk.Label(pad, text="おはようございます！",
                 font=FN["h1"], bg=C["bg"], fg=C["text"]).pack(anchor="w")
        tk.Label(pad, text="Ready for today's practice?",
                 font=FN["sm"], bg=C["bg"], fg=C["muted"]).pack(anchor="w", pady=(0, 16))

        # Stat cards
        row = tk.Frame(pad, bg=C["bg"])
        row.pack(fill="x", pady=(0, 20))
        acc = s["total_correct"] / max(s["total_questions"], 1) * 100
        for ico, val, lbl, col in [
            ("📝", str(s["total_tests"]),      "Tests Taken", C["blue"]),
            ("🎯", f"{acc:.1f}%",              "Accuracy",    C["green"]),
            ("🔥", f"{s.get('streak',0)}d",    "Streak",      C["gold"]),
            ("✏️", str(s["total_questions"]), "Questions",   C["muted"]),
        ]:
            c = card(row, bg=C["panel"], padx=14, pady=12)
            c.pack(side="left", fill="both", expand=True, padx=(0, 10))
            tk.Label(c, text=ico,  bg=C["panel"], font=("TkDefaultFont", 22)).pack()
            tk.Label(c, text=val,  bg=C["panel"],
                     font=("Helvetica", 20, "bold"), fg=col).pack()
            tk.Label(c, text=lbl,  bg=C["panel"],
                     font=FN["xs"], fg=C["muted"]).pack()

        # Two columns
        cols = tk.Frame(pad, bg=C["bg"])
        cols.pack(fill="both", expand=True)
        L = tk.Frame(cols, bg=C["bg"])
        L.pack(side="left", fill="both", expand=True, padx=(0, 12))
        R = tk.Frame(cols, bg=C["bg"])
        R.pack(side="right", fill="both", expand=True)

        # Load CTA
        lc = card(L, bg=C["panel"])
        lc.pack(fill="x", pady=(0, 14))
        tk.Label(lc, text="Load Today's Test",
                 font=FN["h3"], bg=C["panel"], fg=C["text"]).pack(anchor="w")
        tk.Label(lc, text="Upload the JSON file generated for you each day.",
                 font=FN["sm"], bg=C["panel"], fg=C["muted"]).pack(anchor="w", pady=(4, 10))
        mkbtn(lc, "  ↑  Browse JSON file…", self._show_load, accent=True).pack(anchor="w")

        # Category bars
        pc = card(L, bg=C["panel"])
        pc.pack(fill="both", expand=True)
        tk.Label(pc, text="Category Performance",
                 font=FN["h3"], bg=C["panel"], fg=C["text"]).pack(anchor="w", pady=(0, 10))
        self._draw_cat_bars(pc, s.get("by_type", {}))

        # Recent sessions
        rc = card(R, bg=C["panel"])
        rc.pack(fill="both", expand=True)
        tk.Label(rc, text="Recent Sessions",
                 font=FN["h3"], bg=C["panel"], fg=C["text"]).pack(anchor="w", pady=(0, 8))
        sessions = self.sessions[-12:][::-1]
        if not sessions:
            tk.Label(rc, text="No sessions yet.\nLoad a test to begin!",
                     font=FN["body"], bg=C["panel"], fg=C["muted"],
                     justify="center").pack(pady=28)
        else:
            for s2 in sessions:
                pct = s2["correct"] / max(s2["total"], 1) * 100
                col = C["green"] if pct >= 70 else (C["gold"] if pct >= 50 else C["red"])
                r2  = tk.Frame(rc, bg=C["panel2"], padx=10, pady=7)
                r2.pack(fill="x", pady=2)
                tk.Label(r2, text=s2["date"],
                         font=FN["xs"], bg=C["panel2"], fg=C["muted"]).pack(side="left")
                tk.Label(r2, text=f"  Day {s2.get('day','?')}",
                         font=FN["xs"], bg=C["panel2"], fg=C["muted"]).pack(side="left")
                tk.Label(r2, text=f"  {s2['correct']}/{s2['total']}",
                         font=("Helvetica", 11, "bold"),
                         bg=C["panel2"], fg=C["text"]).pack(side="left")
                tk.Label(r2, text=f"  {pct:.0f}%",
                         font=("Helvetica", 11, "bold"),
                         bg=C["panel2"], fg=col).pack(side="right")
                dur = s2.get("duration", 0)
                if dur:
                    tk.Label(r2, text=f"⏱{fmt_time(dur)}",
                             font=FN["xs"], bg=C["panel2"],
                             fg=C["muted"]).pack(side="right", padx=4)

    def _draw_cat_bars(self, parent, by_type):
        if not by_type:
            tk.Label(parent, text="Complete a test to see breakdown.",
                     font=FN["sm"], bg=C["panel"], fg=C["muted"]).pack(anchor="w")
            return
        for qt, (jp, en, col) in QTYPES.items():
            d = by_type.get(qt, {"correct": 0, "total": 0})
            if d["total"] == 0:
                continue
            pct = d["correct"] / d["total"]
            r   = tk.Frame(parent, bg=C["panel"])
            r.pack(fill="x", pady=4)
            tk.Label(r, text=f"{jp} {en}", font=FN["sm"],
                     bg=C["panel"], fg=C["text"],
                     width=22, anchor="w").pack(side="left")
            bg2 = tk.Frame(r, bg=C["border"], height=10, width=160)
            bg2.pack(side="left", padx=8)
            bg2.pack_propagate(False)
            tk.Frame(bg2, bg=col, height=10,
                     width=max(2, int(160 * pct))).place(x=0, y=0)
            tk.Label(r, text=f"{pct*100:.0f}%", font=FN["xs"],
                     bg=C["panel"], fg=C["muted"]).pack(side="left")

    # ══════════════════════════════════════════════════════════════════════
    #  Load screen
    # ══════════════════════════════════════════════════════════════════════
    def _show_load(self):
        self._stop_timer()
        self._in_test = False
        self._set_nav("load")
        self._clear()
        self._clear_sidebar_dynamic()

        pad = tk.Frame(self.content, bg=C["bg"], padx=28, pady=20)
        pad.pack(fill="both", expand=True)

        tk.Label(pad, text="Load Question File",
                 font=FN["h1"], bg=C["bg"], fg=C["text"]).pack(anchor="w")
        divider(pad).pack(fill="x", pady=10)

        c = card(pad, bg=C["panel"])
        c.pack(fill="x", pady=(0, 14))
        tk.Label(c, text="Select a JSON file to begin today's test.",
                 font=FN["body"], bg=C["panel"], fg=C["text"]).pack(anchor="w")
        tk.Label(c, text="Each day a personalised set is generated based on your progress.",
                 font=FN["sm"], bg=C["panel"], fg=C["muted"]).pack(anchor="w", pady=(4, 12))
        mkbtn(c, "  ↑  Browse for .json file", self._browse, accent=True).pack(anchor="w")

        fc = card(pad, bg=C["panel"])
        fc.pack(fill="x")
        tk.Label(fc, text="Expected JSON format",
                 font=FN["h3"], bg=C["panel"], fg=C["muted"]).pack(anchor="w", pady=(0, 8))
        sample = ('{\n  "day": 1,  "date": "2026-03-14",\n'
                  '  "questions": [\n    {\n'
                  '      "id": 1,  "type": "vocabulary",\n'
                  '      "question": "「元気」の意味は？",\n'
                  '      "options": ["Tired","Energetic","Sad","Hungry"],\n'
                  '      "answer": 1,\n'
                  '      "explanation": "元気 = healthy / energetic.",\n'
                  '      "reading": "げんき"\n    }\n  ]\n}')
        t = tk.Text(fc, font=FN["mono"], bg=C["panel2"], fg=C["text"],
                    height=12, relief="flat", padx=14, pady=10, wrap="none")
        t.insert("1.0", sample)
        t.config(state="disabled")
        t.pack(fill="x")

    def _browse(self):
        path = filedialog.askopenfilename(
            title="Select JLPT N4 Question File",
            filetypes=[("JSON", "*.json"), ("All", "*.*")]
        )
        if not path:
            return
        try:
            data = json.loads(Path(path).read_text("utf-8"))
            qs   = data.get("questions", [])
            if not qs:
                messagebox.showerror("Error", "No questions found in this file.")
                return
            self.questions = list(qs)
            self.meta      = data
            random.shuffle(self.questions)
            self._start_test()
        except Exception as e:
            messagebox.showerror("Error", f"Could not read file:\n{e}")

    # ══════════════════════════════════════════════════════════════════════
    #  Test
    # ══════════════════════════════════════════════════════════════════════
    def _start_test(self):
        self.cur_q        = 0
        self.answers      = [None] * len(self.questions)
        self._time_per_q  = [0]   * len(self.questions)
        self._q_start     = 0
        self._in_test     = True
        self._build_qmap()
        self._build_shortcut_legend()
        self._start_timer()
        self._show_question()

    def _show_question(self):
        self._clear()
        self._opt_frames = []
        total = len(self.questions)
        idx   = self.cur_q
        q     = self.questions[idx]
        self._q_start = self._elapsed
        self._sel_var = tk.IntVar(
            value=self.answers[idx] if self.answers[idx] is not None else -1
        )

        # Top bar
        topbar = tk.Frame(self.content, bg=C["panel2"], padx=18, pady=12)
        topbar.pack(fill="x")

        lt = tk.Frame(topbar, bg=C["panel2"])
        lt.pack(side="left")
        tk.Label(lt, text=f"Q {idx+1} / {total}",
                 font=FN["h3"], bg=C["panel2"], fg=C["text"]).pack(side="left")
        qt = q.get("type", "vocabulary")
        jp, en, col = QTYPES.get(qt, ("?", "?", C["muted"]))
        tk.Label(lt, text=f"  {jp} {en}  ", font=FN["xs"],
                 bg=col, fg="#12111A", padx=6, pady=3).pack(side="left", padx=10)

        tr = tk.Frame(topbar, bg=C["panel2"])
        tr.pack(side="right")
        tk.Label(tr, text="⏱ ", font=FN["sm"],
                 bg=C["panel2"], fg=C["muted"]).pack(side="left")
        self._tlabel = tk.Label(tr, text=fmt_time(self._elapsed),
                                font=FN["timer"], bg=C["panel2"], fg=C["gold"])
        self._tlabel.pack(side="left")

        # Progress bar
        prog = tk.Frame(self.content, bg=C["border"], height=3)
        prog.pack(fill="x")
        prog.pack_propagate(False)
        tk.Frame(prog, bg=C["accent"], height=3).place(
            relx=0, rely=0, relwidth=(idx + 1) / total, relheight=1)

        # Scrollable body
        outer, inner = make_scrollable(self.content)
        outer.pack(fill="both", expand=True)

        body = tk.Frame(inner, bg=C["bg"], padx=32, pady=22)
        body.pack(fill="both", expand=True)

        if "passage" in q:
            pc = card(body, bg=C["panel"], pady=12)
            pc.pack(fill="x", pady=(0, 14))
            tk.Label(pc, text="📖  Passage", font=FN["sm"],
                     bg=C["panel"], fg=C["gold"]).pack(anchor="w")
            tk.Label(pc, text=q["passage"], font=FN["jp"],
                     bg=C["panel"], fg=C["text"],
                     wraplength=680, justify="left").pack(anchor="w", pady=(6, 0))

        tk.Label(body, text=q["question"],
                 font=("Helvetica", 15),
                 bg=C["bg"], fg=C["text"],
                 wraplength=680, justify="left").pack(anchor="w", pady=(0, 18))

        opts = q.get("options", [])
        for i, opt in enumerate(opts):
            self._make_opt(body, i, opt)

        # Keyboard hint
        hr = tk.Frame(body, bg=C["bg"])
        hr.pack(anchor="w", pady=(10, 0))
        for k, d in [("1–4", "select"), ("→/↵", "next"), ("←", "back")]:
            tk.Label(hr, text=f" [{k}] ", font=FN["mono"],
                     bg=C["bg"], fg=C["accent"]).pack(side="left")
            tk.Label(hr, text=f"{d}  ", font=FN["xs"],
                     bg=C["bg"], fg=C["muted"]).pack(side="left")

        # Nav footer
        footer = tk.Frame(self.content, bg=C["panel2"], padx=18, pady=10)
        footer.pack(fill="x", side="bottom")
        if idx > 0:
            mkbtn(footer, "←  Previous", lambda: self._nav(-1)).pack(side="left")
        is_last = (idx == total - 1)
        mkbtn(footer,
              "Submit Test  ✓" if is_last else "Next  →",
              self._confirm_finish if is_last else lambda: self._nav(1),
              accent=True).pack(side="right")
        answered = sum(1 for a in self.answers if a is not None)
        tk.Label(footer, text=f"{answered}/{total} answered",
                 font=FN["sm"], bg=C["panel2"], fg=C["muted"]).pack(side="right", padx=16)

        # Rebind scroll on new body content
        _attach_scroll(body, inner.master)   # inner.master = canvas
        self._update_qmap()

    def _make_opt(self, parent, idx, text):
        is_sel  = (self._sel_var.get() == idx)
        bg      = C["sel"]     if is_sel else C["panel"]
        bdr     = C["sel_bdr"] if is_sel else C["border"]
        letters = ["A", "B", "C", "D"]

        frame = tk.Frame(parent, bg=bg,
                         highlightthickness=1, highlightbackground=bdr,
                         cursor="hand2", padx=16, pady=12)
        frame.pack(fill="x", pady=5)

        ltr = tk.Label(frame, text=letters[idx],
                       font=("Helvetica", 13, "bold"),
                       bg=bg, fg=C["sel_bdr"] if is_sel else C["muted"], width=2)
        ltr.pack(side="left", padx=(0, 10))

        txt = tk.Label(frame, text=text, font=FN["jp_sm"],
                       bg=bg, fg=C["text"],
                       wraplength=600, justify="left", anchor="w")
        txt.pack(side="left", fill="x", expand=True)

        def _click(e, i=idx):
            self._sel_var.set(i)
            self._highlight_option(i)

        for w in [frame, ltr, txt]:
            w.bind("<Button-1>", _click)

        self._opt_frames.append(frame)

    def _highlight_option(self, sel):
        letters = ["A", "B", "C", "D"]
        for i, frame in enumerate(self._opt_frames):
            try:
                if not frame.winfo_exists():
                    continue
            except Exception:
                continue
            is_s = (i == sel)
            bg   = C["sel"]     if is_s else C["panel"]
            bdr  = C["sel_bdr"] if is_s else C["border"]
            frame.config(bg=bg, highlightbackground=bdr)
            for w in frame.winfo_children():
                try:
                    w.config(bg=bg)
                    if isinstance(w, tk.Label) and w.cget("text") == letters[i]:
                        w.config(fg=C["sel_bdr"] if is_s else C["muted"])
                except Exception:
                    pass

    def _nav(self, direction):
        if not self._in_test:
            return
        v = self._sel_var.get()
        if v >= 0:
            self.answers[self.cur_q] = v
        self._time_per_q[self.cur_q] += self._elapsed - self._q_start
        nxt = self.cur_q + direction
        if 0 <= nxt < len(self.questions):
            self.cur_q = nxt
            self._show_question()

    def _jump_to(self, idx):
        if not self._in_test:
            return
        v = self._sel_var.get()
        if v >= 0:
            self.answers[self.cur_q] = v
        self._time_per_q[self.cur_q] += self._elapsed - self._q_start
        self.cur_q = idx
        self._show_question()

    def _confirm_finish(self):
        v = self._sel_var.get()
        if v >= 0:
            self.answers[self.cur_q] = v
        self._time_per_q[self.cur_q] += self._elapsed - self._q_start
        unanswered = self.answers.count(None)
        if unanswered > 0:
            if not messagebox.askyesno(
                "Unanswered Questions",
                f"{unanswered} question(s) unanswered. Submit anyway?"
            ):
                return
        self._stop_timer()
        self._in_test = False
        self._grade()

    # ── Q-map ──────────────────────────────────────────────────────────────
    def _build_qmap(self):
        for w in list(self._qmap_container.winfo_children()):
            try: w.destroy()
            except Exception: pass
        self._qmap_btns = []
        tk.Label(self._qmap_container, text="Questions",
                 font=FN["xs"], bg=C["sidebar"], fg=C["muted"]).pack(anchor="w", pady=(8, 4))
        grid = tk.Frame(self._qmap_container, bg=C["sidebar"])
        grid.pack(anchor="w")
        for i in range(len(self.questions)):
            r, c2 = divmod(i, 5)
            b = tk.Button(grid, text=str(i + 1),
                          font=("Helvetica", 8),
                          bg=C["border"], fg=C["muted"],
                          relief="flat", cursor="hand2", bd=0,
                          width=2, height=1,
                          command=lambda i=i: self._jump_to(i))
            b.grid(row=r, column=c2, padx=1, pady=1)
            self._qmap_btns.append(b)

    def _update_qmap(self):
        for i, b in enumerate(self._qmap_btns):
            try:
                if not b.winfo_exists():
                    continue
            except Exception:
                continue
            if i == self.cur_q:
                b.config(bg=C["accent"], fg="white")
            elif self.answers[i] is not None:
                b.config(bg=C["gold"], fg=C["bg"])
            else:
                b.config(bg=C["border"], fg=C["muted"])

    def _build_shortcut_legend(self):
        for w in list(self._shortcut_panel.winfo_children()):
            try: w.destroy()
            except Exception: pass
        divider(self._shortcut_panel).pack(fill="x", pady=(0, 8))
        tk.Label(self._shortcut_panel, text="Shortcuts",
                 font=FN["xs"], bg=C["sidebar"], fg=C["muted"]).pack(anchor="w")
        for k, d in [("1 2 3 4", "Select option"),
                     ("→ / ↵",   "Next"),
                     ("←",       "Previous")]:
            r = tk.Frame(self._shortcut_panel, bg=C["sidebar"])
            r.pack(fill="x", pady=1)
            tk.Label(r, text=k,        font=FN["mono"],
                     bg=C["sidebar"],  fg=C["accent"]).pack(side="left")
            tk.Label(r, text=f"  {d}", font=FN["xs"],
                     bg=C["sidebar"],  fg=C["muted"]).pack(side="left")

    # ══════════════════════════════════════════════════════════════════════
    #  Grading + save
    # ══════════════════════════════════════════════════════════════════════
    def _grade(self):
        results = []
        by_type = {}
        for i, q in enumerate(self.questions):
            chosen = self.answers[i]
            corr   = q["answer"]
            ok     = (chosen == corr)
            results.append({
                "q":       q,
                "chosen":  chosen,
                "correct": corr,
                "ok":      ok,
                "time":    self._time_per_q[i],
            })
            t = q.get("type", "vocabulary")
            by_type.setdefault(t, {"correct": 0, "total": 0, "time": 0})
            by_type[t]["total"] += 1
            by_type[t]["time"]  += self._time_per_q[i]
            if ok:
                by_type[t]["correct"] += 1

        total   = len(results)
        correct = sum(1 for r in results if r["ok"])
        pct     = correct / max(total, 1) * 100
        today   = datetime.date.today().isoformat()

        # ── Update cumulative stats
        s = self.stats
        s["total_tests"]     += 1
        s["total_questions"] += total
        s["total_correct"]   += correct
        for t, d in by_type.items():
            s["by_type"].setdefault(t, {"correct": 0, "total": 0, "time": 0})
            s["by_type"][t]["correct"] += d["correct"]
            s["by_type"][t]["total"]   += d["total"]
            s["by_type"][t]["time"]    += d["time"]
        s["daily_scores"].append({"date": today, "score": pct})
        last = s.get("last_test_date")
        if last:
            delta = (datetime.date.today() - datetime.date.fromisoformat(last)).days
            s["streak"] = s["streak"] + 1 if delta == 1 else 1
        else:
            s["streak"] = 1
        s["last_test_date"] = today
        save_stats(s)
        self.stats = s

        # ── Save session
        sessions = load_sessions()
        sessions.append({
            "date":           today,
            "day":            self.meta.get("day", "?"),
            "total":          total,
            "correct":        correct,
            "score":          pct,
            "duration":       self._elapsed,
            "avg_time_per_q": self._elapsed / max(total, 1),
            "time_per_q":     self._time_per_q,
            "by_type":        by_type,
        })
        save_sessions(sessions)
        self.sessions = sessions

        # ── Save full results to disk BEFORE touching the UI
        save_json(RESULTS_FILE, {
            "date": today, "correct": correct, "total": total,
            "pct": pct, "duration": self._elapsed, "by_type": by_type,
            "results": [
                {
                    "question":    r["q"].get("question", ""),
                    "type":        r["q"].get("type", ""),
                    "reading":     r["q"].get("reading", ""),
                    "options":     r["q"].get("options", []),
                    "explanation": r["q"].get("explanation", ""),
                    "correct":     r["correct"],
                    "chosen":      r["chosen"],
                    "ok":          r["ok"],
                    "time":        r["time"],
                }
                for r in results
            ]
        })

        # ── Show results — any crash here is caught cleanly
        self._show_results(results, correct, total, pct, by_type)

    # ══════════════════════════════════════════════════════════════════════
    #  Results screen
    # ══════════════════════════════════════════════════════════════════════
    def _show_results(self, results, correct, total, pct, by_type):
        try:
            self._show_results_inner(results, correct, total, pct, by_type)
        except Exception:
            traceback.print_exc()
            messagebox.showerror("Results Error",
                                 "Could not render results screen.\n"
                                 "Your score has been saved — check Statistics.")
            self._show_stats()

    def _show_results_inner(self, results, correct, total, pct, by_type):
        self._clear()
        self._clear_sidebar_dynamic()

        hero_col = C["green"] if pct >= 70 else (C["gold"] if pct >= 50 else C["red"])
        grade    = ("合格  PASS 🎉" if pct >= 70
                    else ("もう少し  Almost!" if pct >= 50
                          else "要練習  Keep Going 💪"))

        # Hero
        hero = tk.Frame(self.content, bg=hero_col, padx=24, pady=16)
        hero.pack(fill="x")
        tk.Label(hero, text=grade, font=FN["h2"],
                 bg=hero_col, fg=C["bg"]).pack()
        tk.Label(hero,
                 text=f"{correct} / {total}  ·  {pct:.1f}%",
                 font=("Helvetica", 30, "bold"),
                 bg=hero_col, fg=C["bg"]).pack()
        tk.Label(hero,
                 text=f"⏱  {fmt_time(self._elapsed)}  ·  {correct} correct  ·  {total - correct} wrong",
                 font=FN["sm"], bg=hero_col, fg=C["bg"]).pack(pady=(4, 0))

        # Body — outer split: left review pane + right sidebar
        body = tk.Frame(self.content, bg=C["bg"])
        body.pack(fill="both", expand=True)

        # ── Right sidebar (fixed 270px wide, fully scrollable) ────────────
        R_outer = tk.Frame(body, bg=C["bg"], width=270)
        R_outer.pack(side="right", fill="y", padx=(0, 14), pady=10)
        R_outer.pack_propagate(False)

        # Canvas + scrollbar so the right panel never overflows
        r_canvas = tk.Canvas(R_outer, bg=C["bg"], highlightthickness=0, bd=0)
        r_sb     = ttk.Scrollbar(R_outer, orient="vertical", command=r_canvas.yview)
        R        = tk.Frame(r_canvas, bg=C["bg"])

        r_win = r_canvas.create_window((0, 0), window=R, anchor="nw")

        def _r_canvas_resize(e):
            try:
                r_canvas.itemconfig(r_win, width=r_canvas.winfo_width())
            except Exception:
                pass

        def _r_inner_resize(e):
            try:
                r_canvas.configure(scrollregion=r_canvas.bbox("all"))
                # Show scrollbar only when content exceeds viewport
                if R.winfo_reqheight() > r_canvas.winfo_height():
                    r_sb.pack(side="right", fill="y")
                else:
                    r_sb.pack_forget()
            except Exception:
                pass

        r_canvas.bind("<Configure>", _r_canvas_resize)
        R.bind("<Configure>", _r_inner_resize)
        r_canvas.configure(yscrollcommand=r_sb.set)
        _attach_scroll(r_canvas, r_canvas)
        _attach_scroll(R,        r_canvas)
        r_canvas.pack(side="left", fill="both", expand=True)

        L = tk.Frame(body, bg=C["bg"])
        L.pack(side="left", fill="both", expand=True, padx=(14, 8), pady=10)

        # ── Right sidebar content: wrong answers summary + category scores ─
        wrong = [r for r in results if not r["ok"]]

        if wrong:
            wc = card(R, bg=C["wrong"], padx=12, pady=10)
            wc.pack(fill="x", pady=(0, 8))
            tk.Label(wc, text=f"✗  {len(wrong)} Mistake{'s' if len(wrong) > 1 else ''}",
                     font=FN["h3"], bg=C["wrong"], fg=C["red"]).pack(anchor="w", pady=(0, 6))
            letters = ["A", "B", "C", "D"]
            for r in wrong:
                q    = r["q"]
                opts = q.get("options", [])
                corr_opt = opts[r["correct"]] if r["correct"] < len(opts) else "?"
                tk.Label(wc, text=f"  • {q['question']}",
                         font=FN["jp_sm"], bg=C["wrong"],
                         fg=C["text"], wraplength=220,
                         justify="left").pack(anchor="w")
                tk.Label(wc,
                         text=f"    ✓ {letters[r['correct']]}. {corr_opt}",
                         font=FN["xs"], bg=C["wrong"],
                         fg=C["green"], wraplength=220).pack(anchor="w")
                if q.get("reading"):
                    tk.Label(wc, text=f"    読み方: {q['reading']}",
                             font=FN["xs"], bg=C["wrong"],
                             fg=C["gold"]).pack(anchor="w")
                if q.get("explanation"):
                    tk.Label(wc,
                             text=f"    💡 {q['explanation']}",
                             font=("Helvetica", 9, "italic"),
                             bg=C["wrong"], fg=C["muted"],
                             wraplength=220, justify="left").pack(anchor="w", pady=(0, 8))
        else:
            wc = card(R, bg=C["correct"], padx=12, pady=10)
            wc.pack(fill="x", pady=(0, 8))
            tk.Label(wc, text="✓  Perfect Score!",
                     font=FN["h3"], bg=C["correct"],
                     fg=C["green"]).pack(anchor="w")

        cc = card(R, bg=C["panel"])
        cc.pack(fill="x", pady=(0, 8))
        tk.Label(cc, text="Category Scores",
                 font=FN["h3"], bg=C["panel"], fg=C["text"]).pack(anchor="w", pady=(0, 6))
        for qt, d in by_type.items():
            jp, en, col = QTYPES.get(qt, ("?", qt, C["muted"]))
            p   = d["correct"] / d["total"] * 100
            c2  = C["green"] if p >= 70 else (C["gold"] if p >= 50 else C["red"])
            r2  = tk.Frame(cc, bg=C["panel"])
            r2.pack(fill="x", pady=2)
            tk.Label(r2, text=f"{jp} {en}", font=FN["sm"],
                     bg=C["panel"], fg=C["text"], anchor="w").pack(side="left", fill="x", expand=True)
            tk.Label(r2, text=f"{d['correct']}/{d['total']}  {p:.0f}%",
                     font=("Helvetica", 10, "bold"),
                     bg=C["panel"], fg=c2).pack(side="right")

        btn_frame = tk.Frame(R, bg=C["bg"])
        btn_frame.pack(fill="x", pady=(4, 0))
        mkbtn(btn_frame, "⌂  Dashboard",      self._show_dashboard).pack(fill="x", pady=3)
        mkbtn(btn_frame, "◉  Statistics",     self._show_stats).pack(fill="x", pady=3)
        mkbtn(btn_frame, "↑  Load Next Test", self._show_load, accent=True).pack(fill="x", pady=3)

        # ── Left: full review as selectable Text ──────────────────────
        hdr_row = tk.Frame(L, bg=C["bg"])
        hdr_row.pack(fill="x", pady=(0, 6))
        tk.Label(hdr_row, text="Full Answer Review",
                 font=FN["h3"], bg=C["bg"], fg=C["text"]).pack(side="left")
        tk.Label(hdr_row,
                 text="  selectable — Ctrl+A, Ctrl+C to copy",
                 font=FN["xs"], bg=C["bg"], fg=C["muted"]).pack(side="left")

        # Build plain text content
        letters = ["A", "B", "C", "D"]
        lines   = []
        for i, r in enumerate(results):
            q       = r["q"]
            ok      = r["ok"]
            chosen  = r["chosen"]
            corr    = r["correct"]
            qt      = q.get("type", "")
            jp, en, _ = QTYPES.get(qt, ("?", qt, ""))
            t_secs  = r.get("time", 0)
            status  = "✓ CORRECT" if ok else "✗ WRONG"

            lines.append(f"{'─'*56}")
            lines.append(f"Q{i+1:>3}  {status}   [{jp} {en}]   ⏱ {fmt_time(t_secs)}")
            lines.append(f"     {q['question']}")
            if q.get("reading"):
                lines.append(f"     読み方: {q['reading']}")
            opts = q.get("options", [])
            for j, opt in enumerate(opts):
                if j == corr:
                    pfx = f"  {letters[j]}✓"
                elif j == chosen and not ok:
                    pfx = f"  {letters[j]}✗"
                else:
                    pfx = f"  {letters[j]} "
                lines.append(f"  {pfx}  {opt}")
            if q.get("explanation"):
                lines.append(f"     💡 {q['explanation']}")
            lines.append("")

        content = "\n".join(lines)

        # Single Text widget — no Canvas, no scrollable(), no bind_all
        txt_outer = tk.Frame(L, bg=C["border"], padx=1, pady=1)
        txt_outer.pack(fill="both", expand=True)

        txt_inner = tk.Frame(txt_outer, bg=C["panel2"])
        txt_inner.pack(fill="both", expand=True)

        sb_y = ttk.Scrollbar(txt_inner, orient="vertical")
        txt  = tk.Text(
            txt_inner,
            font=("Courier", 10),
            bg=C["panel2"], fg=C["text"],
            selectbackground=C["sel_bdr"], selectforeground="white",
            insertbackground=C["text"],
            relief="flat", padx=14, pady=10,
            wrap="none", cursor="xterm",
            yscrollcommand=sb_y.set,
        )
        sb_y.config(command=txt.yview)
        sb_y.pack(side="right", fill="y")
        txt.pack(side="left", fill="both", expand=True)

        # Colour tags
        txt.tag_config("hdr_ok",   foreground=C["green"])
        txt.tag_config("hdr_bad",  foreground=C["red"])
        txt.tag_config("reading",  foreground=C["gold"])
        txt.tag_config("opt_ok",   foreground=C["green"])
        txt.tag_config("opt_bad",  foreground=C["red"])
        txt.tag_config("opt_dim",  foreground=C["muted"])
        txt.tag_config("expl",     foreground=C["muted"],
                       font=("Courier", 9, "italic"))

        # Insert line by line with tags
        line_num = 1
        for i, r in enumerate(results):
            q      = r["q"]
            ok     = r["ok"]
            chosen = r["chosen"]
            corr   = r["correct"]
            qt     = q.get("type", "")
            jp, en, _ = QTYPES.get(qt, ("?", qt, ""))
            t_secs = r.get("time", 0)

            # separator
            txt.insert("end", f"{'─'*56}\n")
            line_num += 1

            # header
            status = "✓ CORRECT" if ok else "✗ WRONG"
            hdr_line = f"Q{i+1:>3}  {status}   [{jp} {en}]   ⏱ {fmt_time(t_secs)}\n"
            start = txt.index("end-1c")
            txt.insert("end", hdr_line)
            txt.tag_add("hdr_ok" if ok else "hdr_bad", start, "end-1c")
            line_num += 1

            # question
            txt.insert("end", f"     {q['question']}\n")
            line_num += 1

            # reading
            if q.get("reading"):
                start = txt.index("end-1c")
                txt.insert("end", f"     読み方: {q['reading']}\n")
                txt.tag_add("reading", start, "end-1c")
                line_num += 1

            # options
            opts = q.get("options", [])
            for j, opt in enumerate(opts):
                if j == corr:
                    pfx = f"  {letters[j]}✓"
                    tag = "opt_ok"
                elif j == chosen and not ok:
                    pfx = f"  {letters[j]}✗"
                    tag = "opt_bad"
                else:
                    pfx = f"  {letters[j]} "
                    tag = "opt_dim"
                start = txt.index("end-1c")
                txt.insert("end", f"  {pfx}  {opt}\n")
                txt.tag_add(tag, start, "end-1c")
                line_num += 1

            # explanation
            if q.get("explanation"):
                start = txt.index("end-1c")
                txt.insert("end", f"     💡 {q['explanation']}\n")
                txt.tag_add("expl", start, "end-1c")
                line_num += 1

            txt.insert("end", "\n")
            line_num += 1

        txt.config(state="disabled")

        # Scroll binding — direct, never global
        _attach_scroll(txt, txt)

        # Jump to first wrong answer
        if wrong:
            pos = txt.search("✗ WRONG", "1.0")
            if pos:
                txt.see(pos)

    # ══════════════════════════════════════════════════════════════════════
    #  Statistics
    # ══════════════════════════════════════════════════════════════════════
    def _build_stats_report(self):
        s   = self.stats
        acc = s["total_correct"] / max(s["total_questions"], 1) * 100
        L = [
            "═" * 54,
            "  JLPT N4 PRACTICE — STATISTICS REPORT",
            f"  Generated: {datetime.datetime.now().strftime('%Y-%m-%d  %H:%M')}",
            "═" * 54,
            "",
            f"  Tests Taken      : {s['total_tests']}",
            f"  Overall Accuracy : {acc:.1f}%",
            f"  Questions Done   : {s['total_questions']}",
            f"  Correct Answers  : {s['total_correct']}",
            f"  Current Streak   : {s.get('streak', 0)} day(s)",
            f"  Last Test Date   : {s.get('last_test_date', 'N/A')}",
            "",
            "─" * 54,
            "  ACCURACY BY CATEGORY",
            "─" * 54,
        ]
        for qt, (jp, en, _) in QTYPES.items():
            d = s.get("by_type", {}).get(qt, {"correct": 0, "total": 0, "time": 0})
            if d["total"] == 0:
                continue
            pct  = d["correct"] / d["total"] * 100
            avg  = d.get("time", 0) / max(d["total"], 1)
            bar  = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
            L.append(f"  {jp} {en:<12} {bar}  {pct:5.1f}%"
                     f"  ({d['correct']}/{d['total']})  avg {avg:.0f}s/q")

        L += ["", "─" * 54, "  SESSION HISTORY  (newest first)", "─" * 54]
        sessions = load_sessions()
        for sess in reversed(sessions[-30:]):
            pct   = sess["correct"] / max(sess["total"], 1) * 100
            dur   = fmt_time(sess.get("duration", 0))
            avg   = sess.get("avg_time_per_q", 0)
            grade = "PASS" if pct >= 70 else ("OK" if pct >= 50 else "FAIL")
            L.append(
                f"  {sess['date']}  Day {str(sess.get('day','?')):<6}"
                f"  {sess['correct']:>3}/{sess['total']:<3}  {pct:5.1f}%"
                f"  [{grade}]  ⏱ {dur}  ~{avg:.0f}s/q"
            )
            for qt, d in sess.get("by_type", {}).items():
                if not d["total"]:
                    continue
                p2 = d["correct"] / d["total"] * 100
                jp, en, _ = QTYPES.get(qt, ("?", qt, ""))
                at = d.get("time", 0) / max(d["total"], 1)
                L.append(f"      {jp} {en:<12}"
                         f"  {d['correct']}/{d['total']}  {p2:.0f}%  avg {at:.0f}s/q")
            L.append("")

        L += ["═" * 54,
              "  Ctrl+A = select all   Ctrl+C = copy",
              "═" * 54]
        return "\n".join(L)

    def _show_stats(self):
        try:
            self._show_stats_inner()
        except Exception:
            traceback.print_exc()
            messagebox.showerror("Statistics Error",
                                 "Could not render statistics.\nPlease try again.")

    def _show_stats_inner(self):
        self._stop_timer()
        self._in_test = False
        self._set_nav("stats")
        self._clear()
        self._clear_sidebar_dynamic()
        s = self.stats

        pad = tk.Frame(self.content, bg=C["bg"], padx=28, pady=20)
        pad.pack(fill="both", expand=True)

        # Header + copy button
        hdr = tk.Frame(pad, bg=C["bg"])
        hdr.pack(fill="x", pady=(0, 8))
        tk.Label(hdr, text="Statistics",
                 font=FN["h1"], bg=C["bg"], fg=C["text"]).pack(side="left")

        def _copy():
            report = self._build_stats_report()
            self.clipboard_clear()
            self.clipboard_append(report)
            copy_btn.config(text="  ✓  Copied!")
            self.after(2000, lambda: copy_btn.config(text="  📋  Copy All Stats"))

        copy_btn = mkbtn(hdr, "  📋  Copy All Stats", _copy)
        copy_btn.pack(side="right")

        divider(pad).pack(fill="x", pady=(0, 14))

        # Top stat cards
        overall = s["total_correct"] / max(s["total_questions"], 1) * 100
        row = tk.Frame(pad, bg=C["bg"])
        row.pack(fill="x", pady=(0, 14))
        for val, lbl, col in [
            (str(s["total_tests"]),      "Tests Taken",     C["blue"]),
            (f"{overall:.1f}%",          "Overall Accuracy", C["green"]),
            (str(s["total_questions"]),  "Questions Done",   C["muted"]),
            (f"{s.get('streak', 0)}d",   "Current Streak",   C["gold"]),
        ]:
            c = card(row, bg=C["panel"])
            c.pack(side="left", fill="both", expand=True, padx=(0, 10))
            tk.Label(c, text=val, font=("Helvetica", 18, "bold"),
                     bg=C["panel"], fg=col).pack()
            tk.Label(c, text=lbl, font=FN["xs"],
                     bg=C["panel"], fg=C["muted"]).pack()

        tk.Label(pad, text="💡  All text below is selectable — click, Ctrl+A, Ctrl+C",
                 font=FN["xs"], bg=C["bg"], fg=C["muted"]).pack(anchor="w", pady=(0, 6))

        # Selectable report
        report = self._build_stats_report()

        txt_outer = tk.Frame(pad, bg=C["border"], padx=1, pady=1)
        txt_outer.pack(fill="both", expand=True)

        txt_inner = tk.Frame(txt_outer, bg=C["panel2"])
        txt_inner.pack(fill="both", expand=True)

        sb_y = ttk.Scrollbar(txt_inner, orient="vertical")
        sb_x = ttk.Scrollbar(txt_inner, orient="horizontal")

        txt = tk.Text(
            txt_inner,
            font=("Courier", 10),
            bg=C["panel2"], fg=C["text"],
            selectbackground=C["sel_bdr"], selectforeground="white",
            insertbackground=C["text"],
            relief="flat", padx=14, pady=10,
            wrap="none", cursor="xterm",
            yscrollcommand=sb_y.set,
            xscrollcommand=sb_x.set,
        )
        sb_y.config(command=txt.yview)
        sb_x.config(command=txt.xview)

        sb_y.pack(side="right",  fill="y")
        sb_x.pack(side="bottom", fill="x")
        txt.pack(fill="both", expand=True)

        # Colour tags for PASS/FAIL/OK lines
        txt.tag_config("pass_line", foreground=C["green"])
        txt.tag_config("fail_line", foreground=C["red"])
        txt.tag_config("ok_line",   foreground=C["gold"])

        txt.insert("1.0", report)

        # Apply line colours
        for line_tag, keyword in [("pass_line","[PASS]"),
                                   ("fail_line","[FAIL]"),
                                   ("ok_line",  "[OK]")]:
            start = "1.0"
            while True:
                pos = txt.search(keyword, start, stopindex="end")
                if not pos:
                    break
                line_start = f"{pos} linestart"
                line_end   = f"{pos} lineend"
                txt.tag_add(line_tag, line_start, line_end)
                start = line_end

        txt.config(state="disabled")

        # Direct scroll binding — no bind_all
        _attach_scroll(txt, txt)


# ══════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import sys

    def _global_exception_handler(exc_type, exc_value, exc_tb):
        """Catch any unhandled exception, show a dialog, keep the app alive."""
        msg = "".join(traceback.format_exception(exc_type, exc_value, exc_tb))
        try:
            messagebox.showerror(
                "Unexpected Error",
                f"An error occurred — the app will try to continue.\n\n{msg[:800]}"
            )
        except Exception:
            print(msg, file=sys.stderr)

    sys.excepthook = _global_exception_handler

    app = JLPTApp()
    app.report_callback_exception = lambda *a: _global_exception_handler(*a)
    app.mainloop()
