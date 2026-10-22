import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import { exportBackup, restoreBackup } from "./backup";
import {
  addHistory, deleteFile, listAllAttempts, listFiles, loadHistory, saveAttempt, saveFile,
  type HistoryEntry,
} from "./library-store";
import { loadLedger, mergeLedger } from "./quiz-store";
import type { Question } from "./quiz-types";

// Node test env has no localStorage; stub the small surface the stores use.
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
    clear: () => store.clear(),
    key: () => null,
    get length() { return store.size; },
  } as Storage;
}

const q = (id: number, text: string): Question => ({ id, type: "kanji", question: text, options: ["a", "b"], answer: 0 });
const set = { title: "Backup Test", questions: [q(1, "x"), q(2, "y")] };

const historyEntry = (id: string): HistoryEntry => ({
  id, title: `T${id}`, date: "2026-10-22T10:00:00Z", durationSec: 5, total: 2, correct: 1,
  wrong: [{ question: q(2, "y"), answer: { questionId: 2, selected: 1, correct: false, timeMs: 1 } }],
});

beforeAll(async () => {
  await saveFile(set);
  await saveAttempt({
    id: "a1", fileId: "backup-test", date: "2026-10-22T10:00:00Z", durationSec: 5, total: 2, correct: 1,
    questions: set.questions, answers: [{ questionId: 1, selected: 0, correct: true, timeMs: 1 }],
  });
  addHistory(historyEntry("h1"));
  mergeLedger([{ id: "h1", date: "2026-10-22T10:00:00Z", total: 2, correct: 1, byCategory: { kanji: { total: 2, correct: 1 } } }]);
});

describe("backup round trip", () => {
  it("exports and restores files, attempts, history, and ledger", async () => {
    const { blob, summary } = await exportBackup();
    expect(summary).toMatchObject({ files: 1, attempts: 1, history: 1, ledger: 1 });

    // Wipe the local data, then restore from the zip.
    await deleteFile("backup-test", true);
    addHistory({ ...historyEntry("h0"), id: "h0" }); // local entry that must survive the restore
    expect(await listFiles()).toHaveLength(0);
    expect(await listAllAttempts()).toHaveLength(0);

    const restored = await restoreBackup(blob);
    expect(restored).toMatchObject({ files: 1, attempts: 1, history: 1, ledger: 1 });

    expect(await listFiles()).toHaveLength(1);
    expect(await listAllAttempts()).toHaveLength(1);
    const history = loadHistory();
    expect(history.map((h) => h.id).sort()).toEqual(["h0", "h1"]);
    expect(loadLedger().map((e) => e.id)).toContain("h1");
  });

  it("rejects a zip that is not a backup", async () => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file("readme.txt", "not a backup");
    const blob = await zip.generateAsync({ type: "blob" });
    await expect(restoreBackup(blob)).rejects.toThrow(/No JSON entries/);
  });
});
