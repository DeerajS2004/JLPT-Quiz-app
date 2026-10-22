import type {
  AnswerRecord,
  QuestionSet,
  SessionResult,
  Statistics,
  QuestionType,
} from "./quiz-types";
import { QUESTION_TYPES } from "./quiz-types";
import { addHistory, saveAttempt, toHistoryEntry } from "./library-store";

const STATS_KEY = "jlpt.statistics";
const SESSIONS_KEY = "jlpt.sessions";
const LAST_RESULT_KEY = "jlpt.lastResult";
const ACTIVE_KEY = "jlpt.activeSession";
const STUDY_SET_KEY = "jlpt.studySet";
const STUDY_SETS_KEY = "jlpt.studySets";
const LEDGER_KEY = "jlpt.statsLedger";

/** Lightweight per-test summary used to compute dashboard statistics. */
export interface LedgerEntry {
  id: string;
  date: string;
  total: number;
  correct: number;
  byCategory: Partial<Record<QuestionType, { total: number; correct: number }>>;
}

export const MAX_SESSION_HISTORY = 5;

export function emptyStats(): Statistics {
  const byCategory = {} as Record<QuestionType, { total: number; correct: number }>;
  for (const t of QUESTION_TYPES) byCategory[t] = { total: 0, correct: 0 };
  return {
    totalQuestions: 0,
    totalCorrect: 0,
    sessionsCompleted: 0,
    streak: 0,
    lastSessionDate: null,
    byCategory,
  };
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function summarize(result: SessionResult): LedgerEntry {
  const byCategory: LedgerEntry["byCategory"] = {};
  result.questions.forEach((q, i) => {
    const cat = byCategory[q.type] ?? { total: 0, correct: 0 };
    cat.total += 1;
    if (result.answers[i]?.correct) cat.correct += 1;
    byCategory[q.type] = cat;
  });
  return { id: result.id, date: result.date, total: result.total, correct: result.correct, byCategory };
}

export function loadLedger(): LedgerEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(LEDGER_KEY);
  if (raw) return safeParse<LedgerEntry[]>(raw, []);
  // First run after upgrade: rebuild from saved results.
  const seeded = safeParse<SessionResult[]>(localStorage.getItem(SESSIONS_KEY), []).map(summarize);
  localStorage.setItem(LEDGER_KEY, JSON.stringify(seeded));
  localStorage.removeItem(STATS_KEY);
  return seeded;
}

function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Statistics are always recalculated from the saved (non-deleted) tests. */
export function computeStats(ledger: LedgerEntry[]): Statistics {
  const stats = emptyStats();
  for (const e of ledger) {
    stats.totalQuestions += e.total;
    stats.totalCorrect += e.correct;
    stats.sessionsCompleted += 1;
    for (const [type, c] of Object.entries(e.byCategory)) {
      const cat = stats.byCategory[type as QuestionType] ?? { total: 0, correct: 0 };
      cat.total += c?.total ?? 0;
      cat.correct += c?.correct ?? 0;
      stats.byCategory[type as QuestionType] = cat;
    }
  }
  const days = [...new Set(ledger.map((e) => localDay(e.date)))].sort().reverse();
  stats.lastSessionDate = days[0] ?? null;
  if (days.length) {
    stats.streak = 1;
    for (let i = 1; i < days.length; i++) {
      if (dayDiff(days[i], days[i - 1]) === 1) stats.streak += 1;
      else break;
    }
  }
  return stats;
}

export function loadStats(): Statistics {
  if (typeof window === "undefined") return emptyStats();
  return computeStats(loadLedger());
}

export function loadSessions(): SessionResult[] {
  if (typeof window === "undefined") return [];
  const sessions = safeParse<SessionResult[]>(localStorage.getItem(SESSIONS_KEY), []);
  const recent = sessions.slice(0, MAX_SESSION_HISTORY);
  if (sessions.length > recent.length) {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(recent));
  }
  return recent;
}

/** Merge a backup's ledger; a restored entry replaces a local one with the same id. */
export function mergeLedger(entries: LedgerEntry[]): LedgerEntry[] {
  if (typeof window === "undefined") return [];
  const byId = new Map(loadLedger().map((e) => [e.id, e] as const));
  for (const e of entries) if (e && e.id) byId.set(e.id, e);
  const next = [...byId.values()];
  localStorage.setItem(LEDGER_KEY, JSON.stringify(next));
  return next;
}

