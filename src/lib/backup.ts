import JSZip from "jszip";
import {
  listAllAttempts,
  listFiles,
  loadHistory,
  mergeHistory,
  putAttempt,
  putFile,
  type Attempt,
  type HistoryEntry,
  type SavedFile,
} from "./library-store";
import { loadLedger, mergeLedger, type LedgerEntry } from "./quiz-store";

export interface BackupSummary {
  files: number;
  attempts: number;
  history: number;
  ledger: number;
}

const safeName = (id: string) => id.replace(/[/\\:*?"<>|]/g, "_");

/** Zip the whole local library: saved files, full attempts, history, and the stats ledger. */
export async function exportBackup(): Promise<{ name: string; blob: Blob; summary: BackupSummary }> {
  const files = await listFiles();
  const attempts = await listAllAttempts();
  const history = loadHistory();
  const ledger = loadLedger();
  const summary: BackupSummary = {
    files: files.length, attempts: attempts.length, history: history.length, ledger: ledger.length,
  };

  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify({
    app: "jlpt-practice", version: 1, exportedAt: new Date().toISOString(), counts: summary,
  }));
  for (const file of files) zip.file(`files/${safeName(file.id)}.json`, JSON.stringify(file));
  for (const attempt of attempts) zip.file(`attempts/${safeName(attempt.fileId)}/${safeName(attempt.id)}.json`, JSON.stringify(attempt));
  if (history.length) zip.file("history.json", JSON.stringify(history));
  if (ledger.length) zip.file("ledger.json", JSON.stringify(ledger));

  const blob = await zip.generateAsync({ type: "blob" });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return { name: `jlpt-backup-${stamp}.zip`, blob, summary };
}

function parseZipEntry<T>(raw: string, keep: (value: unknown) => T | null, kind: string): T {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error(`A ${kind} entry in the backup is not valid JSON.`); }
  const value = keep(parsed);
  if (value === null) throw new Error(`A ${kind} entry in the backup has an unexpected format.`);
  return value;
}

const asFile = (v: unknown): SavedFile | null => {
  const f = v as SavedFile;
  return f && typeof f === "object" && typeof f.id === "string" && f.id &&
    typeof f.set?.title === "string" && Array.isArray(f.set?.questions) ? f : null;
};
const asAttempt = (v: unknown): Attempt | null => {
  const a = v as Attempt;
  return a && typeof a === "object" && typeof a.id === "string" && a.id &&
    typeof a.fileId === "string" && Array.isArray(a.questions) && Array.isArray(a.answers) ? a : null;
};
const asHistoryEntry = (v: unknown): HistoryEntry | null => {
  const h = v as HistoryEntry;
  return h && typeof h === "object" && typeof h.id === "string" && h.id && Array.isArray(h.wrong) ? h : null;
};
const asLedgerEntry = (v: unknown): LedgerEntry | null => {
  const e = v as LedgerEntry;
  return e && typeof e === "object" && typeof e.id === "string" && e.id &&
    typeof e.date === "string" && typeof e.total === "number" ? e : null;
};

/** Restore a backup zip, merging by id — existing entries stay, new ones are added. */
export async function restoreBackup(archive: Blob | File): Promise<BackupSummary> {
  const zip = await JSZip.loadAsync(await archive.arrayBuffer());
  const summary: BackupSummary = { files: 0, attempts: 0, history: 0, ledger: 0 };

  const jsonEntries = Object.values(zip.files).filter((f) => !f.dir && f.name.endsWith(".json"));
  if (jsonEntries.length === 0) throw new Error("No JSON entries found — is this a JLPT Practice backup?");

  for (const entry of jsonEntries) {
    const raw = await entry.async("string");
    if (/^files\/.*\.json$/.test(entry.name)) {
      const file = parseZipEntry(raw, asFile, "saved file");
      await putFile(file);
      summary.files++;
    } else if (/^attempts\/.*\.json$/.test(entry.name)) {
      const attempt = parseZipEntry(raw, asAttempt, "attempt");
      await putAttempt(attempt);
      summary.attempts++;
    } else if (entry.name === "history.json") {
      const entries = parseZipEntry(raw, (v) => (Array.isArray(v) ? v : null), "history");
      mergeHistory(entries.map(asHistoryEntry).filter((h): h is HistoryEntry => h !== null));
      summary.history = entries.length;
    } else if (entry.name === "ledger.json") {
      const entries = parseZipEntry(raw, (v) => (Array.isArray(v) ? v : null), "ledger");
      mergeLedger(entries.map(asLedgerEntry).filter((e): e is LedgerEntry => e !== null));
      summary.ledger = entries.length;
    }
    // manifest.json and unknown entries are skipped.
  }
  return summary;
}
