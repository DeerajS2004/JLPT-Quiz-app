import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { importQuizFile } from "./quiz-file-import";
import { deleteFile, getFile, listAttempts } from "./library-store";

describe("upload to save", () => {
  it("stores a JSON file for later without creating an attempt or selecting practice", async () => {
    const set = { title: "Save-only test", questions: [{ id: 1, type: "kanji", question: "山", options: ["mountain", "river"], answer: 0 }] };
    const result = await importQuizFile({ text: async () => JSON.stringify(set) });
    expect((await getFile(result.saved.id))?.set).toEqual(set);
    expect(await listAttempts(result.saved.id)).toEqual([]);
    expect(result.saved.set.sourceId).toBeUndefined();
    expect(result.total).toBe(0);
    // A separate read reopens storage, as it would after leaving the page.
    expect((await getFile(result.saved.id))?.title).toBe("Save-only test");
    await deleteFile(result.saved.id, true);
    expect(await getFile(result.saved.id)).toBeUndefined();
  });

  it("repairs saved uploads before validation", async () => {
    const result = await importQuizFile({ text: async () => JSON.stringify({ title: "Repair save test", type: "kanji", questions: [{ question: "山", options: ["mountain", "river"], answer: "mountain" }] }) });
    expect(result.saved.set.questions[0]).toMatchObject({ type: "kanji", answer: 0 });
    expect(result.total).toBe(2);
    await deleteFile(result.saved.id, true);
  });

  it("does not store an invalid file", async () => {
    await expect(importQuizFile({ text: async () => JSON.stringify({ title: "Invalid save", questions: [{ type: "kanji", question: "山", options: ["a", "b"], answer: 7 }] }) })).rejects.toThrow("Question #1:");
    expect(await getFile("invalid-save")).toBeUndefined();
  });
});