export function loadLastResult(): SessionResult | null {
  if (typeof window === "undefined") return null;
  return safeParse<SessionResult | null>(localStorage.getItem(LAST_RESULT_KEY), null);
}

export function saveStudySets(sets: QuestionSet[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STUDY_SETS_KEY, JSON.stringify(sets));
  localStorage.removeItem(STUDY_SET_KEY);
}

export function loadStudySets(): QuestionSet[] {
  if (typeof window === "undefined") return [];
  const sets = safeParse<QuestionSet[] | null>(localStorage.getItem(STUDY_SETS_KEY), null);
  if (sets) return sets;
  const legacy = safeParse<QuestionSet | null>(localStorage.getItem(STUDY_SET_KEY), null);
  return legacy ? [legacy] : [];
}

/** Remove a saved test; statistics are recalculated without it. */
export function removeSession(id: string): SessionResult[] {
  if (typeof window === "undefined") return [];
  localStorage.setItem(LEDGER_KEY, JSON.stringify(loadLedger().filter((e) => e.id !== id)));
  const sessions = loadSessions().filter((session) => session.id !== id);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  const lastResult = loadLastResult();
  if (lastResult?.id === id) {
    const nextLastResult = sessions[0] ?? null;
    if (nextLastResult) localStorage.setItem(LAST_RESULT_KEY, JSON.stringify(nextLastResult));
    else localStorage.removeItem(LAST_RESULT_KEY);
  }
  return sessions;
}

export interface ActiveSession {
  set: QuestionSet;
  startedAt: number;
  durationSec: number; // configured time limit
  answers: AnswerRecord[];
  currentIndex: number;
  /** Question sets still waiting to be tested after this one. */
  queue?: QuestionSet[];
  /** Id of the most recently saved result in this run. */
  lastSavedId?: string;
}

export function loadActive(): ActiveSession | null {
  if (typeof window === "undefined") return null;
  return safeParse<ActiveSession | null>(localStorage.getItem(ACTIVE_KEY), null);
}

export function saveActive(active: ActiveSession | null) {
  if (typeof window === "undefined") return;
  if (!active) localStorage.removeItem(ACTIVE_KEY);
  else localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
}

function dayDiff(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86_400_000);
}

export function finalizeSession(active: ActiveSession): SessionResult {
  const elapsedSec = Math.max(0, Math.round((Date.now() - active.startedAt) / 1000));
  const correct = active.answers.filter((a) => a.correct).length;
  const result: SessionResult = {
    id: `${active.startedAt}`,
    title: active.set.title,
    day: active.set.day,
    date: new Date().toISOString(),
    durationSec: elapsedSec,
    total: active.set.questions.length,
    correct,
    answers: active.answers,
    questions: active.set.questions,
  };

  if (typeof window !== "undefined") {
    // save last result
    localStorage.setItem(LAST_RESULT_KEY, JSON.stringify(result));

    // session history
    const history = loadSessions();
    history.unshift(result);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(history.slice(0, MAX_SESSION_HISTORY)));

    // statistics ledger
    const ledger = loadLedger();
    ledger.push(summarize(result));
    localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));

    // history (marks + wrong answers only) and full attempt for saved files
    addHistory(toHistoryEntry(result, active.set.sourceId));
    if (active.set.sourceId) {
      void saveAttempt({ id: result.id, fileId: active.set.sourceId, date: result.date, durationSec: result.durationSec,
        total: result.total, correct: result.correct, questions: result.questions, answers: result.answers }).catch(() => {});
    }

    // clear active
    saveActive(null);
  }

  return result;
}

export function resetAllData() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STATS_KEY);
  localStorage.setItem(LEDGER_KEY, "[]");
  localStorage.removeItem(SESSIONS_KEY);
  localStorage.removeItem(LAST_RESULT_KEY);
  localStorage.removeItem(ACTIVE_KEY);
}

export interface QuizJsonFixes {
  "question type": number;
  "format aliases": number;
  "answer text → index": number;
  "numeric answer → index": number;
  "typed answers": number;
  "inferred typed format": number;
}

