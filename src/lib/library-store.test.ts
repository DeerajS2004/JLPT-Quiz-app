import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  computeFileAnalysis, fileIdFor, getFile, masteryFor, missedQuestionSet, saveFile, setFileFolder,
  sortFiles, toHistoryEntry, type Attempt, type HistoryEntry, type SavedFile,
} from "./library-store";
import type { Question, QuestionType, SessionResult } from "./quiz-types";

const q = (id: number, text: string, type: QuestionType = "kanji"): Question =>
  ({ id, type, question: text, options: ["a", "b"], answer: 0 });

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

describe("missedQuestionSet", () => {
  const entry = (id: string, wrong: Question[]): HistoryEntry => ({
    id, title: id, date: "2026-10-22T00:00:00Z", durationSec: 1, total: wrong.length + 1, correct: 1,
    wrong: wrong.map((question) => ({ question, answer: null })),
  });

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

describe("sortFiles", () => {
  const file = (title: string, savedAt: string): SavedFile => ({ id: title, title, savedAt, set: { title, questions: [] } });
  const base = [file("C", "2026-03-01"), file("a", "2026-02-01"), file("B", "2026-01-02")];

  it("newest first puts the latest savedAt first", () => {
    expect(sortFiles(base, "newest").map((f) => f.title)).toEqual(["C", "a", "B"]);
  });

  it("oldest first puts the earliest savedAt first", () => {
    expect(sortFiles(base, "oldest").map((f) => f.title)).toEqual(["B", "a", "C"]);
  });

  it("A→Z sorts titles case-insensitively", () => {
    expect(sortFiles(base, "az").map((f) => f.title)).toEqual(["a", "B", "C"]);
  });

  it("Z→A reverses the A→Z order", () => {
    expect(sortFiles(base, "za").map((f) => f.title)).toEqual(["C", "B", "a"]);
  });
});

describe("setFileFolder", () => {
  it("sets and clears a folder without losing the file", async () => {
    await saveFile({ title: "Folder Test", questions: [] });
    const id = fileIdFor({ title: "Folder Test", questions: [] });
    await setFileFolder(id, "N5 Kanji");
    expect((await getFile(id))?.folder).toBe("N5 Kanji");
    await setFileFolder(id, "   ");
    expect((await getFile(id))?.folder).toBeUndefined();
  });
});

describe("masteryFor", () => {
  it("marks three right in a row as mastered", () => {
    expect(masteryFor([true, true, true])).toEqual({ streak: 3, mastery: "mastered" });
  });

  it("marks a latest miss as struggling even after a long earlier streak", () => {
    expect(masteryFor([false, true, true, true])).toEqual({ streak: 0, mastery: "struggling" });
  });

  it("marks accuracy under 50% as struggling even when the latest was right", () => {
    expect(masteryFor([true, false, false])).toEqual({ streak: 1, mastery: "struggling" });
  });

  it("marks everything else as learning", () => {
    expect(masteryFor([true, true, false, true])).toEqual({ streak: 2, mastery: "learning" });
  });
});
