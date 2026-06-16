"use client";

import { useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, Menu, X, FileAudio, AlignLeft, GitBranch, Mic, Paperclip, RefreshCw, Upload as UploadIcon, Settings, List, Replace, ArrowLeft } from "lucide-react";
import { useMeetings } from "@/hooks/useMeetings";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "./components/Sidebar";
import RecordingLibrary from "./components/RecordingLibrary";
import TranscriptView from "./components/TranscriptView";
import SummaryView from "./components/SummaryView";
import FlowchartView from "./components/FlowchartView";
import UploadModal from "./components/UploadModal";
import SettingsModal from "./components/SettingsModal";
import RecordModal from "./components/RecordModal";
import ExportDropdown from "./components/ExportDropdown";
import AudioPlayer from "./components/AudioPlayer";
import VideoPlayer from "./components/VideoPlayer";
import PointersView from "./components/PointersView";
import FindReplaceBar from "./components/FindReplaceBar";
import ProcessingSteps from "./components/ProcessingSteps";
import CostModal from "./components/CostModal";
import { estimateMeetingCost, formatUSD } from "@/lib/costs";
import type { Folder } from "@/types";

type Tab = "transcript" | "pointers" | "summary" | "flowchart";

function AttachVideoPrompt({
  meetingId,
  onAttach,
}: {
  meetingId: string;
  onAttach: (meetingId: string, file: File, onProgress?: (d: string) => void) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      await onAttach(meetingId, file, setProgress);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      setProgress("");
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <input
        ref={inputRef}
        type="file"
        accept="video/*,.mp4,.webm,.mov,.avi,.mkv,.m4v"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border
          shadow-lg text-xs font-medium text-muted-foreground hover:text-foreground
          hover:bg-secondary transition-colors disabled:opacity-60"
      >
        <span className="text-base">🎬</span>
        {uploading ? (progress || "Uploading…") : "Attach video recording"}
      </button>
      {error && (
        <p className="mt-1 text-[11px] text-destructive text-right max-w-[220px]">{error}</p>
      )}
    </div>
  );
}

