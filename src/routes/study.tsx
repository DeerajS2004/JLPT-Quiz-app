import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowUp, BookOpen, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { loadStudySet } from "@/lib/quiz-store";
import type { Question, QuestionSet } from "@/lib/quiz-types";
import { TYPE_LABELS } from "@/lib/quiz-types";

export const Route = createFileRoute("/study")({
  head: () => ({
    meta: [
      { title: "Study — JLPT Practice" },
      { name: "description", content: "Review every question, answer, and explanation in your saved JLPT study set." },
      { property: "og:title", content: "JLPT Practice Study" },
      { property: "og:description", content: "Review every question, answer, and explanation in your saved JLPT study set." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudyScreen,
});

function answerFor(question: Question) {
  if (question.format === "typed") return question.correctAnswers?.[0] ?? "No answer provided";
  return question.options?.[question.answer ?? -1] ?? "No answer provided";
}

function StudyScreen() {
  const [set, setSet] = useState<QuestionSet | null>(null);
  const [search, setSearch] = useState("");
  const [showTop, setShowTop] = useState(false);

  useEffect(() => setSet(loadStudySet()), []);

  useEffect(() => {
    const update = () => setShowTop(window.scrollY > 500);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const filteredQuestions = useMemo(() => {
    if (!set) return [];
    const query = search.trim().toLocaleLowerCase();
    if (!query) return set.questions.map((question, index) => ({ question, index }));
    return set.questions.flatMap((question, index) => {
      const text = [
        question.question,
        question.reading,
        answerFor(question),
        ...(question.correctAnswers ?? []),
        question.explanation,
      ].filter(Boolean).join(" ").toLocaleLowerCase();
      return text.includes(query) ? [{ question, index }] : [];
    });
  }, [search, set]);

  if (!set) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <BookOpen className="mx-auto h-8 w-8 text-hanko" />
        <h1 className="mt-4 font-display text-2xl font-semibold">No study set selected</h1>
        <p className="mt-2 text-muted-foreground">Load a question set first to study it offline.</p>
        <Button asChild className="mt-6"><Link to="/load">Choose a question set</Link></Button>
      </div>
    );
  }

  const isFiltering = search.trim().length > 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 border-b pb-5">
        <div className="font-display text-xs uppercase tracking-[0.2em] text-hanko">Study</div>
        <h1 className="mt-2 break-words font-display text-2xl font-semibold sm:text-3xl">{set.title}</h1>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {isFiltering ? `${filteredQuestions.length} of ${set.questions.length}` : `${set.questions.length} questions`}
          </p>
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search questions, answers, explanations"
              aria-label="Search questions, answers, and explanations"
              className="pl-9"
            />
          </div>
        </div>
      </header>

      {filteredQuestions.length > 0 ? (
        <ol className="space-y-3">
          {filteredQuestions.map(({ question, index }) => {
            const isTyped = question.format === "typed";
            const primaryAnswer = answerFor(question);
            const otherAnswers = isTyped
              ? (question.correctAnswers ?? []).slice(1)
              : (question.options ?? []).filter((_, optionIndex) => optionIndex !== question.answer);

            return (
              <li key={`${question.id}-${index}`} className="[content-visibility:auto] [contain-intrinsic-size:auto_240px]">
                <Card>
                  <CardContent className="p-4 sm:p-5">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Question {index + 1}
                      </span>
                      <Badge variant="outline" className="text-[11px]">
                        {TYPE_LABELS[question.type] ?? question.type}
                      </Badge>
                    </div>

                    <div className="jp break-words font-display text-xl leading-relaxed text-foreground sm:text-2xl">
                      {question.question}
                    </div>
                    {question.reading && <div className="jp mt-1 break-words text-sm text-muted-foreground">{question.reading}</div>}
                    {question.hint && (
                      <Badge variant="secondary" className="jp mt-2 max-w-full whitespace-normal">Hint: {question.hint}</Badge>
                    )}

                    <section className="mt-4" aria-label={`Answer to question ${index + 1}`}>
                      <div className="rounded-md border-l-4 border-hanko bg-secondary/60 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-hanko">Answer</div>
                        <p className="jp mt-1 break-words text-lg font-semibold leading-relaxed">{primaryAnswer}</p>
                        {otherAnswers.length > 0 && (
                          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                            {otherAnswers.map((answer, answerIndex) => (
                              <li key={`${answer}-${answerIndex}`} className="jp break-words">
                                <span className="font-medium">{isTyped ? "Also accepted:" : "Not:"}</span> {answer}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </section>

                    {question.explanation && (
                      <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">
                        {question.explanation}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="py-12 text-center text-sm text-muted-foreground" role="status">No questions match “{search}”.</p>
      )}

      {showTop && (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="fixed bottom-5 right-5 z-20 shadow-md"
          aria-label="Back to top"
          title="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <ArrowUp aria-hidden="true" />
        </Button>
      )}
    </main>
  );
}