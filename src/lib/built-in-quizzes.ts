import type { QuestionSet } from "./quiz-types";

export interface BuiltInQuiz {
  id: string;
  url: string;
  title: string;
  description: string;
}

export const BUILT_IN_QUIZZES: BuiltInQuiz[] = [
  {
    id: "n5-kanji",
    url: "/quizzes/jlpt_n5_kanji_all.json",
    title: "JLPT N5 Kanji — Complete Set",
    description: "110 N5 kanji questions covering meanings and readings.",
  },
];

export async function fetchBuiltIn(quiz: BuiltInQuiz): Promise<QuestionSet> {
  const res = await fetch(quiz.url);
  if (!res.ok) throw new Error(`Failed to load ${quiz.title}`);
  return (await res.json()) as QuestionSet;
}
