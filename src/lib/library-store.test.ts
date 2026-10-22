import { describe, expect, it } from "vitest";
import { missedQuestionSet } from "./library-store";
import type { HistoryEntry } from "./library-store";
import type { Question, QuestionType } from "./quiz-types";

const q = (id: number, text: string, type: QuestionType = "kanji"): Question => ({
  id, type, question: text, options: ["a", "b"], answer: 0,
});
const entry = (id: string, wrong: Question[]): HistoryEntry => ({
  id, title: id, date: "2026-10-22T00:00:00Z", durationSec: 1, total: wrong.length + 1, correct: 1, wrong: wrong.map((question) => ({ question, answer: null })),
});

describe("missedQuestionSet", () => {
  it("collects one entry per wrong question, most-missed first", () => {
    const set = missedQuestionSet([
      entry("1", [q(1, "A"), q(2, "B")]),
      entry("2", [q(3, "A"), q(4, "C")]),
      entry("3", [q(5, "A")]),
    ]);
    expect(set.title).toBe("Missed questions retest");
    expect(set.questions.map((question) => question.question)).toEqual(["A", "B", "C"]);
  });

  it("returns an empty set when nothing was missed", () => {
    expect(missedQuestionSet([entry("1", [])]).questions).toEqual([]);
  });
});
