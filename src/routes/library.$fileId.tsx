import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  computeFileAnalysis, deleteAttempt, getFile, listAttempts, type Attempt, type SavedFile,
} from "@/lib/library-store";
import { answerText, correctText } from "./history";

export const Route = createFileRoute("/library/$fileId")({
  head: () => ({
    meta: [
      { title: "File Analysis — JLPT Practice" },
      { name: "description", content: "Attempts, marks and per-question analysis for a saved JLPT question file." },
      { property: "og:title", content: "JLPT File Analysis" },
      { property: "og:description", content: "Per-question accuracy and every attempt for a saved quiz file." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FileAnalysisPage,
});

const pct = (c: number, t: number) => (t ? Math.round((c / t) * 100) : 0);

function FileAnalysisPage() {
  const { fileId } = Route.useParams();
  const [file, setFile] = useState<SavedFile | null | undefined>(undefined);
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  useEffect(() => {
    void getFile(fileId).then((f) => setFile(f ?? null)).catch(() => setFile(null));
    void listAttempts(fileId).then(setAttempts).catch(() => {});
  }, [fileId]);

  const a = computeFileAnalysis(attempts);
  const title = file?.title ?? fileId;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <div className="font-display text-xs uppercase tracking-[0.2em] text-hanko">分析</div>
        <h1 className="mt-2 font-display text-4xl font-semibold">{file === undefined ? "Loading…" : title}</h1>
        <p className="mt-1 text-muted-foreground">
          {file === null ? "This file was deleted; saved attempts are still shown." : `${file?.set.questions.length ?? 0} questions in file.`}{" "}
          <Link to="/load" className="text-hanko hover:underline">Back to files</Link>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[["Attempts", `${a.attempts}`], ["Best", `${a.best}%`], ["Latest", `${a.latest}%`], ["Average", `${a.average}%`]].map(([l, v]) => (
          <Card key={l}><CardContent className="p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{l}</div>
            <div className="mt-2 font-display text-3xl font-semibold tabular-nums">{v}</div>
          </CardContent></Card>
        ))}
      </div>

      {attempts.length > 1 && (
        <Card className="mt-6">
          <CardHeader><CardTitle className="font-display">Trend</CardTitle><CardDescription>Oldest to newest</CardDescription></CardHeader>
          <CardContent className="flex h-32 items-end gap-1">
            {[...attempts].reverse().map((t) => (
              <div key={t.id} title={`${pct(t.correct, t.total)}%`} className="flex-1 rounded-t bg-hanko/70"
                style={{ height: `${Math.max(4, pct(t.correct, t.total))}%` }} />
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader><CardTitle className="font-display">Questions</CardTitle><CardDescription>Hardest first</CardDescription></CardHeader>
        <CardContent>
          {a.questions.length === 0 ? <p className="text-sm text-muted-foreground">Take a test with this file to see analysis.</p> : (
            <ul className="space-y-3">
              {a.questions.map((q) => (
                <li key={q.key} className="text-sm">
                  <div className="mb-1 flex justify-between gap-3">
                    <span className="min-w-0 truncate font-medium">{q.question.question}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{q.accuracy}% · ✓{q.right} ✗{q.wrong} / {q.seen}</span>
                  </div>
                  <Progress value={q.accuracy} className="h-1.5" />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <h2 className="mt-8 mb-3 font-display text-2xl font-semibold">Attempts</h2>
      <div className="space-y-3">
        {attempts.map((t) => (
          <Card key={t.id}>
            <Collapsible>
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 py-4">
                <CollapsibleTrigger className="min-w-0 flex-1 text-left">
                  <CardTitle className="text-base">{new Date(t.date).toLocaleString()}</CardTitle>
                  <CardDescription>Tap to see right and wrong answers</CardDescription>
                </CollapsibleTrigger>
                <Badge variant="secondary">{pct(t.correct, t.total)}%</Badge>
                <span className="tabular-nums text-sm text-muted-foreground">{t.correct}/{t.total}</span>
                <Button size="icon" variant="ghost" aria-label="Delete attempt" onClick={() =>
                  void deleteAttempt(t.id).then(() => setAttempts((x) => x.filter((y) => y.id !== t.id)))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-2 pt-0">
                  {t.questions.map((q, i) => {
                    const ans = t.answers[i] ?? null;
                    return (
                      <div key={i} className={`rounded-md border p-3 text-sm ${ans?.correct ? "border-hanko/30" : "border-destructive/40"}`}>
                        <div className="font-medium">{ans?.correct ? "✓" : "✗"} {q.question}</div>
                        <div className="text-muted-foreground">Your answer: {answerText(q, ans)}</div>
                        {!ans?.correct && <div className="text-hanko">Correct: {correctText(q)}</div>}
                      </div>
                    );
                  })}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>
    </div>
  );
}
