import { describe, expect, it } from "vitest";
import { groupByLesson, groupBySection, mergeSets, pickQuestions } from "./built-in-quizzes";
import type { QuestionSet } from "./quiz-types";

const mk = (n: number): QuestionSet => ({
  title: "S",
  questions: Array.from({ length: n }, (_, i) => ({ id: i + 1, type: "kanji", question: `q${i}`, options: ["a", "b"], answer: 0 })),
});

describe("library", () => {
  it("keeps ids unique after merging", () => {
    const m = mergeSets([{ id: "a", set: mk(3) }, { id: "b", set: mk(3) }]);
    expect(new Set(m.questions.map((q) => q.id)).size).toBe(6);
  });
  it("picks 10 of 50", () => expect(pickQuestions(mk(50), 10).questions).toHaveLength(10));
  it("All keeps every question", () => expect(pickQuestions(mk(50), null).questions).toHaveLength(50));
  it("newest lesson first", () => {
    const g = groupByLesson([
      { id: "a", lesson: 1, type: "kanji", url: "", title: "" },
      { id: "b", lesson: 3, type: "kanji", url: "", title: "" },
    ]);
    expect(g[0][0]).toBe(3);
  });
});

describe("groupBySection", () => {
  it("lists easier levels first (N5 before N4)", () => {
    const entries = [
      { id: "n4-kanji", level: "N4", lesson: 4, type: "kanji", url: "/a", title: "N4 Kanji" },
      { id: "n5-vocab", level: "N5", lesson: 2, type: "vocabulary", url: "/b", title: "N5 Vocab" },
    ] as never[];
    const [first] = groupBySection(entries);
    expect(first[0]).toBe("N5");
  });
});
