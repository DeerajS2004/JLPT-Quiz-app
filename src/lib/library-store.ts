import type { AnswerRecord, Question, QuestionSet, SessionResult } from "./quiz-types";

/* ---------------- History (marks + wrong answers only, localStorage) ---------------- */

const HISTORY_KEY = "jlpt.history";
const LEDGER_KEY = "jlpt.statsLedger";

export interface HistoryEntry {
  id: string;
  title: string;
  date: string;
  durationSec: number;
  total: number;
  correct: number;
  sourceId?: string;
  wrong: { question: Question; answer: AnswerRecord | null }[];
}

export function toHistoryEntry(result: SessionResult, sourceId?: string): HistoryEntry {
  const wrong = result.questions
    .map((question, i) => ({ question, answer: result.answers[i] ?? null }))
    .filter((w) => !w.answer?.correct);
  return {
    id: result.id, title: result.title, date: result.date, durationSec: result.durationSec,
    total: result.total, correct: result.correct, sourceId, wrong,
  };
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return (JSON.parse(localStorage.getItem(key) ?? "null") as T) ?? fallback; } catch { return fallback; }
}

export function loadHistory(): HistoryEntry[] {
  return read<HistoryEntry[]>(HISTORY_KEY, []);
}

export function addHistory(entry: HistoryEntry) {
  if (typeof window === "undefined") return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...loadHistory().filter((h) => h.id !== entry.id)]));
}

/** Delete history entries; their stats are removed too so the dashboard recalculates. */
export function removeHistory(ids: string[] | "all"): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  const drop = (id: string) => ids === "all" || ids.includes(id);
  const next = loadHistory().filter((h) => !drop(h.id));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  const ledger = read<{ id: string }[]>(LEDGER_KEY, []);
  localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger.filter((e) => !drop(e.id))));
  return next;
}

/* ---------------- Saved files + full attempts (IndexedDB, kept until deleted) ---------------- */

export interface SavedFile { id: string; title: string; savedAt: string; set: QuestionSet }
export interface Attempt {
  id: string; fileId: string; date: string; durationSec: number;
  total: number; correct: number; questions: Question[]; answers: AnswerRecord[];
}

const DB = "jlpt-library";
type Store = "files" | "attempts";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("files", { keyPath: "id" });
      req.result.createObjectStore("attempts", { keyPath: "id" }).createIndex("fileId", "fileId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: Store, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req ? req.result : (undefined as T));
    t.onerror = () => reject(t.error);
  });
}

/** Same title = same file, so re-uploading updates instead of duplicating. */
export function fileIdFor(set: QuestionSet): string {
  return set.title.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "untitled";
}

export async function saveFile(set: QuestionSet): Promise<SavedFile> {
  const file: SavedFile = { id: fileIdFor(set), title: set.title, savedAt: new Date().toISOString(), set };
  await tx("files", "readwrite", (s) => { s.put(file); });
  return file;
}
export const listFiles = () => tx<SavedFile[]>("files", "readonly", (s) => s.getAll())
  .then((f) => f.sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
export const getFile = (id: string) => tx<SavedFile | undefined>("files", "readonly", (s) => s.get(id));

export async function deleteFile(id: string, withAttempts: boolean) {
  await tx("files", "readwrite", (s) => { s.delete(id); });
  if (withAttempts) for (const a of await listAttempts(id)) await tx("attempts", "readwrite", (s) => { s.delete(a.id); });
}

export const saveAttempt = (a: Attempt) => tx("attempts", "readwrite", (s) => { s.put(a); });
export const listAttempts = (fileId: string) =>
  tx<Attempt[]>("attempts", "readonly", (s) => s.index("fileId").getAll(fileId))
    .then((a) => a.sort((x, y) => y.date.localeCompare(x.date)));
export const deleteAttempt = (id: string) => tx("attempts", "readwrite", (s) => { s.delete(id); });

/* ---------------- Backups (zip export / merge restore) ---------------- */

export const putFile = (file: SavedFile) => tx("files", "readwrite", (s) => { s.put(file); });
export const putAttempt = (a: Attempt) => tx("attempts", "readwrite", (s) => { s.put(a); });
export const listAllAttempts = () => tx<Attempt[]>("attempts", "readonly", (s) => s.getAll());

/** Merge backup history into the local history; existing entries win, new ones are added. */
export function mergeHistory(entries: HistoryEntry[]): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  const byId = new Map(loadHistory().map((h) => [h.id, h] as const));
  for (const e of entries) if (e && e.id && !byId.has(e.id)) byId.set(e.id, e);
  const next = [...byId.values()].sort((a, b) => b.date.localeCompare(a.date));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

/** A retest set with one entry per wrong answer, most-missed questions first. */
export function missedQuestionSet(entries: HistoryEntry[]): QuestionSet {
  const byText = new Map<string, { question: Question; count: number; order: number }>();
  for (const entry of entries) {
    for (const w of entry.wrong) {
      const existing = byText.get(w.question.question);
      if (existing) existing.count += 1;
      else byText.set(w.question.question, { question: w.question, count: 1, order: byText.size });
    }
  }
  const questions = [...byText.values()]
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .map((v) => v.question);
  return { title: "Missed questions retest", questions };
}

/* ---------------- Analysis ---------------- */

export interface QuestionAnalysis { key: string; question: Question; seen: number; right: number; wrong: number; accuracy: number }
export interface FileAnalysis {
  attempts: number; best: number; latest: number; average: number;
  questions: QuestionAnalysis[];
}

const pct = (c: number, t: number) => (t ? Math.round((c / t) * 100) : 0);
/** Questions in a test may carry a prefixed id; match by original text. */
const qKey = (q: Question) => q.question;

export function computeFileAnalysis(attempts: Attempt[]): FileAnalysis {
  const map = new Map<string, QuestionAnalysis>();
  for (const a of attempts) {
    a.questions.forEach((q, i) => {
      const k = qKey(q);
      const row = map.get(k) ?? { key: k, question: q, seen: 0, right: 0, wrong: 0, accuracy: 0 };
      row.seen++;
      if (a.answers[i]?.correct) row.right++; else row.wrong++;
      map.set(k, row);
    });
  }
  const questions = [...map.values()].map((r) => ({ ...r, accuracy: pct(r.right, r.seen) }))
    .sort((a, b) => a.accuracy - b.accuracy || b.wrong - a.wrong);
  const scores = attempts.map((a) => pct(a.correct, a.total)); // newest first
  return {
    attempts: attempts.length,
    best: scores.length ? Math.max(...scores) : 0,
    latest: scores[0] ?? 0,
    average: scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : 0,
    questions,
  };
}
