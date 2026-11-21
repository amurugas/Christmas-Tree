"use client";

import { type DragEvent, type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Check, CircleAlert, Gift, LoaderCircle, RefreshCw, Sparkles, Trash2, UploadCloud, Users, X } from "lucide-react";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { GlbAgentPrompt } from "@/components/glb-agent-prompt";
import type { PreparedGlb } from "@/lib/ornaments/prepare-glb";
import { sizeInches } from "@/lib/ornaments/preview-rules";
import {
  formatBytes, formatCount, formatInches, formatMessageCount, validateInitialsClient, validateGlbFile,
  type ClientValidationError,
} from "@/lib/ornaments/client";
import type { PublicOrnament } from "@/lib/ornaments/types";

function apiError(text: string, fallback: string) {
  try {
    const payload = JSON.parse(text) as { error?: { message?: string } };
    return payload.error?.message || fallback;
  } catch { return fallback; }
}

type Conversion =
  | { status: "idle" }
  | { status: "preparing" }
  | { status: "ready"; result: PreparedGlb }
  | { status: "error"; message: string };

function upload(initials: string, message: string, file: File, onProgress: (value: number) => void) {
  return new Promise<PublicOrnament>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/ornaments");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error("Upload interrupted. Check your connection and try again."));
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(apiError(request.responseText, "The model could not be uploaded.")));
        return;
      }
      try { resolve((JSON.parse(request.responseText) as { ornament: PublicOrnament }).ornament); }
      catch { reject(new Error("The server returned an unexpected response.")); }
    };
    const body = new FormData();
    body.set("initials", initials);
    body.set("message", message);
    body.set("model", file);
    request.send(body);
  });
}

/** A small turning render of the converted .glb, loaded only once a file is converted. */
function GlbPreview({ glb }: { glb: Uint8Array }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    import("@/lib/convert/preview-renderer")
      .then(({ mountGlbPreview }) => mountGlbPreview(canvas, glb))
      .then((dispose) => { if (cancelled) dispose(); else cleanup = dispose; })
      .catch((error) => { console.error(error); if (!cancelled) setFailed(true); });
    return () => { cancelled = true; cleanup?.(); };
  }, [glb]);
  if (failed) return <div className="grid aspect-square w-full place-items-center rounded-xl bg-[#eef3f0] text-xs text-[#687b73]">Preview unavailable</div>;
  return <canvas ref={canvasRef} aria-label="Preview of your ornament" className="aspect-square w-full rounded-xl bg-[radial-gradient(circle_at_50%_35%,#ffffff,#e4ece7)]" />;
}

function ConversionReport({ file, result }: { file: File; result: PreparedGlb }) {
  const { report } = result;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-left text-sm">
      <dt className="text-[#687b73]">Size</dt><dd className="font-semibold tabular-nums">{formatInches(sizeInches(report.sizeMetres))}</dd>
      <dt className="text-[#687b73]">Hangs from</dt><dd>Top centre</dd>
      <dt className="text-[#687b73]">Triangles</dt><dd className="tabular-nums">{formatCount(report.triangles)}</dd>
      <dt className="text-[#687b73]">Materials</dt><dd>{report.materials}</dd>
      <dt className="text-[#687b73]">File</dt><dd className="tabular-nums">GLB · {formatBytes(file.size)}</dd>
    </dl>
  );
}

