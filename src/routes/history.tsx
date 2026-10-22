import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Repeat, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { loadHistory, missedQuestionSet, removeHistory, type HistoryEntry } from "@/lib/library-store";
import { saveActive } from "@/lib/quiz-store";
import type { AnswerRecord, Question } from "@/lib/quiz-types";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Test History — JLPT Practice" },
      { name: "description", content: "Every JLPT test you've taken with marks and the questions you got wrong." },
      { property: "og:title", content: "JLPT Test History" },
      { property: "og:description", content: "Marks and wrong answers for every JLPT practice test." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

export function answerText(q: Question, a: AnswerRecord | null): string {
  if (!a || (a.selected === null && !a.typedAnswer)) return "— (unanswered)";
  if (q.format === "typed") return a.typedAnswer ?? "—";
  return a.selected !== null ? q.options?.[a.selected] ?? "—" : "—";
}
export function correctText(q: Question): string {
  return q.format === "typed" ? (q.correctAnswers ?? []).join(" / ") : q.options?.[q.answer ?? -1] ?? "—";
}

function HistoryPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<HistoryEntry[]>([]);
  useEffect(() => setItems(loadHistory()), []);
  const missed = useMemo(() => missedQuestionSet(items), [items]);

  function startMissed() {
    if (!missed.questions.length) return;
    saveActive({ set: missed, startedAt: Date.now(), durationSec: 0, answers: [], currentIndex: 0 });
    void navigate({ to: "/quiz" });
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-display text-xs uppercase tracking-[0.2em] text-hanko">履歴</div>
          <h1 className="mt-2 font-display text-4xl font-semibold">History</h1>
          <p className="mt-1 text-muted-foreground">Every test with its marks. Only wrong answers are kept. Deleting an entry removes it from your stats.</p>
        </div>
        {items.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={missed.questions.length === 0} onClick={startMissed}>
              <Repeat className="mr-2 h-4 w-4" />Practice missed ({missed.questions.length})
            </Button>
            <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground"><Trash2 className="mr-2 h-4 w-4" />Clear history</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all history?</AlertDialogTitle>
                <AlertDialogDescription>All entries are deleted and your dashboard stats are recalculated without them.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-hanko text-paper hover:bg-hanko/90" onClick={() => setItems(removeHistory("all"))}>Clear</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          No tests yet. <Link to="/load" className="text-hanko hover:underline">Load a test</Link> to begin.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map((h) => {
            const p = h.total ? Math.round((h.correct / h.total) * 100) : 0;
            return (
              <Card key={h.id}>
                <Collapsible>
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0 py-4">
                    <CollapsibleTrigger className="group flex min-w-0 flex-1 items-center gap-2 text-left">
                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">{h.title}</CardTitle>
                        <CardDescription>{new Date(h.date).toLocaleString()} · {h.wrong.length} wrong</CardDescription>
                      </div>
                    </CollapsibleTrigger>
                    <Badge className={p >= 70 ? "bg-hanko text-paper hover:bg-hanko" : ""} variant={p >= 70 ? "default" : "secondary"}>{p}%</Badge>
                    <span className="tabular-nums text-sm text-muted-foreground">{h.correct}/{h.total}</span>
                    {h.sourceId && (
                      <Button asChild size="sm" variant="ghost"><Link to="/library/$fileId" params={{ fileId: h.sourceId }}>Analysis</Link></Button>
                    )}
                    <Button size="icon" variant="ghost" aria-label={`Delete history for ${h.title}`}
                      onClick={() => setItems(removeHistory([h.id]))}><Trash2 className="h-4 w-4" /></Button>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="space-y-3 pt-0">
                      {h.wrong.length === 0 ? <p className="text-sm text-muted-foreground">No wrong answers — perfect score.</p> :
                        h.wrong.map((w, i) => (
                          <div key={i} className="rounded-md border p-3 text-sm">
                            <div className="font-medium">{w.question.question}</div>
                            <div className="mt-1 text-destructive">Your answer: {answerText(w.question, w.answer)}</div>
                            <div className="text-hanko">Correct: {correctText(w.question)}</div>
                            {w.question.explanation && <div className="mt-1 text-muted-foreground">{w.question.explanation}</div>}
                          </div>
                        ))}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
