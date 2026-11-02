import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp, ArchiveRestore, BarChart3, BookOpen, Download, FileJson, Folder, FolderInput,
  FolderPlus, LayoutGrid, List, Play, Trash2, Upload, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  addFolder, deleteFile, listFiles, listFolders, removeFolder, setFileFolder, sortFiles,
  type FileSort, type SavedFile,
} from "@/lib/library-store";
import { childFolders, joinPath, normalizePath, parentPath, pathName } from "@/lib/folders";
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
  const [storedFolders, setStoredFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<{ ids: string[]; label: string } | null>(null);
  const [withAttempts, setWithAttempts] = useState(false);
  const [sort, setSort] = useState<FileSort>("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [path, setPath] = useState("");
  const [moving, setMoving] = useState<string[] | null>(null);
  const [moveValue, setMoveValue] = useState("");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);

  /** Folder paths from files plus empty folders created on purpose. */
  const knownFolders = useMemo(() => {
    const set = new Set<string>();
    for (const f of storedFolders) set.add(f);
    for (const f of files) { const p = normalizePath(f.folder ?? ""); if (p) set.add(p); }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [files, storedFolders]);

  const subFolders = useMemo(() => childFolders(knownFolders, path), [knownFolders, path]);
  const filesHere = useMemo(
    () => sortFiles(files.filter((f) => normalizePath(f.folder ?? "") === path), sort),
    [files, path, sort],
  );
  const itemsIn = (folder: string) =>
    files.filter((f) => normalizePath(f.folder ?? "") === folder).length + childFolders(knownFolders, folder).length;

  async function refresh() {
    try {
      setFiles(await listFiles());
      setStoredFolders(listFolders());
    } catch { toast.error("Could not refresh saved files"); }
  }

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
      await download(name, blob, `Backup downloaded: ${summary.files} files, ${summary.attempts} attempts, ${summary.history} history entries, ${summary.folders} folders`);
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
      await refresh();
      toast.success(`Restored ${summary.files} files, ${summary.attempts} attempts, ${summary.history} history entries${summary.folders ? `, ${summary.folders} folders` : ""} (existing entries were kept)`);
    } catch (error) {
      toast.error("Could not restore the backup", { description: error instanceof Error ? error.message : String(error) });
    }
    finally { setBusy(false); }
  }

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
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
    await refresh();
    setBusy(false);
    if (count) toast.success(`${count} file${count === 1 ? "" : "s"} saved`);
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      for (const id of deleting.ids) await deleteFile(id, withAttempts);
      await refresh();
      setSelected((cur) => cur.filter((id) => !deleting.ids.includes(id)));
      toast.success(deleting.ids.length === 1 ? `Deleted ${deleting.label}` : `Deleted ${deleting.ids.length} files`);
      setDeleting(null);
    } catch { toast.error("Could not delete the saved file"); }
    finally { setBusy(false); }
  }

  async function moveFiles(ids: string[]) {
    setBusy(true);
    try {
      const dest = normalizePath(moveValue);
      for (const id of ids) await setFileFolder(id, dest);
      await refresh();
      toast.success(dest
        ? `Moved ${ids.length === 1 ? "file" : `${ids.length} files`} to “${dest}”`
        : ids.length === 1 ? "Moved to the Saved Files root" : `Moved ${ids.length} files to the root`);
      setMoving(null);
      setMoveValue("");
    } catch { toast.error("Could not move the file"); }
    finally { setBusy(false); }
  }

  async function createFolder() {
    const target = joinPath(path, newFolderName);
    if (!target) { toast.error("Give the folder a name"); return; }
    setBusy(true);
    try {
      setStoredFolders(await addFolder(target));
      toast.success(`Folder “${target}” created`);
      setNewFolderOpen(false);
      setNewFolderName("");
    } catch { toast.error("Could not create the folder"); }
    finally { setBusy(false); }
  }

  async function dropEmptyFolder(folder: string) {
    try {
      setStoredFolders(await removeFolder(folder));
      toast.success(`Removed empty folder “${pathName(folder)}”`);
    } catch { toast.error("Could not remove the folder"); }
  }

  function toggle(id: string, on: boolean) {
    setSelected((cur) => (on ? [...cur, id] : cur.filter((x) => x !== id)));
  }

  function openFolder(folder: string) {
    setPath(folder);
    setSelected([]);
  }

  function studyFile(file: SavedFile) {
    saveStudySets([{ ...file.set, sourceId: file.id }]);
    void navigate({ to: "/study" });
  }

  function testFile(file: SavedFile) {
    saveActive({ set: { ...file.set, sourceId: file.id }, startedAt: Date.now(), durationSec: 0, answers: [], currentIndex: 0, queue: [] });
    void navigate({ to: "/quiz" });
  }

  const allSelected = filesHere.length > 0 && filesHere.every((f) => selected.includes(f.id));
  const crumbs = path ? path.split("/") : [];

  const folderCard = (folder: string) => {
    const items = itemsIn(folder);
    return (
      <Card key={folder} role="button" tabIndex={0} aria-label={`Open folder ${pathName(folder)}`}
        className="relative cursor-pointer p-4 transition hover:border-hanko/40 hover:bg-paper-soft"
        onClick={() => openFolder(folder)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFolder(folder); } }}>
        {items === 0 && (
          <Button className="absolute right-1 top-1 h-7 w-7" size="icon" variant="ghost" disabled={busy}
            aria-label={`Remove empty folder ${pathName(folder)}`} title="Remove folder"
            onClick={(e) => { e.stopPropagation(); void dropEmptyFolder(folder); }}><X className="h-4 w-4" /></Button>
        )}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <Folder className="h-10 w-10 fill-hanko-soft text-hanko" />
          <h3 className="break-words text-sm font-medium">{pathName(folder)}</h3>
          <p className="text-xs text-muted-foreground">{items} item{items === 1 ? "" : "s"}</p>
        </div>
      </Card>
    );
  };

  const fileActions = (file: SavedFile) => (
    <>
      <Button size="icon" variant="ghost" aria-label={`Test ${file.title}`} title="Test" onClick={() => testFile(file)}><Play className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" aria-label={`Study ${file.title}`} title="Study" onClick={() => studyFile(file)}><BookOpen className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" asChild aria-label={`Analysis for ${file.title}`} title="Analysis">
        <Link to="/library/$fileId" params={{ fileId: file.id }}><BarChart3 className="h-4 w-4" /></Link>
      </Button>
      <Button size="icon" variant="ghost" disabled={busy} aria-label={`Move ${file.title} to folder`} title="Move to folder"
        onClick={() => { setMoveValue(file.folder ?? ""); setMoving([file.id]); }}><FolderInput className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" disabled={busy} aria-label={`Delete ${file.title}`} title="Delete file"
        onClick={() => { setWithAttempts(false); setDeleting({ ids: [file.id], label: file.title }); }}><Trash2 className="h-4 w-4" /></Button>
    </>
  );

  const gridFileCard = (file: SavedFile) => (
    <Card key={file.id} className="relative p-4">
      <div className="absolute left-3 top-3">
        <Checkbox checked={selected.includes(file.id)} disabled={busy} aria-label={`Select ${file.title}`}
          onCheckedChange={(v) => toggle(file.id, v === true)} />
      </div>
      <div className="flex flex-col items-center gap-1.5 pt-5 text-center">
        <FileJson className="h-8 w-8 shrink-0 text-hanko" />
        <h3 className="line-clamp-2 break-words text-sm font-medium">{file.title}</h3>
        <p className="text-xs text-muted-foreground">{file.set.questions.length} questions · Saved {new Date(file.savedAt).toLocaleDateString()}</p>
      </div>
      <div className="mt-3 flex items-center justify-center gap-0.5">{fileActions(file)}</div>
    </Card>
  );

  const listRow = (file: SavedFile) => (
    <li key={file.id} className="flex flex-wrap items-center gap-3 py-4">
      <Checkbox className="shrink-0" checked={selected.includes(file.id)} disabled={busy}
        aria-label={`Select ${file.title}`} onCheckedChange={(v) => toggle(file.id, v === true)} />
      <FileJson className="h-5 w-5 shrink-0 text-hanko" />
      <div className="min-w-0 flex-1 basis-40">
        <h3 className="break-words font-medium">{file.title}</h3>
        <p className="text-xs text-muted-foreground">{file.set.questions.length} questions · Saved {new Date(file.savedAt).toLocaleDateString()}</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => testFile(file)}><Play className="mr-2 h-4 w-4" />Test</Button>
      <Button variant="outline" size="sm" onClick={() => studyFile(file)}><BookOpen className="mr-2 h-4 w-4" />Study</Button>
      <Button asChild variant="outline" size="sm"><Link to="/library/$fileId" params={{ fileId: file.id }}><BarChart3 className="mr-2 h-4 w-4" />Analysis</Link></Button>
      <Button size="icon" variant="ghost" disabled={busy} aria-label={`Move ${file.title} to folder`} title="Move to folder"
        onClick={() => { setMoveValue(file.folder ?? ""); setMoving([file.id]); }}><FolderInput className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" disabled={busy} aria-label={`Delete ${file.title}`} title="Delete file"
        onClick={() => { setWithAttempts(false); setDeleting({ ids: [file.id], label: file.title }); }}><Trash2 className="h-4 w-4" /></Button>
    </li>
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-display text-xs uppercase tracking-[0.2em] text-hanko">保存したファイル</div>
          <h1 className="mt-2 font-display text-4xl font-semibold">Saved files</h1>
          <p className="mt-1 text-muted-foreground">Your question library on this device.</p>
        </div>
        <div className="flex flex-wrap gap-2">
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" disabled={!path || busy} aria-label="Up one level" title="Up one level"
          onClick={() => openFolder(parentPath(path))}><ArrowUp className="h-4 w-4" /></Button>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              {path ? (
                <BreadcrumbLink asChild><button type="button" className="cursor-pointer" onClick={() => openFolder("")}>Saved Files</button></BreadcrumbLink>
              ) : <BreadcrumbPage>Saved Files</BreadcrumbPage>}
            </BreadcrumbItem>
            {crumbs.map((seg, i) => {
              const target = crumbs.slice(0, i + 1).join("/");
              const last = i === crumbs.length - 1;
              return (
                <Fragment key={target}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {last ? <BreadcrumbPage>{seg}</BreadcrumbPage> : (
                      <BreadcrumbLink asChild><button type="button" className="cursor-pointer" onClick={() => openFolder(target)}>{seg}</button></BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={sort} onValueChange={(value) => setSort(value as FileSort)}>
          <SelectTrigger className="w-40" aria-label="Sort saved files"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="az">A → Z</SelectItem>
            <SelectItem value="za">Z → A</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex overflow-hidden rounded-md border" role="group" aria-label="View">
          <Button variant="ghost" size="icon" className="rounded-none" aria-pressed={view === "grid"} aria-label="Grid view"
            onClick={() => setView("grid")}><LayoutGrid className={`h-4 w-4 ${view === "grid" ? "text-hanko" : ""}`} /></Button>
          <Button variant="ghost" size="icon" className="rounded-none" aria-pressed={view === "list"} aria-label="List view"
            onClick={() => setView("list")}><List className={`h-4 w-4 ${view === "list" ? "text-hanko" : ""}`} /></Button>
        </div>
        {filesHere.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={allSelected} disabled={busy}
              aria-label={allSelected ? "Clear selection" : "Select all files here"}
              onCheckedChange={(v) => setSelected(v === true ? filesHere.map((f) => f.id) : [])} />
            Select all
          </label>
        )}
        <Button variant="outline" disabled={busy} onClick={() => { setNewFolderName(""); setNewFolderOpen(true); }}>
          <FolderPlus className="mr-2 h-4 w-4" />New folder
        </Button>
      </div>

      {selected.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border bg-paper-soft px-4 py-3">
          <span className="font-display text-sm font-semibold">{selected.length} selected</span>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => { setMoveValue(path); setMoving(selected); }}>
            <FolderInput className="mr-2 h-4 w-4" />Move to folder
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void exportSelected()}>
            <Download className="mr-2 h-4 w-4" />Export selected
          </Button>
          <Button size="sm" variant="destructive" disabled={busy}
            onClick={() => { setWithAttempts(false); setDeleting({ ids: selected, label: `${selected.length} selected files` }); }}>
            <Trash2 className="mr-2 h-4 w-4" />Delete
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setSelected([])}>Clear</Button>
        </div>
      )}

      {loading ? <p className="text-muted-foreground">Loading files…</p>
        : files.length === 0 && knownFolders.length === 0 ? (
          <div className="border-y py-12 text-center">
            <FileJson className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h2 className="font-display text-xl font-semibold">No saved files yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">Upload a JSON quiz file and it stays on this device.</p>
          </div>
        ) : subFolders.length === 0 && filesHere.length === 0 ? (
          <div className="border-y py-12 text-center">
            <Folder className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h2 className="font-display text-xl font-semibold">This folder is empty</h2>
            <p className="mt-1 text-sm text-muted-foreground">Move files here with “Move to folder”, create a subfolder, or upload new files.</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="outline" disabled={busy} onClick={() => { setNewFolderName(""); setNewFolderOpen(true); }}>
                <FolderPlus className="mr-2 h-4 w-4" />New folder
              </Button>
              <Button disabled={busy} onClick={() => input.current?.click()}><Upload className="mr-2 h-4 w-4" />Upload to save</Button>
            </div>
          </div>
        ) : (
          <>
            {subFolders.length > 0 && (
              <section className="mb-6">
                <h2 className="mb-2 font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">Folders</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{subFolders.map(folderCard)}</div>
              </section>
            )}
            {filesHere.length > 0 && (
              <section>
                <h2 className="mb-2 font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">Files</h2>
                {view === "grid"
                  ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{filesHere.map(gridFileCard)}</div>
                  : <ul className="divide-y border-y">{filesHere.map(listRow)}</ul>}
              </section>
            )}
          </>
        )}

      <Dialog open={moving !== null} onOpenChange={(open) => { if (!open && !busy) { setMoving(null); setMoveValue(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move {moving && moving.length > 1 ? `${moving.length} files` : "file"}</DialogTitle>
            <DialogDescription>
              Type a folder path — use “/” for subfolders, e.g. “JAPAN/JSON” — or pick one below. Leave empty for the root.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (moving) void moveFiles(moving); }}>
            <Input value={moveValue} autoFocus placeholder="Folder path — empty = Saved Files root" aria-label="Folder path" disabled={busy}
              onChange={(event) => setMoveValue(event.target.value)} />
            <div className="flex flex-wrap gap-1">
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setMoveValue("")}>Root</Button>
              {knownFolders.map((f) => (
                <Button key={f} type="button" size="sm" variant="outline" disabled={busy} onClick={() => setMoveValue(f)}>{f}</Button>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => { setMoving(null); setMoveValue(""); }}>Cancel</Button>
              <Button type="submit" disabled={busy}>Move</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={newFolderOpen} onOpenChange={(open) => { if (!open && !busy) { setNewFolderOpen(false); setNewFolderName(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>
              Created {path ? `inside “${path}”` : "in the Saved Files root"}. Use “/” for subfolders.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void createFolder(); }}>
            <Input value={newFolderName} autoFocus placeholder="Folder name" aria-label="Folder name" disabled={busy}
              onChange={(event) => setNewFolderName(event.target.value)} />
            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => { setNewFolderOpen(false); setNewFolderName(""); }}>Cancel</Button>
              <Button type="submit" disabled={busy}>Create folder</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
