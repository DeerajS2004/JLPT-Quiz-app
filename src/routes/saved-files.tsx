import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArchiveRestore, BarChart3, BookOpen, Download, FileJson, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { deleteFile, listFiles, type SavedFile } from "@/lib/library-store";
import { importFixDescription, importQuizFile } from "@/lib/quiz-file-import";
import { exportBackup, restoreBackup } from "@/lib/backup";

export const Route = createFileRoute("/saved-files")({
  head: () => ({ meta: [
    { title: "Saved Files — JLPT Practice" },
    { name: "description", content: "Save local JLPT JSON files for later and review each file's attempts and question analysis." },
    { property: "og:title", content: "Saved Files — JLPT Practice" },
    { property: "og:description", content: "Your offline question library, saved attempts, and question analysis." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: SavedFiles,
});

function SavedFiles() {
  const [files, setFiles] = useState<SavedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<SavedFile | null>(null);
  const [withAttempts, setWithAttempts] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);

  async function exportAll() {
    setBusy(true);
    try {
      const { name, blob, summary } = await exportBackup();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(`Backup downloaded: ${summary.files} files, ${summary.attempts} attempts, ${summary.history} history entries`);
    } catch { toast.error("Could not create the backup"); }
    finally { setBusy(false); }
  }

  async function restore(archive: File) {
    setBusy(true);
    try {
      const summary = await restoreBackup(archive);
      setFiles(await listFiles());
      toast.success(`Restored ${summary.files} files, ${summary.attempts} attempts, ${summary.history} history entries (existing entries were kept)`);
    } catch (error) {
      toast.error("Could not restore the backup", { description: error instanceof Error ? error.message : String(error) });
    }
    finally { setBusy(false); }
  }

  useEffect(() => {
    void listFiles().then(setFiles).catch(() => toast.error("Could not load saved files"))
      .finally(() => setLoading(false));
  }, []);

  async function upload(uploads: File[]) {
    setBusy(true);
    let count = 0;
    for (const file of uploads) {
      try {
        const result = await importQuizFile(file);
        count++;
        if (result.total > 0) toast.info(`Imported with ${result.total} automatic fixes (${importFixDescription(result)})`, { description: file.name, duration: 8000 });
      } catch (error) {
        toast.error(`Could not save ${file.name}`, { description: error instanceof Error ? error.message : String(error) });
      }
    }
    try { setFiles(await listFiles()); } catch { toast.error("Could not refresh saved files"); }
    setBusy(false);
    if (count) toast.success(`${count} file${count === 1 ? "" : "s"} saved`);
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteFile(deleting.id, withAttempts);
      setFiles(await listFiles());
      toast.success(`Deleted ${deleting.title}`);
      setDeleting(null);
    } catch { toast.error("Could not delete the saved file"); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-display text-xs uppercase tracking-[0.2em] text-hanko">保存したファイル</div>
          <h1 className="mt-2 font-display text-4xl font-semibold">Saved files</h1>
          <p className="mt-1 text-muted-foreground">Your question library on this device.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link to="/load"><BookOpen className="mr-2 h-4 w-4" />Load Test</Link></Button>
          <Button disabled={busy} onClick={() => input.current?.click()}><Upload className="mr-2 h-4 w-4" />{busy ? "Saving…" : "Upload to save"}</Button>
        </div>
        <input ref={input} type="file" multiple accept="application/json,.json" className="sr-only" aria-label="Upload JSON files to save" disabled={busy}
          onChange={(event) => { const uploads = Array.from(event.target.files ?? []); event.currentTarget.value = ""; if (uploads.length) void upload(uploads); }} />
      </div>
      {loading ? <p className="text-muted-foreground">Loading files…</p> : files.length === 0 ? (
        <div className="border-y py-12 text-center">
          <FileJson className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h2 className="font-display text-xl font-semibold">No saved files yet</h2>
        </div>
      ) : <ul className="divide-y border-y">
        {files.map((file) => <li key={file.id} className="flex flex-wrap items-center gap-3 py-4">
          <FileJson className="h-5 w-5 shrink-0 text-hanko" />
          <div className="min-w-0 flex-1 basis-40">
            <h2 className="break-words font-medium">{file.title}</h2>
            <p className="text-xs text-muted-foreground">{file.set.questions.length} questions · Saved {new Date(file.savedAt).toLocaleDateString()}</p>
          </div>
          <Button asChild variant="outline" size="sm"><Link to="/library/$fileId" params={{ fileId: file.id }}><BarChart3 className="mr-2 h-4 w-4" />Analysis</Link></Button>
          <Button variant="ghost" size="icon" disabled={busy} aria-label={`Delete ${file.title}`} title="Delete file"
            onClick={() => { setWithAttempts(false); setDeleting(file); }}><Trash2 className="h-4 w-4" /></Button>
        </li>)}
      </ul>}
      <AlertDialog open={deleting !== null} onOpenChange={(open) => { if (!open && !busy) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this saved file?</AlertDialogTitle>
            <AlertDialogDescription>Remove “{deleting?.title}” from your library? This cannot be undone. History and dashboard statistics are not changed.</AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-start gap-3 text-sm"><Checkbox checked={withAttempts} onCheckedChange={(value) => setWithAttempts(value === true)} disabled={busy} />Also delete this file’s saved attempts and analysis</label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={() => void remove()}>{busy ? "Deleting…" : "Delete file"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}