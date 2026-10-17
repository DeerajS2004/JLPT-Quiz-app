import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { BookOpen, ChevronDown, Play, Upload, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { fetchManifest, groupByLesson, pickQuestions, type ManifestEntry } from "@/lib/built-in-quizzes";
import { normalizeQuizJson, saveActive, saveStudySets, validateQuestionSet } from "@/lib/quiz-store";
import type { QuestionSet } from "@/lib/quiz-types";

export const Route = createFileRoute("/load")({
  head: () => ({
    meta: [
      { title: "Choose a Question Set — JLPT Practice" },
      { name: "description", content: "Load a local JLPT question set for offline testing or study." },
      { property: "og:title", content: "Choose a JLPT Question Set" },
      { property: "og:description", content: "Load a local JLPT question set for offline testing or study." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoadTest,
});

function LoadTest() {
  const navigate = useNavigate();
  const [uploaded, setUploaded] = useState<QuestionSet[]>([]);
  const [duration, setDuration] = useState(15);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: File[]) {
    const ok: QuestionSet[] = [];
    for (const file of files) {
      try {
        const normalized = normalizeQuizJson(JSON.parse(await file.text()) as unknown);
        const validated = validateQuestionSet(normalized.json);
        if (!validated.ok) {
          toast.error(`Invalid question file: ${file.name}`, { description: validated.error });
          continue;
        }
        ok.push(validated.set);
        if (normalized.total > 0) {
          const details = Object.entries(normalized.fixes).filter(([, count]) => count > 0)
            .map(([kind, count]) => `${kind}: ${count}`).join(", ");
          toast.info(`Imported with ${normalized.total} automatic fixes (${details})`, { description: file.name, duration: 8000 });
        }
      } catch (error) {
        toast.error(`Could not read ${file.name}`, { description: error instanceof Error ? error.message : String(error) });
      }
    }
    if (ok.length) {
      setUploaded((u) => [...u, ...ok]);
      toast.success(`${ok.length} question set${ok.length > 1 ? "s" : ""} loaded`);
    }
  }

  const [manifest, setManifest] = useState<ManifestEntry[]>([]);
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [loaded, setLoaded] = useState<Record<string, QuestionSet>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [size, setSize] = useState<number | null>(null);

  useEffect(() => {
    void fetchManifest().then((entries) => {
      setManifest(entries);
      for (const e of entries) {
        fetch(e.url)
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then((json: unknown) => {
            const v = validateQuestionSet(normalizeQuizJson(json).json);
            if (v.ok) {
              setLoaded((m) => ({ ...m, [e.id]: v.set }));
              setCounts((c) => ({ ...c, [e.id]: v.set.questions.length }));
            } else setCounts((c) => ({ ...c, [e.id]: null }));
          })
          .catch(() => setCounts((c) => ({ ...c, [e.id]: null })));
      }
    });
  }, []);

  function toggle(id: string, on: boolean) {
    setSelected((cur) => (on ? [...cur, id] : cur.filter((x) => x !== id)));
  }

  const sets: QuestionSet[] = [...selected.flatMap((x) => (loaded[x] ? [loaded[x]] : [])), ...uploaded];
  const totalQuestions = sets.reduce((n, s) => n + s.questions.length, 0);

  useEffect(() => {
    if (sets.length) saveStudySets(sets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, uploaded, loaded]);

  function start() {
    if (!sets.length) return;
    const [first, ...rest] = sets.map((s) => pickQuestions(s, size));
    saveActive({ set: first, startedAt: Date.now(), durationSec: duration * 60, answers: [], currentIndex: 0, queue: rest });
    void navigate({ to: "/quiz" });
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8">
        <div className="font-display text-xs uppercase tracking-[0.2em] text-hanko">テスト / 学習</div>
        <h1 className="mt-2 font-display text-4xl font-semibold">Question sets</h1>
        <p className="mt-1 text-muted-foreground">Choose a bundled set or load a JSON file from your device.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-dashed transition-colors hover:border-hanko/50">
          <CardHeader>
            <CardTitle className="font-display">Load a JSON file</CardTitle>
            <CardDescription>Your question set stays on this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="application/json,.json"
              className="sr-only"
              aria-label="Choose a JSON question file"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length) void onFiles(files);
                event.currentTarget.value = "";
              }}
            />
            <Button variant="outline" className="h-28 w-full flex-col gap-3" onClick={() => inputRef.current?.click()}>
              <Upload className="h-6 w-6" />
              <span>Choose one or more .json files</span>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Bundled question sets</CardTitle>
            <CardDescription>Included with the app and available offline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {groupByLesson(manifest).map(([lesson, entries], gi) => (
              <Collapsible key={lesson} defaultOpen={gi === 0} className="rounded-md border">
                <CollapsibleTrigger className="group flex w-full items-center justify-between px-3 py-2 font-display text-sm font-semibold">
                  Lesson {lesson}
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 px-3 pb-3">
                  {entries.map((quiz) => {
                    const count = counts[quiz.id];
                    return (
                      <label key={quiz.id} className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-secondary/60">
                        <Checkbox
                          className="mt-0.5"
                          disabled={count === null || count === undefined}
                          checked={selected.includes(quiz.id)}
                          onCheckedChange={(v) => toggle(quiz.id, v === true)}
                        />
                        <span className="min-w-0">
                          <span className="block font-medium">{quiz.title}</span>
                          <span className="mt-1 flex flex-wrap gap-1">
                            <Badge variant="outline" className="text-[11px] capitalize">{quiz.type}</Badge>
                            <Badge variant="secondary" className="text-[11px]">
                              {count === undefined ? "Loading…" : count === null ? "Unavailable" : `${count} questions`}
                            </Badge>
                          </span>
                          {quiz.description && <span className="mt-1 block text-xs text-muted-foreground">{quiz.description}</span>}
                        </span>
                      </label>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </CardContent>
        </Card>
      </div>

      {sets.length > 0 && (
        <Card className="mt-8 border-hanko/30">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="font-display text-2xl">
                  {sets.length === 1 ? sets[0].title : `${sets.length} sets, one after another`}
                </CardTitle>
                <CardDescription>Tests and study run through each set in this order.</CardDescription>
              </div>
              <Badge className="bg-hanko text-paper hover:bg-hanko">{totalQuestions} questions</Badge>
            </div>
            <ol className="mt-3 space-y-1 text-sm">
              {sets.map((s, i) => {
                const upIdx = i - (sets.length - uploaded.length);
                return (
                  <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-secondary/50 px-3 py-1.5">
                    <span className="min-w-0 truncate">{i + 1}. {s.title} <span className="text-muted-foreground">· {s.questions.length}</span></span>
                    {upIdx >= 0 && (
                      <Button size="icon" variant="ghost" className="h-6 w-6" aria-label={`Remove ${s.title}`}
                        onClick={() => setUploaded((u) => u.filter((_, j) => j !== upIdx))}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ol>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="duration" className="text-xs uppercase tracking-wider text-muted-foreground">Time limit per set</Label>
              <div className="mt-3 flex items-center gap-4">
                <Slider id="duration" min={1} max={60} step={1} value={[duration]} onValueChange={(value) => setDuration(value[0] ?? 15)} />
                <div className="w-16 text-right font-display text-lg tabular-nums">{duration}m</div>
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Questions per set</Label>
              <div className="mt-3 flex flex-wrap gap-2">
                {[10, 20, 50, null].map((n) => (
                  <Button key={String(n)} type="button" size="sm" variant={size === n ? "default" : "outline"} onClick={() => setSize(n)}>
                    {n ?? "All"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="outline" onClick={() => void navigate({ to: "/study" })}>
                <BookOpen className="mr-2 h-4 w-4" /> Study sets
              </Button>
              <Button onClick={start} className="bg-hanko text-paper hover:bg-hanko/90">
                <Play className="mr-2 h-4 w-4" /> Start test
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}