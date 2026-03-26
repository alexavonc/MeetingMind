"use client";

import { useState } from "react";
import { X, Eye, EyeOff, Copy, Check } from "lucide-react";
import type { Settings, TranscriptionProvider } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (s: Settings) => void;
}

export default function SettingsModal({ open, onClose, settings, onSave }: Props) {
  const [claudeKey, setClaudeKey] = useState(settings.claudeKey);
  const [whisperKey, setWhisperKey] = useState(settings.whisperKey);
  const [provider, setProvider] = useState<TranscriptionProvider>(settings.transcriptionProvider ?? "groq");
  const [ingestSecret, setIngestSecret] = useState(settings.ingestSecret ?? "");
  const [hfToken, setHfToken] = useState(settings.hfToken ?? "");
  const [hfEndpointUrl, setHfEndpointUrl] = useState(settings.hfEndpointUrl ?? "");
  const [showClaude, setShowClaude] = useState(false);
  const [showWhisper, setShowWhisper] = useState(false);
  const [showHf, setShowHf] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  function handleSave() {
    onSave({
      claudeKey: claudeKey.trim(),
      whisperKey: whisperKey.trim(),
      transcriptionProvider: provider,
      ingestSecret: ingestSecret.trim(),
      hfToken: hfToken.trim(),
      hfEndpointUrl: hfEndpointUrl.trim(),
    });
    onClose();
  }

  function generateSecret() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const arr = crypto.getRandomValues(new Uint8Array(32));
    setIngestSecret(Array.from(arr, (b) => chars[b % chars.length]).join(""));
  }

  async function copyIngestUrl() {
    const url = `${window.location.origin}/api/ingest`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const costNote =
    provider === "groq"
      ? "• Groq Whisper large-v3: ~$0.111/hr audio (~$0.06 for 30 min)"
      : provider === "huggingface"
      ? "• HF turbo-singlish: ~$0.008/hr compute on dedicated L4 endpoint"
      : "• OpenAI Whisper: ~$0.006/min (~$0.18 for 30 min)";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Settings</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
            API keys are stored locally in your browser. Never share this device&apos;s localStorage with others.
          </div>

          {/* Claude */}
          <KeyInput
            label="Anthropic Claude API Key"
            placeholder="sk-ant-…"
            value={claudeKey}
            onChange={setClaudeKey}
            show={showClaude}
            onToggleShow={() => setShowClaude((v) => !v)}
          />

          {/* Transcription provider toggle */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              Transcription provider
            </label>
            <div className="flex rounded-lg bg-secondary p-1 gap-1 mb-3">
              {(["groq", "openai", "huggingface"] as TranscriptionProvider[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProvider(p)}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    provider === p
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p === "groq" ? "Groq" : p === "openai" ? "OpenAI" : "HF Singlish"}
                </button>
              ))}
            </div>

            {provider === "huggingface" ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-violet-50 border border-violet-200 text-xs text-violet-700">
                  Uses <code className="text-white/70">mjwong/whisper-large-v3-turbo-singlish</code> — fine-tuned on IMDA National Speech Corpus. Best Singlish accuracy (~13% WER). Falls back to Groq large-v3 automatically if the HF call fails.
                </div>

                <KeyInput
                  label="HuggingFace Token"
                  placeholder="hf_…"
                  value={hfToken}
                  onChange={setHfToken}
                  show={showHf}
                  onToggleShow={() => setShowHf((v) => !v)}
                />

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    HF Inference Endpoint URL <span className="text-muted-foreground/50">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={hfEndpointUrl}
                    onChange={(e) => setHfEndpointUrl(e.target.value)}
                    placeholder="https://…endpoints.huggingface.cloud (leave blank for serverless)"
                    className="w-full px-3 py-2 rounded-lg bg-input border border-border text-xs text-foreground
                      placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Leave blank to use the free serverless API (slower, rate-limited). For production, deploy a dedicated L4 endpoint on huggingface.co/inference-endpoints.
                  </p>
                </div>

                <KeyInput
                  label="Groq API Key (fallback for Mandarin / HF failures)"
                  placeholder="gsk_…"
                  value={whisperKey}
                  onChange={setWhisperKey}
                  show={showWhisper}
                  onToggleShow={() => setShowWhisper((v) => !v)}
                />
              </div>
            ) : (
              <KeyInput
                label={provider === "groq" ? "Groq API Key" : "OpenAI API Key"}
                placeholder={provider === "groq" ? "gsk_…" : "sk-…"}
                value={whisperKey}
                onChange={setWhisperKey}
                show={showWhisper}
                onToggleShow={() => setShowWhisper((v) => !v)}
              />
            )}
          </div>

          {/* Apple Watch ingest */}
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-0.5">Apple Watch auto-ingest</p>
              <p className="text-xs text-muted-foreground/70">
                Record on Apple Watch with Voice Memos → iOS Shortcut sends the audio file here → Groq transcribes → Claude processes. Set <code className="text-foreground/60">GROQ_API_KEY</code> in Railway Variables.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Ingest endpoint
              </label>
              <div className="flex gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-xs text-foreground font-mono truncate">
                  {typeof window !== "undefined" ? `${window.location.origin}/api/ingest` : "/api/ingest"}
                </code>
                <button
                  type="button"
                  onClick={copyIngestUrl}
                  className="px-3 py-2 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Ingest secret token
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={ingestSecret}
                  onChange={(e) => setIngestSecret(e.target.value)}
                  placeholder="Generate or paste a secret token"
                  className="flex-1 px-3 py-2 rounded-lg bg-input border border-border text-xs text-foreground font-mono
                    placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={generateSecret}
                  className="px-3 py-2 rounded-lg bg-secondary border border-border text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 whitespace-nowrap"
                >
                  Generate
                </button>
              </div>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Set <code className="text-foreground/60">MEETINGMIND_INGEST_SECRET</code> and <code className="text-foreground/60">GROQ_API_KEY</code> in Railway Variables.
              </p>
            </div>
          </div>

          {/* Cost note */}
          <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t border-border">
            <p className="font-medium text-foreground/60">Estimated cost per meeting</p>
            <p>{costNote}</p>
            <p>• Claude: ~$0.02–0.05 (diarisation + summary + flowchart)</p>
          </div>
        </div>

        <div className="px-6 pb-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function KeyInput({ label, placeholder, value, onChange, show, onToggleShow }: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; show: boolean; onToggleShow: () => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-10 rounded-lg bg-input border border-border text-sm text-foreground
            placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
        />
        <button type="button" onClick={onToggleShow} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
