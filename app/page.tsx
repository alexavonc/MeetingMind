"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Plus, Menu, X, FileAudio, AlignLeft, GitBranch, Mic } from "lucide-react";
import { useMeetings } from "@/hooks/useMeetings";
import Sidebar from "./components/Sidebar";
import TranscriptView from "./components/TranscriptView";
import SummaryView from "./components/SummaryView";
import FlowchartView from "./components/FlowchartView";
import UploadModal from "./components/UploadModal";
import SettingsModal from "./components/SettingsModal";
import RecordModal from "./components/RecordModal";
import type { Folder } from "@/types";

type Tab = "transcript" | "summary" | "flowchart";

const TABS: { value: Tab; label: string; icon: ReactNode }[] = [
  { value: "transcript", label: "Transcript", icon: <FileAudio className="w-4 h-4" /> },
  { value: "summary", label: "Summary", icon: <AlignLeft className="w-4 h-4" /> },
  { value: "flowchart", label: "Flowchart", icon: <GitBranch className="w-4 h-4" /> },
];

export default function Home() {
  const {
    meetings,
    selectedMeeting,
    selectedId,
    setSelectedId,
    selectedFolder,
    setSelectedFolder,
    settings,
    updateSettings,
    processing,
    toggleAction,
    moveMeeting,
    deleteMeeting,
    regenerateFlow,
    processUpload,
  } = useMeetings();

  const [activeTab, setActiveTab] = useState<Tab>("transcript");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);

  function handleSelectMeeting(id: string) {
    setSelectedId(id);
    setActiveTab("transcript");
    setSidebarOpen(false);
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
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border flex-shrink-0 bg-card">
        <Sidebar
          meetings={meetings}
          selectedId={selectedId}
          selectedFolder={selectedFolder}
          onSelectFolder={setSelectedFolder}
          onSelectMeeting={handleSelectMeeting}
          onOpenSettings={() => setSettingsOpen(true)}
          onMoveMeeting={moveMeeting}
          onDeleteMeeting={deleteMeeting}
        />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-card border-r border-border z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="font-semibold text-sm">Menu</span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <Sidebar
              meetings={meetings}
              selectedId={selectedId}
              selectedFolder={selectedFolder}
              onSelectFolder={setSelectedFolder}
              onSelectMeeting={handleSelectMeeting}
              onOpenSettings={() => { setSettingsOpen(true); setSidebarOpen(false); }}
              onMoveMeeting={moveMeeting}
              onDeleteMeeting={deleteMeeting}
            />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            {selectedMeeting ? (
              <div className="flex items-baseline gap-2 flex-wrap">
                <h2 className="font-semibold text-base truncate">{selectedMeeting.title}</h2>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {selectedMeeting.date} · {selectedMeeting.duration}
                </span>
              </div>
            ) : (
              <h2 className="font-semibold text-base text-muted-foreground">
                Select a meeting
              </h2>
            )}
          </div>

          <div className="hidden md:flex items-center gap-2">
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
              <Plus className="w-4 h-4" />
              Upload
            </button>
          </div>
        </header>

        {selectedMeeting ? (
          <>
            {/* Tab bar */}
            <div className="flex border-b border-border px-4 flex-shrink-0">
              {TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.value
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto px-4 py-5">
              {activeTab === "transcript" && (
                <TranscriptView meeting={selectedMeeting} />
              )}
              {activeTab === "summary" && (
                <SummaryView
                  meeting={selectedMeeting}
                  onToggleAction={(idx) => toggleAction(selectedMeeting.id, idx)}
                />
              )}
              {activeTab === "flowchart" && (
                <FlowchartView
                  meeting={selectedMeeting}
                  onRegenerate={() => regenerateFlow(selectedMeeting.id)}
                  hasApiKey={!!settings.claudeKey}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center text-3xl">
              🎙️
            </div>
            <div>
              <p className="text-base font-medium text-foreground">
                No meeting selected
              </p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Pick a meeting from the sidebar, or upload a new recording.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
                bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New meeting
            </button>
          </div>
        )}
      </main>

      {/* Mobile FABs */}
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

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        processing={processing}
        onSubmit={handleProcessUpload}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={updateSettings}
      />

      <RecordModal
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        processing={processing}
        onSubmit={handleProcessUpload}
      />
    </div>
  );
}
