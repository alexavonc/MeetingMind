"use client";

import { useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import type { Settings } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (s: Settings) => void;
}

export default function SettingsModal({ open, onClose, settings, onSave }: Props) {
  const [claudeKey, setClaudeKey] = useState(settings.claudeKey);
  const [whisperKey, setWhisperKey] = useState(settings.whisperKey);
  const [showClaude, setShowClaude] = useState(false);
  const [showWhisper, setShowWhisper] = useState(false);

  if (!open) return null;

  function handleSave() {
    onSave({ claudeKey: claudeKey.trim(), whisperKey: whisperKey.trim() });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
            API keys are stored locally in your browser. Never share this device's localStorage with others.
          </div>

          <KeyInput
            label="Anthropic Claude API Key"
            placeholder="sk-ant-…"
            value={claudeKey}
            onChange={setClaudeKey}
            show={showClaude}
            onToggleShow={() => setShowClaude((v) => !v)}
          />

          <KeyInput
            label="OpenAI Whisper API Key"
            placeholder="sk-…"
            value={whisperKey}
            onChange={setWhisperKey}
            show={showWhisper}
            onToggleShow={() => setShowWhisper((v) => !v)}
          />

          <div className="text-xs text-muted-foreground space-y-1">
            <p>Estimated cost per meeting:</p>
            <p>• Whisper: ~$0.006/min (~$0.18 for 30 min)</p>
            <p>• Claude: ~$0.02–0.05 (diarisation + summary + flowchart)</p>
            <p>• Total: ~$0.20–0.25 per meeting</p>
          </div>
        </div>

        <div className="px-6 pb-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function KeyInput({
  label,
  placeholder,
  value,
  onChange,
  show,
  onToggleShow,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-10 rounded-lg bg-input border border-border text-sm text-foreground
            placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
