import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, ChevronLeft, ChevronRight, Flag, LogOut } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  finalizeSession,
  loadActive,
  saveActive,
  type ActiveSession,
} from "@/lib/quiz-store";
import type { AnswerRecord } from "@/lib/quiz-types";
import { TYPE_LABELS } from "@/lib/quiz-types";
import { gradeTypedAnswer } from "@/lib/answer-grading";

export const Route = createFileRoute("/quiz")({
  head: () => ({ meta: [
    { title: "Quiz — JLPT Practice" },
    { name: "description", content: "Practice JLPT questions offline with a timed test and private local answer grading." },
    { property: "og:title", content: "JLPT Practice Quiz" },
    { property: "og:description", content: "Practice JLPT questions offline with a timed test and private local answer grading." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: QuizScreen,
});

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function QuizScreen() {
  const navigate = useNavigate();
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [now, setNow] = useState(Date.now());
  const [typedDrafts, setTypedDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    const a = loadActive();
    if (!a) {
      navigate({ to: "/load" });
      return;
    }
    setActive(a);
  }, [navigate]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const [pending, setPending] = useState<null | "finish" | "exit">(null);

  /** End the current set; optionally save it, then continue with the next queued set unless exiting. */
  const finish = useCallback(
    (a: ActiveSession, save = true, exitAll = false) => {
      const savedId = save ? finalizeSession(a).id : a.lastSavedId;
      if (!save) saveActive(null);
      const queue = a.queue ?? [];
      if (!exitAll && queue.length > 0) {
        const [nextSet, ...rest] = queue;
        const next: ActiveSession = {
          set: nextSet, startedAt: Date.now(), durationSec: a.durationSec,
          answers: [], currentIndex: 0, queue: rest, lastSavedId: savedId,
        };
        saveActive(next);
        setActive(next);
        setTypedDrafts({});
        setNow(Date.now());
        toast.success(save ? "Set saved — next set started" : "Set discarded — next set started", { description: nextSet.title });
        return;
      }
      if (savedId) navigate({ to: "/results", search: { id: savedId } });
      else navigate({ to: "/" });
    },
    [navigate],
  );

  const timeLeft = useMemo(() => {
    if (!active) return 0;
    const elapsed = Math.floor((now - active.startedAt) / 1000);
    return Math.max(0, active.durationSec - elapsed);
  }, [active, now]);

  useEffect(() => {
    if (active && timeLeft === 0 && active.durationSec > 0) {
      finish(active);
    }
  }, [active, timeLeft, finish]);

  const select = useCallback(
    (choiceIdx: number) => {
      if (!active) return;
      const q = active.set.questions[active.currentIndex];
      const correct = choiceIdx === q.answer;
      const record: AnswerRecord = {
        questionId: q.id,
        selected: choiceIdx,
        correct,
        timeMs: Date.now() - active.startedAt,
      };
      const answers = [...active.answers];
      answers[active.currentIndex] = record;
      const last = active.currentIndex >= active.set.questions.length - 1;
      const next = {
        ...active,
        answers,
        currentIndex: last ? active.currentIndex : active.currentIndex + 1,
      };
      setActive(next);
      saveActive(next);
      if (last) finish(next);
    },
    [active, finish],
  );

  const submitTyped = useCallback(() => {
    if (!active) return;
    const q = active.set.questions[active.currentIndex];
    const typedAnswer = typedDrafts[active.currentIndex] ?? "";
    if (!typedAnswer.trim()) {
      toast.error("Enter an answer first");
      return;
    }
    const record: AnswerRecord = {
      questionId: q.id,
      selected: null,
      typedAnswer,
      correct: gradeTypedAnswer(typedAnswer, q.correctAnswers ?? [], q.strict === true),
      timeMs: Date.now() - active.startedAt,
    };
    const answers = [...active.answers];
    answers[active.currentIndex] = record;
    const last = active.currentIndex >= active.set.questions.length - 1;
    const next = {
      ...active,
      answers,
      currentIndex: last ? active.currentIndex : active.currentIndex + 1,
    };
    setActive(next);
    saveActive(next);
    if (last) finish(next);
  }, [active, finish, typedDrafts]);

  const goNext = useCallback(() => {
    if (!active) return;
    const last = active.currentIndex >= active.set.questions.length - 1;
    if (last) {
      if (active.answers.filter(Boolean).length < active.set.questions.length) setPending("finish");
      else finish(active);
      return;
    }
    const next = { ...active, currentIndex: active.currentIndex + 1 };
    setActive(next);
    saveActive(next);
  }, [active, finish]);

  const goPrev = useCallback(() => {
    if (!active || active.currentIndex === 0) return;
    const next = { ...active, currentIndex: active.currentIndex - 1 };
    setActive(next);
    saveActive(next);
  }, [active]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!active) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code)?.[1];
      if (digit) {
        const idx = parseInt(digit, 10) - 1;
        const q = active.set.questions[active.currentIndex];
        if (idx < (q.options?.length ?? 0)) select(idx);
      } else if (e.key === "ArrowRight") {
        goNext();
      } else if (e.key === "ArrowLeft") {
        goPrev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, select, goNext, goPrev]);

  if (!active) return null;

  const q = active.set.questions[active.currentIndex];
  const record = active.answers[active.currentIndex];
  const total = active.set.questions.length;
  const answered = active.answers.filter(Boolean).length;
  const progress = ((active.currentIndex + 1) / total) * 100;
  const lowTime = timeLeft <= 30 && active.durationSec > 0;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* Top bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm">
          {(active.queue?.length ?? 0) > 0 && (
            <Badge variant="secondary">{active.queue!.length} more set(s)</Badge>
          )}
          <Badge variant="outline" className="border-ink/20 font-display">
            {active.currentIndex + 1} / {total}
          </Badge>
          <span className="text-muted-foreground">{TYPE_LABELS[q.type] ?? q.type}</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className={`flex items-center gap-1.5 tabular-nums ${lowTime ? "text-hanko" : "text-muted-foreground"}`}>
            <Clock className="h-4 w-4" /> {fmtTime(timeLeft)}
          </div>
          <div className="text-muted-foreground tabular-nums">
            Answered {answered}/{total}
          </div>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => setPending("finish")}>
            <Flag className="mr-1.5 h-3.5 w-3.5" /> Finish set
          </Button>
          {(active.queue?.length ?? 0) > 0 && (
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setPending("exit")}>
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Exit all
            </Button>
          )}
          <AlertDialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{pending === "exit" ? "Exit the remaining sets?" : "Finish this set now?"}</AlertDialogTitle>
                <AlertDialogDescription>
                  {total - answered > 0 ? `${total - answered} unanswered question(s) will count as incorrect if saved. ` : ""}
                  Save this test to your results and stats, or ignore it completely?
                  {pending === "exit" ? " Sets already completed stay saved." : (active.queue?.length ? " The next set starts afterwards." : "")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep going</AlertDialogCancel>
                <Button variant="outline" onClick={() => { const p = pending; setPending(null); finish(active, false, p === "exit"); }}>
                  Ignore test
                </Button>
                <AlertDialogAction
                  className="bg-hanko text-paper hover:bg-hanko/90"
                  onClick={() => { const p = pending; setPending(null); finish(active, true, p === "exit"); }}
                >
                  Save to stats
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Progress value={progress} className="mb-8 h-1" />

      {/* Question card */}
      <Card className="border-paper-soft bg-card p-8 shadow-sm md:p-12">
        <div className="mb-1 font-display text-xs uppercase tracking-[0.2em] text-hanko">
          Question {active.currentIndex + 1}
        </div>
        <div className="jp font-display text-2xl leading-relaxed text-foreground md:text-3xl">
          {q.question}
        </div>
        {q.reading && (
          <div className="mt-2 jp text-sm text-muted-foreground">{q.reading}</div>
        )}

        <div className="mt-8 space-y-3">
          {q.format === "typed" ? (
            <form onSubmit={(event) => { event.preventDefault(); submitTyped(); }} className="space-y-3">
              {q.hint && <Badge variant="secondary" className="jp max-w-full whitespace-normal">Hint: {q.hint}</Badge>}
              <Input
                aria-label="Type your answer"
                autoComplete="off"
                lang="ja"
                value={typedDrafts[active.currentIndex] ?? record?.typedAnswer ?? ""}
                onChange={(event) => setTypedDrafts((drafts) => ({ ...drafts, [active.currentIndex]: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) {
                    event.preventDefault();
                  }
                }}
                placeholder={q.hint || "Type your answer in English or Japanese"}
                className="h-12 text-base"
              />
              <Button type="submit" className="bg-hanko text-paper hover:bg-hanko/90">
                Submit answer <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </form>
          ) : (q.options ?? []).map((opt, idx) => {
            const isSelected = record?.selected === idx;
            const baseClasses =
              "group flex w-full items-center gap-4 rounded-md border bg-background p-4 text-left transition-all hover:border-hanko/40";
            const stateClasses = isSelected ? "border-hanko bg-hanko/5" : "border-border";

            return (
              <Button
                type="button"
                key={idx}
                onClick={() => select(idx)}
                variant="outline"
                className={`${baseClasses} ${stateClasses}`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-border bg-muted font-display text-xs font-medium text-muted-foreground">
                  {idx + 1}
                </span>
                <span className="jp flex-1 text-base">{opt}</span>
              </Button>
            );
          })}
        </div>
      </Card>

      {/* Nav */}
      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" onClick={goPrev} disabled={active.currentIndex === 0}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Previous
        </Button>
        <div className="text-xs text-muted-foreground">
          {q.format === "typed" ? "Type your answer and press Enter" : <>Press <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">1–{q.options?.length ?? 0}</kbd> to answer</>}
        </div>
        <Button onClick={goNext} className="bg-hanko text-paper hover:bg-hanko/90">
          {active.currentIndex >= total - 1 ? "Finish" : "Skip"} <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
