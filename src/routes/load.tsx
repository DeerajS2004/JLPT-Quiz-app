import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { BookOpen, FileJson, Play, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { BUILT_IN_QUIZZES } from "@/lib/built-in-quizzes";
import { saveActive, saveStudySet, validateQuestionSet } from "@/lib/quiz-store";
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
  const [set, setSet] = useState<QuestionSet | null>(null);
  const [duration, setDuration] = useState(15);
  const inputRef = useRef<HTMLInputElement>(null);

  function useSet(questionSet: QuestionSet) {
    setSet(questionSet);
    saveStudySet(questionSet);
  }

  async function onFile(file: File) {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const validated = validateQuestionSet(parsed);
      if (!validated.ok) {
        toast.error("Invalid question file", { description: validated.error });
        return;
      }
      useSet(validated.set);
      toast.success("Question set loaded", { description: `${validated.set.title} · ${validated.set.questions.length} questions` });
    } catch (error) {
      toast.error("Could not read the JSON file", { description: error instanceof Error ? error.message : String(error) });
    }
  }

  async function loadBuiltIn(url: string) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("The bundled question set could not be loaded.");
      const validated = validateQuestionSet(await response.json());
      if (!validated.ok) {
        toast.error("Invalid built-in question set", { description: validated.error });
        return;
      }
      useSet(validated.set);
    } catch (error) {
      toast.error("Failed to load question set", { description: error instanceof Error ? error.message : String(error) });
    }
  }

  function start() {
    if (!set) return;
    saveActive({ set, startedAt: Date.now(), durationSec: duration * 60, answers: [], currentIndex: 0 });
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
              accept="application/json,.json"
              className="sr-only"
              aria-label="Choose a JSON question file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onFile(file);
                event.currentTarget.value = "";
              }}
            />
            <Button variant="outline" className="h-28 w-full flex-col gap-3" onClick={() => inputRef.current?.click()}>
              <Upload className="h-6 w-6" />
              <span>Choose a .json question file</span>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Bundled question sets</CardTitle>
            <CardDescription>Included with the app and available offline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {BUILT_IN_QUIZZES.map((quiz) => (
              <Button key={quiz.id} variant="outline" className="h-auto w-full justify-start gap-3 p-3 text-left" onClick={() => void loadBuiltIn(quiz.url)}>
                <FileJson className="h-4 w-4 shrink-0 text-hanko" />
                <span className="min-w-0 whitespace-normal">
                  <span className="block font-medium">{quiz.title}</span>
                  <span className="block text-xs font-normal text-muted-foreground">{quiz.description}</span>
                </span>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      {set && (
        <Card className="mt-8 border-hanko/30">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="font-display text-2xl">{set.title}</CardTitle>
                <CardDescription>{set.description ?? "Ready for practice or study."}</CardDescription>
              </div>
              <Badge className="bg-hanko text-paper hover:bg-hanko">{set.questions.length} questions</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="duration" className="text-xs uppercase tracking-wider text-muted-foreground">Test time limit</Label>
              <div className="mt-3 flex items-center gap-4">
                <Slider id="duration" min={1} max={60} step={1} value={[duration]} onValueChange={(value) => setDuration(value[0] ?? 15)} />
                <div className="w-16 text-right font-display text-lg tabular-nums">{duration}m</div>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="outline" onClick={() => void navigate({ to: "/study" })}>
                <BookOpen className="mr-2 h-4 w-4" /> Study set
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