/** Repair generator aliases without mutating input or relaxing validation. Unknown keys are ignored. */
export function normalizeQuizJson(raw: unknown): { json: unknown; fixes: QuizJsonFixes; total: number } {
  const fixes: QuizJsonFixes = {
    "question type": 0,
    "format aliases": 0,
    "answer text → index": 0,
    "numeric answer → index": 0,
    "typed answers": 0,
    "inferred typed format": 0,
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { json: raw, fixes, total: 0 };
  const root = raw as Record<string, unknown>;
  if (!Array.isArray(root.questions)) return { json: raw, fixes, total: 0 };
  const questions = root.questions.map((value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    const q = { ...value } as Record<string, unknown>;
    if (q.type === undefined && QUESTION_TYPES.includes(root.type as QuestionType)) {
      q.type = root.type;
      fixes["question type"]++;
    }
    if (q.format === "multiple_choice" || q.format === "mc" || q.format === "choice") {
      // The canonical explicit default is equivalent to omission, not a semantic repair.
      if (q.format !== "multiple_choice") fixes["format aliases"]++;
      delete q.format;
    } else if (q.format === "text" || q.format === "free") {
      q.format = "typed";
      fixes["format aliases"]++;
    } else if (q.format === undefined && q.options === undefined &&
      (typeof q.answer === "string" || q.correctAnswers !== undefined)) {
      q.format = "typed";
      fixes["inferred typed format"]++;
    }

    if (q.format === "typed") {
      if (q.correctAnswers === undefined) {
        const alias = ["acceptedAnswers", "accepted", "accept", "acceptableAnswers", "expectedAnswer"]
          .find((key) => q[key] !== undefined);
        const candidates = [typeof q.answer === "string" ? q.answer : [], alias ? q[alias] : []];
        const flatten = (value: unknown): string[] => Array.isArray(value)
          ? value.flatMap(flatten) : typeof value === "string" ? [value] : [];
        const answers = [...new Set(flatten(candidates))];
        if (answers.length) {
          q.correctAnswers = answers;
          fixes["typed answers"]++;
        }
      }
    } else if (typeof q.answer === "string") {
      const answer = q.answer;
      const options = Array.isArray(q.options) ? q.options : [];
      let index = options.findIndex((option) => option === answer);
      if (index < 0) index = options.findIndex((option) => typeof option === "string" &&
        option.trim().toLowerCase() === answer.trim().toLowerCase());
      if (index >= 0) {
        q.answer = index;
        fixes["answer text → index"]++;
      } else if (/^[+-]?\d+$/.test(answer.trim())) {
        q.answer = Number(answer);
        fixes["numeric answer → index"]++;
      }
    }
    return q;
  });
  return { json: { ...root, questions }, fixes, total: Object.values(fixes).reduce((sum, count) => sum + count, 0) };
}

export function validateQuestionSet(input: unknown): { ok: true; set: QuestionSet } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Root must be an object." };
  const obj = input as Record<string, unknown>;
  if (typeof obj.title !== "string") return { ok: false, error: "`title` must be a string." };
  if (!Array.isArray(obj.questions) || obj.questions.length === 0)
    return { ok: false, error: "`questions` must be a non-empty array." };
  for (let i = 0; i < obj.questions.length; i++) {
    const q = obj.questions[i] as Record<string, unknown>;
    if (!q || typeof q !== "object") return { ok: false, error: `Question #${i + 1} is not an object.` };
    if (typeof q.question !== "string") return { ok: false, error: `Question #${i + 1}: missing string \`question\`.` };
    if (typeof q.type !== "string" || !QUESTION_TYPES.includes(q.type as QuestionType))
      return { ok: false, error: `Question #${i + 1}: \`type\` must be one of ${QUESTION_TYPES.join(", ")}.` };
    const format = q.format === "typed" ? "typed" : "multiple_choice";
    if (q.hint !== undefined && typeof q.hint !== "string")
      return { ok: false, error: `Question #${i + 1}: \`hint\` must be a string when provided.` };
    if (q.strict !== undefined && typeof q.strict !== "boolean")
      return { ok: false, error: `Question #${i + 1}: \`strict\` must be true or false when provided.` };
    if (format === "typed") {
      if (!Array.isArray(q.correctAnswers) || q.correctAnswers.length === 0 ||
        !q.correctAnswers.every((answer) => typeof answer === "string" && answer.trim().length > 0)) {
        return { ok: false, error: `Question #${i + 1}: typed questions need one or more non-empty strings in \`correctAnswers\`.` };
      }
    } else {
      if (!Array.isArray(q.options) || q.options.length < 2)
        return { ok: false, error: `Question #${i + 1}: \`options\` must have at least 2 items.` };
      if (typeof q.answer !== "number" || !Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length || !q.options.every((option) => typeof option === "string"))
        return { ok: false, error: `Question #${i + 1}: \`answer\` must be a valid index into \`options\`.` };
    }
  }
  return { ok: true, set: input as QuestionSet };
}
