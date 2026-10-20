import { normalizeQuizJson, validateQuestionSet } from "./quiz-store";
import { saveFile } from "./library-store";

/** Importing saves the file only; practice selection is the caller's choice. */
export async function importQuizFile(file: { text(): Promise<string> }) {
  const normalized = normalizeQuizJson(JSON.parse(await file.text()) as unknown);
  const validated = validateQuestionSet(normalized.json);
  if (!validated.ok) throw new Error(validated.error);
  const saved = await saveFile(validated.set);
  return { saved, fixes: normalized.fixes, total: normalized.total };
}

export function importFixDescription(result: Awaited<ReturnType<typeof importQuizFile>>) {
  return Object.entries(result.fixes).filter(([, count]) => count > 0)
    .map(([kind, count]) => `${kind}: ${count}`).join(", ");
}