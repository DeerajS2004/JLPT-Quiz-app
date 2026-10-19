import { describe, expect, it } from "vitest";
import { computeFileAnalysis, fileIdFor, toHistoryEntry, type Attempt } from "./library-store";
import type { Question, SessionResult } from "./quiz-types";

const q = (id: number, text: string): Question => ({ id, type: "kanji", question: text, options: ["a", "b"], answer: 0 });

describe("history", () => {
  it("stores only the wrong answers of a test", () => {
    const result: SessionResult = {
      id: "1", title: "T", date: "2026-10-19T00:00:00Z", durationSec: 5, total: 3, correct: 1,
      questions: [q(1, "x"), q(2, "y"), q(3, "z")],
      answers: [
        { questionId: 1, selected: 0, correct: true, timeMs: 1 },
        { questionId: 2, selected: 1, correct: false, timeMs: 1 },
      ],
    };
    const h = toHistoryEntry(result);
    expect(h.wrong.map((w) => w.question.question)).toEqual(["y", "z"]);
    expect(h.correct).toBe(1);
    expect(h.total).toBe(3);
  });
});

describe("saved files", () => {
  it("re-uploading the same title maps to the same file", () => {
    expect(fileIdFor({ title: "N5 Kanji ", questions: [] })).toBe(fileIdFor({ title: "n5 kanji", questions: [] }));
  });
});

describe("file analysis", () => {
  it("counts right/wrong per question across attempts, hardest first", () => {
    const mk = (id: string, date: string, c1: boolean, c2: boolean): Attempt => ({
      id, fileId: "f", date, durationSec: 1, total: 2, correct: Number(c1) + Number(c2),
      questions: [q(1, "x"), q(2, "y")],
      answers: [{ questionId: 1, selected: 0, correct: c1, timeMs: 1 }, { questionId: 2, selected: 0, correct: c2, timeMs: 1 }],
    });
    const a = computeFileAnalysis([mk("2", "2026-10-19", true, false), mk("1", "2026-10-18", true, true)]);
    expect(a.questions[0]).toMatchObject({ key: "y", seen: 2, right: 1, wrong: 1, accuracy: 50 });
    expect(a.questions[1]).toMatchObject({ key: "x", right: 2, accuracy: 100 });
    expect(a.best).toBe(100);
    expect(a.latest).toBe(50);
    expect(a.average).toBe(75);
  });
});
