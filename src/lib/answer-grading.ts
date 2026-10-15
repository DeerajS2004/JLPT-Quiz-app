/** Normalize text for local, language-agnostic answer comparison. */
export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\b(?:a|an|the)\b/gu, " ")
    .replace(/[\p{P}\p{S}\s]/gu, "");
}

function editDistance(left: string, right: string): number {
  const a = Array.from(left);
  const b = Array.from(right);
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }

  return previous[b.length] ?? Math.max(a.length, b.length);
}

/**
 * Accept exact normalized matches, plus only small typos in longer answers.
 * This deliberately does not infer synonyms or semantic equivalence.
 */
export function gradeTypedAnswer(answer: string, acceptedAnswers: string[], strict = false): boolean {
  const normalizedAnswer = normalizeAnswer(answer);
  if (!normalizedAnswer) return false;
  if (strict) {
    return acceptedAnswers.some((accepted) => {
      const normalizedAccepted = normalizeAnswer(accepted);
      return normalizedAccepted.length > 0 && normalizedAnswer === normalizedAccepted;
    });
  }

  return acceptedAnswers.some((accepted) => {
    const normalizedAccepted = normalizeAnswer(accepted);
    if (!normalizedAccepted) return false;
    if (normalizedAnswer === normalizedAccepted) return true;

    const length = Math.max(Array.from(normalizedAnswer).length, Array.from(normalizedAccepted).length);
    const allowedDistance = length >= 12 ? 2 : length >= 5 ? 1 : 0;
    return allowedDistance > 0 && editDistance(normalizedAnswer, normalizedAccepted) <= allowedDistance;
  });
}