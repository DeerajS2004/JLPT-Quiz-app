import type {
  AnswerRecord,
  QuestionSet,
  SessionResult,
  Statistics,
  QuestionType,
} from "./quiz-types";
import { QUESTION_TYPES } from "./quiz-types";

const STATS_KEY = "jlpt.statistics";
const SESSIONS_KEY = "jlpt.sessions";
const LAST_RESULT_KEY = "jlpt.lastResult";
const ACTIVE_KEY = "jlpt.activeSession";
const STUDY_SET_KEY = "jlpt.studySet";

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

export function loadStats(): Statistics {
  if (typeof window === "undefined") return emptyStats();
  const parsed = safeParse<Partial<Statistics> | null>(localStorage.getItem(STATS_KEY), null);
  if (!parsed) return emptyStats();
  const base = emptyStats();
  return {
    ...base,
    ...parsed,
    byCategory: { ...base.byCategory, ...(parsed.byCategory ?? {}) } as Statistics["byCategory"],
  };
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

export function loadLastResult(): SessionResult | null {
  if (typeof window === "undefined") return null;
  return safeParse<SessionResult | null>(localStorage.getItem(LAST_RESULT_KEY), null);
}

export function saveStudySet(set: QuestionSet) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STUDY_SET_KEY, JSON.stringify(set));
}

export function loadStudySet(): QuestionSet | null {
  if (typeof window === "undefined") return null;
  return safeParse<QuestionSet | null>(localStorage.getItem(STUDY_SET_KEY), null);
}

/** Remove a saved review without changing lifetime statistics. */
export function removeSession(id: string): SessionResult[] {
  if (typeof window === "undefined") return [];
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

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
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

    // statistics
    const stats = loadStats();
    stats.totalQuestions += result.total;
    stats.totalCorrect += result.correct;
    stats.sessionsCompleted += 1;
    for (let i = 0; i < result.questions.length; i++) {
      const q = result.questions[i];
      const a = result.answers[i];
      const cat = stats.byCategory[q.type] ?? { total: 0, correct: 0 };
      cat.total += 1;
      if (a?.correct) cat.correct += 1;
      stats.byCategory[q.type] = cat;
    }
    const today = todayISO();
    if (!stats.lastSessionDate) {
      stats.streak = 1;
    } else {
      const diff = dayDiff(stats.lastSessionDate, today);
      if (diff === 0) {
        // same day — keep streak
      } else if (diff === 1) {
        stats.streak += 1;
      } else {
        stats.streak = 1;
      }
    }
    stats.lastSessionDate = today;
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));

    // clear active
    saveActive(null);
  }

  return result;
}

export function resetAllData() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STATS_KEY);
  localStorage.removeItem(SESSIONS_KEY);
  localStorage.removeItem(LAST_RESULT_KEY);
  localStorage.removeItem(ACTIVE_KEY);
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