export function OrnamentStudio({ onOrnamentsChange, onOrnamentUploaded }: { onOrnamentsChange?: (ornaments: PublicOrnament[]) => void; onOrnamentUploaded?: (id: string) => void }) {
  const [initials, setInitials] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [conversion, setConversion] = useState<Conversion>({ status: "idle" });
  const conversionToken = useRef(0);
  const [fieldError, setFieldError] = useState<ClientValidationError | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState<PublicOrnament | null>(null);
  const [ornaments, setOrnaments] = useState<PublicOrnament[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  const loadOrnaments = useCallback(async (showLoading = true) => {
    if (showLoading) setLoadingList(true);
    setListError("");
    try {
      const response = await fetch("/api/ornaments", { cache: "no-store" });
      if (!response.ok) throw new Error(apiError(await response.text(), "Could not load the ornament list."));
      const next = ((await response.json()) as { ornaments: PublicOrnament[] }).ornaments;
      setOrnaments(next);
      onOrnamentsChange?.(next);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Could not load the ornament list.");
    } finally { if (showLoading) setLoadingList(false); }
  }, [onOrnamentsChange]);

  useEffect(() => {
    // Initial remote data load is intentionally tied to mounting this client view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOrnaments();
    const refreshSharedState = () => void loadOrnaments(false);
    const interval = window.setInterval(refreshSharedState, 15_000);
    window.addEventListener("focus", refreshSharedState);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshSharedState);
    };
  }, [loadOrnaments]);
  useEffect(() => { if (success) successRef.current?.focus(); }, [success]);

  async function chooseFile(candidate: File | null) {
    setSubmitError(""); setSuccess(null);
    if (!candidate) return;
    const token = ++conversionToken.current;
    const error = await validateGlbFile(candidate);
    if (token !== conversionToken.current) return;
    if (error) {
      setFile(null); setFieldError(error); setConversion({ status: "idle" });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(candidate); setFieldError(null); setConversion({ status: "preparing" });
    try {
      const { prepareGlb } = await import("@/lib/ornaments/prepare-glb");
      const result = await prepareGlb(new Uint8Array(await candidate.arrayBuffer()));
      if (token === conversionToken.current) setConversion({ status: "ready", result });
    } catch (conversionError) {
      if (token !== conversionToken.current) return;
      console.error(conversionError);
      const message = conversionError instanceof Error
        ? conversionError.message
        : "This GLB could not be checked. Ask your agent to export it again.";
      setConversion({ status: "error", message });
    }
  }

  function clearFile() {
    conversionToken.current += 1;
    setFile(null); setFieldError(null); setConversion({ status: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault(); setSubmitError(""); setSuccess(null);
    const initialsError = validateInitialsClient(initials);
    if (initialsError) { setFieldError(initialsError); return; }
    if (!file) { setFieldError({ field: "model", message: "Choose a .glb file." }); return; }
    if (conversion.status !== "ready") {
      setSubmitError(conversion.status === "error" ? conversion.message : "Your GLB is still being checked.");
      return;
    }
    setUploading(true); setProgress(0);
    try {
      const ornament = await upload(initials, message, file, setProgress);
      onOrnamentUploaded?.(ornament.id);
      setSuccess(ornament); setProgress(100); setFile(null); setConversion({ status: "idle" }); setInitials(""); setMessage("");
      if (inputRef.current) inputRef.current.value = "";
      await loadOrnaments();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "The model could not be uploaded.");
    } finally { setUploading(false); }
  }

  async function deleteOrnament(id: string) {
    setDeletingId(id); setListError("");
    try {
      const response = await fetch(`/api/ornaments/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(apiError(await response.text(), "Could not remove the ornament."));
      await loadOrnaments();
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Could not remove the ornament.");
    } finally { setDeletingId(null); }
  }

  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setDragging(false);
    if (!uploading) void chooseFile(event.dataTransfer.files[0] ?? null);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#f5f3ed] text-[#18372d]">
      <header className="relative border-b border-[#18372d]/10 bg-[#f9f8f4]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
          <a href="#top" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c74331] focus-visible:ring-offset-4">
            <span className="grid size-10 place-items-center rounded-full bg-[#174b3a] text-[#f9e7ab]"><Gift aria-hidden="true" /></span>
            <span className="font-serif text-lg font-bold">The Community Tree</span>
          </a>
          <a href="#manage" className="hidden items-center gap-2 rounded-lg border border-[#174b3a]/15 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:border-[#174b3a]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c74331] sm:flex"><Users aria-hidden="true" className="size-4" /> Manage ornaments</a>
        </div>
      </header>

      <section id="top" className="relative mx-auto max-w-7xl px-5 pb-16 pt-12 sm:px-8 sm:pt-16 lg:px-12 lg:pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#a6382d]">A collaborative Christmas tree</p>
          <h1 className="mt-4 font-serif text-4xl font-bold tracking-tight text-[#133d30] sm:text-6xl">Make something merry.<br /><span className="italic text-[#bd3d30]">Hang it on the tree.</span></h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-[#526b61] sm:text-lg">Upload a GLB ornament and add your name. Your model joins the shared tree for everyone to enjoy.</p>
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(260px,.75fr)] lg:items-start">
          <form onSubmit={handleSubmit} className="rounded-3xl border border-[#18372d]/10 bg-white/95 p-5 shadow-[0_24px_60px_rgba(23,75,58,.1)] sm:p-8">
            <div className="flex gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#174b3a] font-bold text-[#f5d77e]">1</span>
              <div><h2 className="font-serif text-2xl font-bold">Choose your ornament</h2><p className="mt-1 text-sm text-[#687b73]">GLB · 512 KiB maximum</p></div>
            </div>

            <div
              className={`mt-5 grid min-h-52 place-items-center rounded-2xl border-2 border-dashed p-6 text-center transition ${dragging ? "border-[#bd3d30] bg-[#fff6f2]" : fieldError?.field === "model" ? "border-[#bd3d30] bg-[#fff8f6]" : "border-[#99aca3] bg-[#f7faf8] hover:border-[#487260]"}`}
              onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={drop}
            >
              <input ref={inputRef} id="model" type="file" accept=".glb,model/gltf-binary" className="sr-only" disabled={uploading} onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)} aria-describedby="model-hint model-error" aria-invalid={fieldError?.field === "model" || undefined} />
              {file ? <div className="w-full" aria-live="polite">
                {conversion.status === "ready" ? <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,180px)_1fr]">
                  <GlbPreview glb={conversion.result.glb} />
                  <div className="min-w-0 text-left">
                    <p className="truncate font-bold">{file.name}</p>
                    <div className="mt-2"><ConversionReport file={file} result={conversion.result} /></div>
                  </div>
                </div> : <>
                  <span className={`mx-auto grid size-14 place-items-center rounded-full ${conversion.status === "error" ? "bg-[#fbe6e2] text-[#a6382d]" : "bg-[#e5f0ea] text-[#174b3a]"}`}>
                    {conversion.status === "error" ? <CircleAlert aria-hidden="true" /> : conversion.status === "preparing" ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Check aria-hidden="true" />}
                  </span>
                  <p className="mt-3 truncate font-bold">{file.name}</p><p className="mt-1 text-sm text-[#687b73]">{formatBytes(file.size)}</p>
                  {conversion.status === "preparing" && <p className="mt-2 text-sm font-semibold text-[#376a56]">Checking your GLB…</p>}
                  {conversion.status === "error" && <p role="alert" className="mx-auto mt-3 max-w-md text-sm font-medium text-[#a6382d]">{conversion.message}</p>}
                </>}
                <button type="button" onClick={clearFile} disabled={uploading} className="mt-3 inline-flex items-center gap-1 rounded px-2 py-1 text-sm font-semibold text-[#a6382d] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c74331]"><X aria-hidden="true" className="size-4" /> {conversion.status === "error" ? "Choose another file" : "Remove"}</button>
              </div> : <label htmlFor="model" role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); inputRef.current?.click(); } }} className="cursor-pointer rounded-xl p-3 outline-none focus-visible:ring-2 focus-visible:ring-[#c74331]">
                <UploadCloud aria-hidden="true" className="mx-auto size-10 text-[#376a56]" /><span className="mt-3 block font-bold">Drop your .glb here</span><span className="mt-1 block text-sm text-[#687b73]">or <span className="font-semibold text-[#a6382d] underline">browse your files</span></span><span id="model-hint" className="mt-3 block text-xs text-[#7c8b84]">A self-contained GLB 2.0 model</span>
              </label>}
            </div>
            <p className="mt-3 text-xs leading-5 text-[#687b73]">Up to 4″ on each side. Your ornament hangs from its top centre at true size. Use the agent prompt to prepare your export.</p>
            {fieldError?.field === "model" && <p id="model-error" role="alert" className="mt-3 flex gap-2 text-sm font-medium text-[#a6382d]"><CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{fieldError.message}</p>}
            <div className="mt-7 flex gap-4 border-t border-[#18372d]/10 pt-7">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#174b3a] font-bold text-[#f5d77e]">2</span>
              <div className="min-w-0 flex-1">
                <label htmlFor="initials" className="font-serif text-2xl font-bold">Add your name</label>
                <p id="initials-hint" className="mt-1 text-sm text-[#687b73]">Your full name, shown with your ornament</p>
                <input id="initials" value={initials} maxLength={60} autoComplete="name" placeholder="E.g. Jordan Lee" disabled={uploading}
                  onChange={(event) => { setInitials(event.target.value); if (fieldError?.field === "initials") setFieldError(null); }}
                  aria-describedby={`initials-hint${fieldError?.field === "initials" ? " initials-error" : ""}`} aria-invalid={fieldError?.field === "initials" || undefined}
                  className="mt-4 h-14 w-full rounded-xl border border-[#9eaea7] px-4 text-lg font-semibold outline-none placeholder:font-normal placeholder:text-[#98a49f] focus:border-[#174b3a] focus:ring-4 focus:ring-[#174b3a]/10" />
                {fieldError?.field === "initials" && <p id="initials-error" role="alert" className="mt-2 flex items-center gap-2 text-sm font-medium text-[#a6382d]"><CircleAlert aria-hidden="true" className="size-4" />{fieldError.message}</p>}
                <div className="mt-5 flex items-end justify-between gap-3">
                  <label htmlFor="message" className="font-semibold">Message <span className="font-normal text-[#718078]">(optional)</span></label>
                  <span id="message-count" className="text-xs tabular-nums text-[#718078]">{formatMessageCount(message)}</span>
                </div>
                <textarea id="message" value={message} maxLength={80} rows={3} disabled={uploading}
                  onChange={(event) => setMessage(event.target.value)}
                  aria-describedby="message-hint message-count"
                  placeholder="Share a holiday wish"
                  className="mt-2 w-full resize-none rounded-xl border border-[#9eaea7] px-4 py-3 text-base leading-6 outline-none placeholder:text-[#98a49f] focus:border-[#174b3a] focus:ring-4 focus:ring-[#174b3a]/10" />
                <p id="message-hint" className="mt-1 text-xs text-[#718078]">Appears briefly as your ornament turns into view, or when selected.</p>
              </div>
            </div>

            {uploading && <div className="mt-6" aria-live="polite"><div className="mb-2 flex justify-between text-sm font-semibold"><span>Uploading model...</span><span>{progress}%</span></div><Progress value={progress} className="bg-[#dce7e1] [&_[data-slot=progress-indicator]]:bg-[#bd3d30]" /></div>}
            {submitError && <div role="alert" className="mt-5 flex gap-2 rounded-xl border border-[#bd3d30]/20 bg-[#fff6f3] p-4 text-sm font-medium text-[#9b3228]"><CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />{submitError}</div>}
            {success && <div ref={successRef} tabIndex={-1} role="status" className="mt-5 flex gap-3 rounded-xl border border-[#2f7458]/20 bg-[#eff8f2] p-4 outline-none focus:ring-2 focus:ring-[#2f7458]"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#2f7458] text-white"><Check aria-hidden="true" className="size-4" /></span><div><p className="font-bold">Your ornament is on the tree!</p><p className="mt-0.5 text-sm text-[#567066]">It was placed in spot {success.slot}.</p></div></div>}
            <Button type="submit" disabled={uploading || (file !== null && conversion.status !== "ready")} className="mt-6 h-12 w-full rounded-xl bg-[#bd3d30] text-base shadow-[0_8px_22px_rgba(157,48,38,.22)] hover:bg-[#a9362b] focus-visible:ring-[#bd3d30]/35">{uploading ? <><LoaderCircle aria-hidden="true" className="animate-spin" /> Uploading...</> : conversion.status === "preparing" ? <><LoaderCircle aria-hidden="true" className="animate-spin" /> Checking your GLB…</> : <><Sparkles aria-hidden="true" /> Add to the tree</>}</Button>
            <p className="mt-4 text-center text-xs leading-5 text-[#718078]">By uploading, you are sharing this model publicly on the community tree.</p>
          </form>

          <GlbAgentPrompt />
        </div>
      </section>

      <section id="manage" className="relative bg-[#e8ede8] px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#a6382d]">On the tree now</p><h2 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">Manage ornaments</h2><p className="mt-2 text-sm text-[#60736a]">Visible ornaments are public. Remove only the one you intend to delete.</p></div>
            <Button type="button" variant="outline" onClick={() => void loadOrnaments()} disabled={loadingList} className="self-start border-[#174b3a]/20 bg-white sm:self-auto"><RefreshCw aria-hidden="true" className={loadingList ? "animate-spin" : ""} /> Refresh</Button>
          </div>

          {listError && <div role="alert" className="mt-5 flex justify-between gap-3 rounded-xl border border-[#bd3d30]/20 bg-[#fff6f3] p-4 text-sm font-medium text-[#9b3228]"><span className="flex gap-2"><CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{listError}</span><button type="button" className="shrink-0 underline underline-offset-4" onClick={() => void loadOrnaments()}>Try again</button></div>}

          {loadingList && ornaments.length === 0 ? <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Loading ornaments"><span className="h-20 animate-pulse rounded-2xl bg-white/70" /><span className="h-20 animate-pulse rounded-2xl bg-white/70" /></div>
          : ornaments.length === 0 ? <div className="mt-8 rounded-2xl border border-dashed border-[#174b3a]/25 bg-white/60 p-8 text-center"><Gift aria-hidden="true" className="mx-auto text-[#5c776b]" /><p className="mt-3 font-serif text-xl font-bold">The tree is waiting for its first ornament.</p></div>
          : <ul className="mt-8 grid gap-3 sm:grid-cols-2" aria-label={`${ornaments.length} visible ornaments`}>
              {ornaments.map((ornament) => <li key={ornament.id} className="flex items-center gap-4 rounded-2xl border border-[#18372d]/10 bg-white/85 p-4 shadow-sm">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#174b3a] font-serif text-lg font-bold text-[#f7df96]" aria-hidden="true">{ornament.initials.trim().charAt(0).toUpperCase()}</span>
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{ornament.initials}</p><p className="truncate text-xs text-[#697c73]">{ornament.originalName}</p><p className="mt-0.5 text-xs text-[#697c73]">Spot {ornament.slot} - {formatBytes(ornament.byteSize)}</p></div>
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button type="button" variant="ghost" size="icon" className="text-[#9b382f] hover:bg-[#fff0ed]" aria-label={`Remove ${ornament.originalName} by ${ornament.initials}`} disabled={deletingId === ornament.id}>{deletingId === ornament.id ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Trash2 aria-hidden="true" />}</Button></AlertDialogTrigger>
                  <AlertDialogContent className="border-[#18372d]/15 bg-[#fffdf9]"><AlertDialogHeader><AlertDialogTitle>Remove this ornament?</AlertDialogTitle><AlertDialogDescription><strong className="text-[#18372d]">{ornament.originalName}</strong> by {ornament.initials} will be removed from spot {ornament.slot}. This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep it</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void deleteOrnament(ornament.id)}>Remove ornament</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                </AlertDialog>
              </li>)}
            </ul>}
        </div>
      </section>
      <footer className="relative bg-[#143d30] px-5 py-8 text-center text-sm text-[#d4e0da]"><p><span className="text-[#f2cf73]">&#10022;</span> Made together, one ornament at a time.</p></footer>
    </main>
  );
}
