import { describe, expect, it } from "vitest";
import { normalizeQuizJson, validateQuestionSet } from "./quiz-store";

const question = { id: 1, question: "Meaning?", type: "kanji", options: ["One", "Two", "Three"], answer: 0 };
const normalize = (q: Record<string, unknown>) => normalizeQuizJson({ title: "Generated", questions: [q] });

describe("quiz JSON normalization", () => {
  it("loads top-level type, text choice answers, and typed acceptedAnswers", () => {
    const result = normalizeQuizJson({ title: "Generated", type: "kanji", questions: [
      { id: 1, question: "一", options: ["one", "two"], answer: "one" },
      { id: 2, question: "二", format: "text", answer: "two", acceptedAnswers: ["two", ["に", "二"]] },
    ] });
    const validated = validateQuestionSet(result.json);
    expect(validated.ok).toBe(true);
    if (!validated.ok) throw new Error(validated.error);
    expect(validated.set.questions[0]).toMatchObject({ type: "kanji", answer: 0 });
    expect(validated.set.questions[1]).toMatchObject({ type: "kanji", format: "typed", correctAnswers: ["two", "に", "二"] });
    expect(result.fixes).toMatchObject({ "question type": 2, "answer text → index": 1, "typed answers": 1, "format aliases": 1 });
    expect(result.total).toBe(5);
  });

  it("leaves canonical files unchanged with zero repairs and does not mutate inputs", () => {
    const raw = { title: "Canonical", questions: [question, { id: 2, type: "reading", question: "Read", format: "typed", correctAnswers: ["いち"], hint: "Kana", strict: true }] };
    const original = structuredClone(raw);
    const result = normalizeQuizJson(raw);
    expect(result.json).toEqual(original);
    expect(raw).toEqual(original);
    expect(result.total).toBe(0);
    expect(validateQuestionSet(result.json)).toEqual(validateQuestionSet(raw));
  });

  it("uses valid top-level types only and never replaces an existing invalid type", () => {
    for (const type of ["kanji", "vocabulary", "grammar", "reading", "expression"]) {
      const result = normalizeQuizJson({ title: "Set", type, questions: [{ id: 1, question: "Q", options: ["a", "b"], answer: 0 }] });
      expect(result.fixes["question type"]).toBe(1);
      expect(validateQuestionSet(result.json).ok).toBe(true);
    }
    expect(normalizeQuizJson({ title: "Set", type: "unknown", questions: [{ question: "Q" }] }).fixes["question type"]).toBe(0);
    expect(normalizeQuizJson({ title: "Set", type: "kanji", questions: [{ ...question, type: "unknown" }] }).fixes["question type"]).toBe(0);
  });

  it.each(["multiple_choice", "mc", "choice"])("drops multiple-choice format %s", (format) => {
    const result = normalize({ ...question, format });
    expect(result.json).toEqual({ title: "Generated", questions: [question] });
    expect(result.fixes["format aliases"]).toBe(format === "multiple_choice" ? 0 : 1);
  });

  it.each(["typed", "text", "free"])("normalizes typed format %s", (format) => {
    const result = normalize({ ...question, format, correctAnswers: ["one"] });
    expect(validateQuestionSet(result.json)).toMatchObject({ ok: true, set: { questions: [{ format: "typed" }] } });
  });

  it("matches exact options before trimmed case-insensitive options and numeric indexes", () => {
    const exact = normalize({ ...question, options: ["two", "Two", "2"], answer: "Two" });
    expect(validateQuestionSet(exact.json)).toMatchObject({ set: { questions: [{ answer: 1 }] } });
    const folded = normalize({ ...question, answer: " TWO " });
    expect(validateQuestionSet(folded.json)).toMatchObject({ set: { questions: [{ answer: 1 }] } });
    const numericOption = normalize({ ...question, options: ["2", "x", "y"], answer: "2" });
    expect(validateQuestionSet(numericOption.json)).toMatchObject({ set: { questions: [{ answer: 0 }] } });
    const numeric = normalize({ ...question, answer: "2" });
    expect(validateQuestionSet(numeric.json)).toMatchObject({ set: { questions: [{ answer: 2 }] } });
    expect(numeric.fixes["numeric answer → index"]).toBe(1);
  });

  it.each(["acceptedAnswers", "accepted", "accept", "acceptableAnswers", "expectedAnswer"])("flattens %s with the main answer first", (key) => {
    const result = normalize({ id: 1, type: "kanji", question: "Q", format: "typed", answer: "one", [key]: ["one", ["いち", "いち"]] });
    expect(validateQuestionSet(result.json)).toMatchObject({ set: { questions: [{ correctAnswers: ["one", "いち"] }] } });
    expect(result.fixes["typed answers"]).toBe(1);
  });

  it("uses the first existing alias and preserves existing correctAnswers", () => {
    const result = normalize({ ...question, format: "typed", answer: "one", acceptedAnswers: ["first"], accepted: ["later"] });
    expect(validateQuestionSet(result.json)).toMatchObject({ set: { questions: [{ correctAnswers: ["one", "first"] }] } });
    expect(normalize({ ...question, format: "typed", correctAnswers: ["original"], accepted: ["later"] }).fixes["typed answers"]).toBe(0);
  });

  it("infers typed questions only without a format or options", () => {
    for (const fields of [{ answer: "one" }, { correctAnswers: ["one"] }]) {
      const result = normalize({ id: 1, type: "kanji", question: "Q", ...fields });
      expect(validateQuestionSet(result.json)).toMatchObject({ ok: true, set: { questions: [{ format: "typed", correctAnswers: ["one"] }] } });
      expect(result.fixes["inferred typed format"]).toBe(1);
    }
    expect(normalize({ ...question, answer: "one" }).fixes["inferred typed format"]).toBe(0);
  });

  it("ignores unknown keys without counting them as repairs", () => {
    const result = normalize({ ...question, input: "ime", count: 12, category: "other", source: {} });
    expect(validateQuestionSet(result.json).ok).toBe(true);
    expect(result.total).toBe(0);
  });

  it("retains the exact validation error for an unfixable answer", () => {
    const result = normalize({ ...question, answer: "not an option" });
    expect(validateQuestionSet(result.json)).toEqual({ ok: false, error: "Question #1: `answer` must be a valid index into `options`." });
  });

  it("does not relax canonical validation or repair invalid existing correctAnswers", () => {
    const result = normalize({ ...question, format: "typed", correctAnswers: [], answer: "one" });
    expect(validateQuestionSet(result.json)).toEqual({ ok: false, error: "Question #1: typed questions need one or more non-empty strings in `correctAnswers`." });
    expect(validateQuestionSet(normalize({ ...question, hint: 42 }).json)).toEqual({ ok: false, error: "Question #1: `hint` must be a string when provided." });
  });
});