function AudioBar({
  audioUrl,
  onAttach,
  onReplace,
  onReprocess,
}: {
  audioUrl?: string;
  onAttach: (f: File) => Promise<void>;
  onReplace: (f: File) => void;
  onReprocess: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAttach(file: File) {
    setUploading(true); setError(null);
    try { await onAttach(file); }
    catch (e) { setError(e instanceof Error ? e.message : "Upload failed"); }
    finally { setUploading(false); }
  }

  if (audioUrl) {
    return (
      <div className="flex flex-col border-b border-border">
        <AudioPlayer url={audioUrl} />
        <input ref={replaceRef} type="file" accept="audio/*,.m4a,.mp3,.wav,.mp4" className="hidden"
          onChange={(e) => e.target.files?.[0] && onReplace(e.target.files[0])} />
        <div className="flex items-center gap-4 px-4 py-1.5 bg-secondary/20">
          <button type="button" onClick={onReprocess}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="w-3 h-3" />
            Re-process
          </button>
          <button type="button" onClick={() => replaceRef.current?.click()}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <UploadIcon className="w-3 h-3" />
            Replace audio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-secondary/30 border-b border-border">
      <input ref={inputRef} type="file" accept="audio/*,.m4a,.mp3,.wav,.mp4" className="hidden"
        onChange={(e) => e.target.files?.[0] && handleAttach(e.target.files[0])} />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
        <Paperclip className="w-3.5 h-3.5" />
        {uploading ? "Uploading…" : "Attach audio recording"}
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

const TABS: { value: Tab; label: string; icon: ReactNode }[] = [
  { value: "transcript", label: "Transcript", icon: <FileAudio className="w-4 h-4" /> },
  { value: "pointers", label: "Pointers", icon: <List className="w-4 h-4" /> },
  { value: "summary", label: "Summary", icon: <AlignLeft className="w-4 h-4" /> },
  { value: "flowchart", label: "Flowchart", icon: <GitBranch className="w-4 h-4" /> },
];

export default function Home() {
  // ── All hooks must come before any conditional returns ──────────────────────
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const {
    meetings,
    selectedMeeting,
    selectedId,
    setSelectedId,
    selectedFolder,
    setSelectedFolder,
    folders,
    createFolder,
    renameFolder,
    deleteFolder,
    settings,
    settingsReady,
    updateSettings,
    processing,
    toggleAction,
    reprocessMeeting,
    attachAudio,
    attachVideo,
    renameMeeting,
    moveMeeting,
    deleteMeeting,
    generateShareLink,
    regenerateFlow,
    regeneratePointers,
    recoverFrames,
    findReplaceInMeeting,
    renameSpeaker,
    reassignUtterance,
    processNotes,
    processUpload,
  } = useMeetings();
  const [activeTab, setActiveTab] = useState<Tab>("transcript");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [videoPlayerOpen, setVideoPlayerOpen] = useState(true);

  // Cmd+F / Ctrl+F opens find-replace when a meeting is selected
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "f" && selectedMeeting) {
        e.preventDefault();
        setFindReplaceOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedMeeting]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  // Once settings have loaded from Supabase, open settings modal if keys are still missing
  useEffect(() => {
    if (settingsReady && user && !settings.claudeKey) {
      setSettingsOpen(true);
    }
  }, [settingsReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auth loading / settings loading / not signed in — show spinner
  if (authLoading || !user || !settingsReady) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  function handleSelectMeeting(id: string) {
    setSelectedId(id);
    setActiveTab("transcript");
    setSidebarOpen(false);
    setFindReplaceOpen(false);
    setVideoPlayerOpen(true);
  }

  async function handleProcessUpload(
    input: File | File[] | string,
    title: string,
    folder: Folder
  ) {
    await processUpload(input, title, folder);
    setActiveTab("transcript");
  }

  return (
    <div className="flex h-full">
      {/* ── DESKTOP: Column 1 — Folder sidebar (220px) ── */}
      <aside className="hidden md:flex w-[220px] flex-col border-r border-border flex-shrink-0 bg-white">
        <Sidebar
          meetings={meetings}
          selectedId={selectedId}
          selectedFolder={selectedFolder}
          folders={folders}
          onSelectFolder={setSelectedFolder}
          onSelectMeeting={handleSelectMeeting}
          onOpenSettings={() => setSettingsOpen(true)}
          onMoveMeeting={moveMeeting}
          onDeleteMeeting={deleteMeeting}
          onRenameMeeting={renameMeeting}
          onCreateFolder={createFolder}
          onRenameFolder={renameFolder}
          onDeleteFolder={deleteFolder}
          transcriptionProvider={settings.transcriptionProvider}
        />
      </aside>

      {/* ── DESKTOP: Column 2 — Recording library (360px) ── */}
      <div className="hidden md:flex w-[360px] flex-shrink-0">
        <RecordingLibrary
          meetings={meetings}
          selectedFolder={selectedFolder}
          selectedId={selectedId}
          allFolders={folders}
          onSelectMeeting={handleSelectMeeting}
          onSelectFolder={setSelectedFolder}
          onMoveMeeting={moveMeeting}
          onDeleteMeeting={deleteMeeting}
          onRenameMeeting={renameMeeting}
          onCreateFolder={createFolder}
        />
      </div>

      {/* ── MOBILE: Sidebar overlay ── */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-card border-r border-border z-50 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <span className="font-semibold text-sm">Folders</span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <Sidebar
                meetings={meetings}
                selectedId={selectedId}
                selectedFolder={selectedFolder}
                folders={folders}
                onSelectFolder={(f) => { setSelectedFolder(f); setSidebarOpen(false); }}
                onSelectMeeting={handleSelectMeeting}
                onOpenSettings={() => { setSettingsOpen(true); setSidebarOpen(false); }}
                onMoveMeeting={moveMeeting}
                onDeleteMeeting={deleteMeeting}
                onRenameMeeting={renameMeeting}
                onCreateFolder={createFolder}
                onRenameFolder={renameFolder}
                onDeleteFolder={deleteFolder}
              />
            </div>
          </aside>
        </div>
      )}

      {/* ── DESKTOP: Column 3 / MOBILE: full screen — Detail panel ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── MOBILE: Recording library (shown when no meeting selected) ── */}
        {!selectedId && (
          <div className="md:hidden flex flex-col flex-1 overflow-hidden">
            {/* Mobile top bar */}
            <header className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setRecordOpen(true)}
                className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                aria-label="Record"
              >
                <Mic className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                aria-label="Upload"
              >
                <Plus className="w-4 h-4" />
              </button>
            </header>
            <div className="flex-1 overflow-hidden">
              <RecordingLibrary
                meetings={meetings}
                selectedFolder={selectedFolder}
                selectedId={selectedId}
                allFolders={folders}
                onSelectMeeting={handleSelectMeeting}
                onSelectFolder={setSelectedFolder}
                onMoveMeeting={moveMeeting}
                onDeleteMeeting={deleteMeeting}
                onRenameMeeting={renameMeeting}
                onCreateFolder={createFolder}
              />
            </div>
          </div>
        )}

        {/* ── Detail panel header (desktop always, mobile only when meeting selected) ── */}
        <header className={`flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0 ${!selectedId ? "hidden md:flex" : "flex"}`}>
          {/* Mobile: back button when meeting is selected */}
          {selectedId && (
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="md:hidden text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Back to recordings"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="flex-1 min-w-0">
            {selectedMeeting ? (
              <div className="flex items-baseline gap-2 flex-wrap">
                <h2 className="font-semibold text-base truncate">{selectedMeeting.title}</h2>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {selectedMeeting.date} · {selectedMeeting.duration}
                  {Object.keys(selectedMeeting.speakers).length > 0 && (
                    <> · {Object.keys(selectedMeeting.speakers).length} speaker{Object.keys(selectedMeeting.speakers).length !== 1 ? "s" : ""}</>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setCostOpen(true)}
                  className="text-[11px] font-mono font-medium px-1.5 py-0.5 rounded-md
                    bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex-shrink-0"
                  title="View cost breakdown"
                >
                  ~{formatUSD(estimateMeetingCost(selectedMeeting, settings.transcriptionProvider ?? "groq").total)}
                </button>
              </div>
            ) : (
              <h2 className="font-semibold text-base text-muted-foreground">
                Select a recording
              </h2>
            )}
          </div>

          {/* Mobile: export icon when meeting selected */}
          {selectedMeeting && (
            <div className="md:hidden">
              <ExportDropdown
                meeting={selectedMeeting}
                onShare={() => generateShareLink(selectedMeeting.id)}
                iconOnly
              />
            </div>
          )}

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-2">
            {selectedMeeting && (
              <>
                <button
                  type="button"
                  onClick={() => setFindReplaceOpen((v) => !v)}
                  title="Find & Replace (⌘F)"
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    findReplaceOpen
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "text-muted-foreground border-border hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <Replace className="w-4 h-4" />
                  <span className="hidden lg:inline text-xs">Find &amp; Replace</span>
                </button>
                <ExportDropdown
                  meeting={selectedMeeting}
                  onShare={() => generateShareLink(selectedMeeting.id)}
                />
              </>
            )}
            <button
              type="button"
              onClick={() => setRecordOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
            >
              <Mic className="w-4 h-4" />
              Record
            </button>
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <UploadIcon className="w-4 h-4" />
              Upload
            </button>
          </div>
        </header>

        {/* ── Detail content ── */}
        {selectedMeeting ? (
          <>
            {/* Audio bar — hidden when video is available (video player handles audio) */}
            {!selectedMeeting.videourl && (
              <AudioBar
                audioUrl={selectedMeeting.audiourl}
                onAttach={(file) => attachAudio(selectedMeeting.id, file)}
                onReplace={(file) => reprocessMeeting(selectedMeeting.id, file)}
                onReprocess={() => reprocessMeeting(selectedMeeting.id)}
              />
            )}

            {/* Tab bar */}
            <div className="flex border-b border-border flex-shrink-0">
              {TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.value
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.icon}
                  <span className="hidden xs:inline sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Find & Replace bar */}
            {findReplaceOpen && (
              <FindReplaceBar
                meeting={selectedMeeting}
                onReplace={(find, replace, caseSensitive) =>
                  findReplaceInMeeting(selectedMeeting.id, find, replace, caseSensitive)
                }
                onClose={() => setFindReplaceOpen(false)}
              />
            )}

            {/* Tab content — replaced by progress UI while reprocessing */}
            <div className="flex-1 overflow-y-auto px-4 py-5 pb-28 md:pb-5">
              {processing.active ? (
                <div className="max-w-sm mx-auto mt-8">
                  <ProcessingSteps currentStep={processing.step} error={processing.error} detail={processing.detail} />
                </div>
              ) : activeTab === "transcript" ? (
                <TranscriptView
                  meeting={selectedMeeting}
                  onRenameSpeaker={(key, name) => renameSpeaker(selectedMeeting.id, key, name)}
                  onReassignUtterance={(idx, key) => reassignUtterance(selectedMeeting.id, idx, key)}
                />
              ) : activeTab === "pointers" ? (
                <PointersView
                  meeting={selectedMeeting}
                  onRecoverFrames={() => recoverFrames(selectedMeeting.id)}
                />
              ) : activeTab === "summary" ? (
                <SummaryView
                  meeting={selectedMeeting}
                  onToggleAction={(idx) => toggleAction(selectedMeeting.id, idx)}
                />
              ) : (
                <FlowchartView
                  meeting={selectedMeeting}
                  onRegenerate={() => regenerateFlow(selectedMeeting.id)}
                  onRegeneratePointers={() => regeneratePointers(selectedMeeting.id)}
                  hasApiKey={!!settings.claudeKey}
                />
              )}
            </div>
          </>
        ) : (
          /* Desktop empty state (hidden on mobile — mobile shows RecordingLibrary instead) */
          <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-4 text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center text-3xl">
              🎙️
            </div>
            <div>
              <p className="text-base font-medium text-foreground">
                No recording selected
              </p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Pick a recording from the library, or upload a new one.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
                bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New recording
            </button>
          </div>
        )}
      </main>

      {/* Mobile FABs — only show when on recording library (no meeting selected) */}
      {!selectedId && (
        <div className="md:hidden fixed bottom-6 right-6 z-30 flex flex-col items-end gap-3">
          <button
            type="button"
            onClick={() => setRecordOpen(true)}
            className="w-12 h-12 rounded-full bg-red-500 text-white shadow-xl hover:bg-red-400
              transition-colors flex items-center justify-center"
            aria-label="Record meeting"
          >
            <Mic className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl
              hover:bg-primary/90 transition-colors flex items-center justify-center"
            aria-label="Upload meeting"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      )}

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        processing={processing}
        onSubmit={handleProcessUpload}
        onSubmitNotes={async (notes, title, folder) => { await processNotes(notes, title, folder); }}
        folders={folders}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={updateSettings}
        user={user}
      />

      <RecordModal
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        processing={processing}
        onSubmit={handleProcessUpload}
        folders={folders}
      />

      {costOpen && selectedMeeting && (
        <CostModal
          meeting={selectedMeeting}
          provider={settings.transcriptionProvider ?? "groq"}
          onClose={() => setCostOpen(false)}
        />
      )}

      {/* Floating video player — shown when the selected meeting has a stored video */}
      {selectedMeeting?.videourl && videoPlayerOpen && (
        <VideoPlayer
          url={selectedMeeting.videourl}
          title={selectedMeeting.title}
          onClose={() => setVideoPlayerOpen(false)}
        />
      )}

      {/* Attach video prompt — for video meetings that don't have a stored video yet */}
      {selectedMeeting && !selectedMeeting.videourl &&
        (selectedMeeting.frameurls?.length || selectedMeeting.visualnotes) && (
        <AttachVideoPrompt
          meetingId={selectedMeeting.id}
          onAttach={attachVideo}
        />
      )}
    </div>
  );
}
