export type QuestionType = "kanji" | "vocabulary" | "grammar" | "reading" | "expression";

export interface Question {
  id: number | string;
  type: QuestionType;
  question: string;
  reading?: string;
  format?: "multiple_choice" | "typed";
  options?: string[];
  answer?: number;
  correctAnswers?: string[];
  hint?: string;
  strict?: boolean;
  explanation?: string;
}

export interface QuestionSet {
  day?: string;
  date?: string;
  title: string;
  description?: string;
  /** Saved-library file this set came from. */
  sourceId?: string;
  questions: Question[];
}

export interface AnswerRecord {
  questionId: Question["id"];
  selected: number | null; // null = unanswered
  typedAnswer?: string;
  correct: boolean;
  timeMs: number;
}

export interface SessionResult {
  id: string;
  title: string;
  day?: string;
  date: string; // ISO timestamp completed
  durationSec: number;
  total: number;
  correct: number;
  answers: AnswerRecord[];
  questions: Question[];
}

export interface CategoryStat {
  total: number;
  correct: number;
}

export interface Statistics {
  totalQuestions: number;
  totalCorrect: number;
  sessionsCompleted: number;
  streak: number;
  lastSessionDate: string | null; // YYYY-MM-DD
  byCategory: Record<QuestionType, CategoryStat>;
}

export const QUESTION_TYPES: QuestionType[] = [
  "kanji",
  "vocabulary",
  "grammar",
  "reading",
  "expression",
];

export const TYPE_LABELS: Record<QuestionType, string> = {
  kanji: "Kanji 漢字",
  vocabulary: "Vocabulary 語彙",
  grammar: "Grammar 文法",
  reading: "Reading 読解",
  expression: "Expression 表現",
};
