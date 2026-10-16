import { describe, expect, it } from "vitest";
import { computeStats } from "./quiz-store";

const entry = (id: string, date: string, total: number, correct: number) => ({
  id, date, total, correct, byCategory: { kanji: { total, correct } },
});

describe("computeStats", () => {
  it("only counts tests still in the list (deleted ones are gone)", () => {
    const all = [entry("a", "2026-10-14T10:00:00", 10, 5), entry("b", "2026-10-15T10:00:00", 10, 9)];
    const afterDelete = all.filter((e) => e.id !== "a");
    const s = computeStats(afterDelete);
    expect(s.totalQuestions).toBe(10);
    expect(s.totalCorrect).toBe(9);
    expect(s.sessionsCompleted).toBe(1);
    expect(s.byCategory.kanji).toEqual({ total: 10, correct: 9 });
  });

  it("streak counts consecutive days", () => {
    const s = computeStats([entry("a", "2026-10-14T10:00:00", 1, 1), entry("b", "2026-10-15T10:00:00", 1, 1)]);
    expect(s.streak).toBe(2);
  });
});
