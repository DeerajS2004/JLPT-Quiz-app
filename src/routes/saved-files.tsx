import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArchiveRestore, BarChart3, BookOpen, Check, Download, FileJson, FolderInput, Play, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { deleteFile, listFiles, setFileFolder, sortFiles, type FileSort, type SavedFile } from "@/lib/library-store";
import { importFixDescription, importQuizFile } from "@/lib/quiz-file-import";
import { saveActive, saveStudySets } from "@/lib/quiz-store";
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
  const navigate = useNavigate();
  const [files, setFiles] = useState<SavedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<{ ids: string[]; label: string } | null>(null);
  const [withAttempts, setWithAttempts] = useState(false);
  const [sort, setSort] = useState<FileSort>("newest");
  const [moving, setMoving] = useState<string[] | null>(null);
  const [batchMoving, setBatchMoving] = useState(false);
  const [folderName, setFolderName] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);

  async function download(name: string, blob: Blob, note: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(note);
  }

  async function exportAll() {
    setBusy(true);
    try {
      const { name, blob, summary } = await exportBackup();
      await download(name, blob, `Backup downloaded: ${summary.files} files, ${summary.attempts} attempts, ${summary.history} history entries`);
    } catch { toast.error("Could not create the backup"); }
    finally { setBusy(false); }
  }

  async function exportSelected() {
    setBusy(true);
    try {
      const { name, blob, summary } = await exportBackup(selected);
      await download(name, blob, `Backup downloaded: ${summary.files} files, ${summary.attempts} attempts`);
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
      for (const id of deleting.ids) await deleteFile(id, withAttempts);
      setFiles(await listFiles());
      setSelected((cur) => cur.filter((id) => !deleting.ids.includes(id)));
      toast.success(deleting.ids.length === 1 ? `Deleted ${deleting.label}` : `Deleted ${deleting.ids.length} files`);
      setDeleting(null);
    } catch { toast.error("Could not delete the saved file"); }
    finally { setBusy(false); }
  }

  async function moveFiles(ids: string[]) {
    setBusy(true);
    try {
      for (const id of ids) await setFileFolder(id, folderName);
      setFiles(await listFiles());
      const name = folderName.trim();
      toast.success(name
        ? `Moved ${ids.length === 1 ? "file" : `${ids.length} files`} to folder “${name}”`
        : ids.length === 1 ? "Removed from folder" : `Removed ${ids.length} files from folders`);
      setMoving(null);
      setBatchMoving(false);
      setFolderName("");
    } catch { toast.error("Could not move the file"); }
    finally { setBusy(false); }
  }

  function toggle(id: string, on: boolean) {
    setSelected((cur) => (on ? [...cur, id] : cur.filter((x) => x !== id)));
  }

  function studyFile(file: SavedFile) {
    saveStudySets([{ ...file.set, sourceId: file.id }]);
    void navigate({ to: "/study" });
  }

  function testFile(file: SavedFile) {
    saveActive({ set: { ...file.set, sourceId: file.id }, startedAt: Date.now(), durationSec: 0, answers: [], currentIndex: 0, queue: [] });
    void navigate({ to: "/quiz" });
  }

  const sorted = sortFiles(files, sort);
  const byFolder = new Map<string, SavedFile[]>();
  const loose: SavedFile[] = [];
  for (const file of sorted) {
    if (file.folder) { const group = byFolder.get(file.folder) ?? []; group.push(file); byFolder.set(file.folder, group); }
    else loose.push(file);
  }
  const groups = [...byFolder.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .map(([name, group]) => ({ name, files: group }));
  if (loose.length) groups.push({ name: "", files: loose });
  const allSelected = files.length > 0 && selected.length === files.length;
  const moveForm = (ids: string[]) => (
    <form className="flex items-center gap-1" onSubmit={(event) => { event.preventDefault(); void moveFiles(ids); }}>
      <Input value={folderName} autoFocus placeholder="Folder name (empty = none)" disabled={busy} aria-label={`Folder for ${ids.length === 1 ? files.find((f) => f.id === ids[0])?.title ?? "file" : `${ids.length} selected files`}`}
        onChange={(event) => setFolderName(event.target.value)} className="h-9 w-56" />
      <Button type="submit" size="icon" variant="ghost" disabled={busy} aria-label="Save folder"><Check className="h-4 w-4" /></Button>
      <Button type="button" size="icon" variant="ghost" disabled={busy} aria-label="Cancel move"
        onClick={() => { setMoving(null); setBatchMoving(false); setFolderName(""); }}><X className="h-4 w-4" /></Button>
    </form>
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-display text-xs uppercase tracking-[0.2em] text-hanko">保存したファイル</div>
          <h1 className="mt-2 font-display text-4xl font-semibold">Saved files</h1>
          <p className="mt-1 text-muted-foreground">Your question library on this device.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={sort} onValueChange={(value) => setSort(value as FileSort)}>
            <SelectTrigger className="w-40" aria-label="Sort saved files"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="az">A → Z</SelectItem>
              <SelectItem value="za">Z → A</SelectItem>
            </SelectContent>
          </Select>
          {files.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={allSelected} disabled={busy}
                aria-label={allSelected ? "Clear selection" : "Select all files"}
                onCheckedChange={(v) => setSelected(v === true ? files.map((f) => f.id) : [])} />
              Select all
            </label>
          )}
          <Button asChild variant="outline"><Link to="/load"><BookOpen className="mr-2 h-4 w-4" />Load Test</Link></Button>
          <Button variant="outline" disabled={busy} onClick={() => void exportAll()}><Download className="mr-2 h-4 w-4" />Export backup</Button>
          <Button variant="outline" disabled={busy} onClick={() => zipInput.current?.click()}><ArchiveRestore className="mr-2 h-4 w-4" />Restore backup</Button>
          <Button disabled={busy} onClick={() => input.current?.click()}><Upload className="mr-2 h-4 w-4" />{busy ? "Saving…" : "Upload to save"}</Button>
        </div>
        <input ref={input} type="file" multiple accept="application/json,.json" className="sr-only" aria-label="Upload JSON files to save" disabled={busy}
          onChange={(event) => { const uploads = Array.from(event.target.files ?? []); event.currentTarget.value = ""; if (uploads.length) void upload(uploads); }} />
        <input ref={zipInput} type="file" accept=".zip,application/zip,application/x-zip-compressed" className="sr-only" aria-label="Choose a backup zip to restore" disabled={busy}
          onChange={(event) => { const archive = event.target.files?.[0]; event.currentTarget.value = ""; if (archive) void restore(archive); }} />
      </div>
      {selected.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border bg-paper-soft px-4 py-3">
          <span className="font-display text-sm font-semibold">{selected.length} selected</span>
          {batchMoving ? moveForm(selected) : (
            <>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => { setFolderName(""); setBatchMoving(true); }}>
                <FolderInput className="mr-2 h-4 w-4" />Move to folder
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void exportSelected()}>
                <Download className="mr-2 h-4 w-4" />Export selected
              </Button>
              <Button size="sm" variant="destructive" disabled={busy}
                onClick={() => { setWithAttempts(false); setDeleting({ ids: selected, label: `${selected.length} selected files` }); }}>
                <Trash2 className="mr-2 h-4 w-4" />Delete
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setSelected([]); setBatchMoving(false); }}>Clear</Button>
            </>
          )}
        </div>
      )}
      {loading ? <p className="text-muted-foreground">Loading files…</p> : files.length === 0 ? (
        <div className="border-y py-12 text-center">
          <FileJson className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h2 className="font-display text-xl font-semibold">No saved files yet</h2>
        </div>
      ) : <div className="divide-y border-y">
        {groups.map((group) => (
          <section key={group.name || "__none"}>
            <h2 className={`border-b py-2 font-display text-xs font-semibold uppercase tracking-wider ${group.name ? "" : "text-muted-foreground"}`}>{group.name || "No folder"}</h2>
            <ul className="divide-y">
              {group.files.map((file) => (
                <li key={file.id} className="flex flex-wrap items-center gap-3 py-4">
                  <Checkbox className="shrink-0" checked={selected.includes(file.id)} disabled={busy}
                    aria-label={`Select ${file.title}`} onCheckedChange={(v) => toggle(file.id, v === true)} />
                  <FileJson className="h-5 w-5 shrink-0 text-hanko" />
                  <div className="min-w-0 flex-1 basis-40">
                    <h3 className="break-words font-medium">{file.title}</h3>
                    <p className="text-xs text-muted-foreground">{file.set.questions.length} questions · Saved {new Date(file.savedAt).toLocaleDateString()}</p>
                  </div>
                  {moving?.length === 1 && moving[0] === file.id ? moveForm(moving) : (
                    <>
                      <Button variant="outline" size="sm" onClick={() => testFile(file)}><Play className="mr-2 h-4 w-4" />Test</Button>
                      <Button variant="outline" size="sm" onClick={() => studyFile(file)}><BookOpen className="mr-2 h-4 w-4" />Study</Button>
                      <Button asChild variant="outline" size="sm"><Link to="/library/$fileId" params={{ fileId: file.id }}><BarChart3 className="mr-2 h-4 w-4" />Analysis</Link></Button>
                      <Button variant="ghost" size="icon" disabled={busy} aria-label={`Move ${file.title} to folder`} title="Move to folder"
                        onClick={() => { setFolderName(file.folder ?? ""); setMoving([file.id]); }}><FolderInput className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" disabled={busy} aria-label={`Delete ${file.title}`} title="Delete file"
                        onClick={() => { setWithAttempts(false); setDeleting({ ids: [file.id], label: file.title }); }}><Trash2 className="h-4 w-4" /></Button>
                    </>
                  )}
                </li>))}
            </ul>
          </section>
        ))}
      </div>}
      <AlertDialog open={deleting !== null} onOpenChange={(open) => { if (!open && !busy) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleting && deleting.ids.length > 1 ? `Delete ${deleting.ids.length} selected files?` : "Delete this saved file?"}</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {deleting && deleting.ids.length > 1 ? `these ${deleting.ids.length} files` : `“${deleting?.label}”`} from your library? This cannot be undone. History and dashboard statistics are not changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-start gap-3 text-sm"><Checkbox checked={withAttempts} onCheckedChange={(value) => setWithAttempts(value === true)} disabled={busy} />Also delete the saved attempts and analysis</label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={() => void remove()}>{busy ? "Deleting…" : "Delete"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
