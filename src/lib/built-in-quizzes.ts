import type { Question, QuestionSet } from "./quiz-types";

export interface ManifestEntry {
  id: string;
  lesson: number;
  type: "vocabulary" | "kanji" | "grammar";
  url: string;
  title: string;
  description?: string;
}

export const FALLBACK_MANIFEST: ManifestEntry[] = [
  {
    id: "n5-kanji",
    lesson: 1,
    type: "kanji",
    url: "/quizzes/jlpt_n5_kanji_all.json",
    title: "JLPT N5 Kanji — Complete Set",
    description: "110 N5 kanji questions covering meanings and readings.",
  },
];

export async function fetchManifest(): Promise<ManifestEntry[]> {
  try {
    const res = await fetch("/quizzes/index.json");
    if (!res.ok) throw new Error("missing");
    const data: unknown = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error("empty");
    return data.filter(
      (e): e is ManifestEntry =>
        !!e && typeof e.id === "string" && typeof e.url === "string" && typeof e.title === "string" && typeof e.lesson === "number",
    );
  } catch {
    return FALLBACK_MANIFEST;
  }
}

/** Group by lesson, newest lesson first. */
export function groupByLesson(entries: ManifestEntry[]): [number, ManifestEntry[]][] {
  const map = new Map<number, ManifestEntry[]>();
  for (const e of entries) map.set(e.lesson, [...(map.get(e.lesson) ?? []), e]);
  return [...map.entries()].sort((a, b) => b[0] - a[0]);
}

/** Merge sets into one, prefixing ids with the source id so they stay unique. */
export function mergeSets(sources: { id: string; set: QuestionSet }[]): QuestionSet {
  const questions: Question[] = sources.flatMap(({ id, set }) =>
    set.questions.map((q, i) => ({ ...q, id: `${id}:${q.id ?? i}` })),
  );
  if (sources.length === 1) return { ...sources[0].set, questions };
  return { title: sources.map((s) => s.set.title).join(" + "), description: `Combined from ${sources.length} sets.`, questions };
}

/** Random subset of the given size (null = all, in original order). */
export function pickQuestions(set: QuestionSet, size: number | null, random = Math.random): QuestionSet {
  if (size === null || size >= set.questions.length) return set;
  const pool = [...set.questions];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return { ...set, questions: pool.slice(0, size) };
}
