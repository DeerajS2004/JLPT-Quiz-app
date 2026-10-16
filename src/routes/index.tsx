import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, Flame, Target, History, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  emptyStats,
  loadSessions,
  loadStats,
  removeSession,
  resetAllData,
} from "@/lib/quiz-store";
import type { SessionResult, Statistics } from "@/lib/quiz-types";
import { QUESTION_TYPES, TYPE_LABELS } from "@/lib/quiz-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — JLPT Practice" },
      { name: "description", content: "Your JLPT practice dashboard: streak, lifetime accuracy, and recent sessions." },
      { property: "og:title", content: "JLPT Practice Dashboard" },
      { property: "og:description", content: "Review your saved JLPT test results and lifetime practice statistics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function pct(num: number, den: number) {
  if (!den) return 0;
  return Math.round((num / den) * 100);
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function Dashboard() {
  const [stats, setStats] = useState<Statistics>(emptyStats());
  const [sessions, setSessions] = useState<SessionResult[]>([]);

  useEffect(() => {
    setStats(loadStats());
    setSessions(loadSessions());
  }, []);

  const accuracy = pct(stats.totalCorrect, stats.totalQuestions);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-display text-xs uppercase tracking-[0.2em] text-hanko">日本語</div>
          <h1 className="mt-2 font-display text-4xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Track your JLPT progress. Load a test to begin a new session.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/load">
              <BookOpen className="mr-2 h-4 w-4" /> Load Test
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Lifetime accuracy" value={`${accuracy}%`} sub={`${stats.totalCorrect} / ${stats.totalQuestions}`} icon={<Target className="h-4 w-4" />} />
        <StatCard label="Sessions completed" value={`${stats.sessionsCompleted}`} sub="all-time" icon={<History className="h-4 w-4" />} />
        <StatCard label="Daily streak" value={`${stats.streak}`} sub={stats.lastSessionDate ? `last: ${stats.lastSessionDate}` : "no sessions yet"} icon={<Flame className="h-4 w-4" />} accent />
        <StatCard label="Questions answered" value={`${stats.totalQuestions}`} sub="across all sets" icon={<BookOpen className="h-4 w-4" />} />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display">By category</CardTitle>
            <CardDescription>Accuracy per JLPT question type</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {QUESTION_TYPES.map((t) => {
              const c = stats.byCategory[t];
              const p = pct(c.correct, c.total);
              return (
                <div key={t}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium">{TYPE_LABELS[t]}</span>
                    <span className="text-muted-foreground">
                      {c.total === 0 ? "—" : `${p}%  ·  ${c.correct}/${c.total}`}
                    </span>
                  </div>
                  <Progress value={p} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Saved test results</CardTitle>
            <CardDescription>Full reviews for up to five tests. Removing one does not change lifetime statistics.</CardDescription>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No sessions yet. <Link to="/load" className="text-hanko underline-offset-4 hover:underline">Load a test</Link> to begin.
              </p>
            ) : (
              <ul className="divide-y">
                {sessions.map((s) => {
                  const p = pct(s.correct, s.total);
                  return (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <Link to="/results" search={{ id: s.id }} className="min-w-0 flex-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <div className="truncate font-medium hover:text-hanko">{s.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(s.date).toLocaleString()} · {formatDuration(s.durationSec)}
                        </div>
                      </Link>
                      <div className="flex shrink-0 items-center gap-3">
                        <Badge variant={p >= 70 ? "default" : "secondary"} className={p >= 70 ? "bg-hanko text-paper hover:bg-hanko" : ""}>
                          {p}%
                        </Badge>
                        <span className="tabular-nums text-muted-foreground">{s.correct}/{s.total}</span>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button type="button" variant="ghost" size="icon" aria-label={`Delete saved result for ${s.title}`} title="Delete saved result">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this saved result?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This removes the detailed review for “{s.title}”. Your lifetime totals and category statistics will stay unchanged.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep result</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-hanko text-paper hover:bg-hanko/90"
                                onClick={() => { setSessions(removeSession(s.id)); setStats(loadStats()); }}
                              >
                                Delete result
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {(stats.sessionsCompleted > 0 || sessions.length > 0) && (
        <div className="mt-10 flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <Trash2 className="mr-2 h-4 w-4" /> Reset all progress
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete all stats and sessions?</AlertDialogTitle>
                <AlertDialogDescription>
                  This clears your lifetime stats, streak, category data, session history, and last result. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-hanko text-paper hover:bg-hanko/90"
                  onClick={() => {
                    resetAllData();
                    setStats(emptyStats());
                    setSessions([]);
                  }}
                >
                  Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? "border-hanko/30" : ""}>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
          <span>{label}</span>
          <span className={accent ? "text-hanko" : ""}>{icon}</span>
        </div>
        <div className={`font-display text-3xl font-semibold tabular-nums ${accent ? "text-hanko" : ""}`}>{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}
