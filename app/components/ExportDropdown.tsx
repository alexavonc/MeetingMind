"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Download, Link2, Check } from "lucide-react";
import type { Meeting } from "@/types";

function clean(text: string) {
  return text
    .replace(/\[zh\|([^\]]+)\]\[\/zh\]/g, "$1")
    .replace(/\[ms\|([^\]]+)\]\[\/ms\]/g, "$1")
    .replace(/\[sg\]([\s\S]*?)\[\/sg\]/g, "$1");
}

function safeName(title: string) {
  return title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_") || "meeting";
}

interface Props {
  meeting: Meeting;
  activeTab: string;
  setActiveTab: (tab: "transcript" | "summary" | "flowchart") => void;
  onShare: () => Promise<string>;
  iconOnly?: boolean;
}

export default function ExportDropdown({ meeting, activeTab, setActiveTab, onShare, iconOnly = false }: Props) {
  const [open, setOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "loading" | "copied">("idle");
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleExportPDF() {
    setOpen(false);
    setPdfLoading(true);

    // Temporarily switch to flowchart tab so React Flow is rendered for capture
    const prevTab = activeTab as "transcript" | "summary" | "flowchart";
    const needSwitch = prevTab !== "flowchart";

    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210, H = 297, M = 18;
      const CW = W - 2 * M;
      let y = M;

      function newPageIfNeeded(needed: number) {
        if (y + needed > H - M) { pdf.addPage(); y = M; }
      }

      function sectionHeading(text: string) {
        newPageIfNeeded(14);
        pdf.setFontSize(13);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(30, 30, 30);
        pdf.text(text, M, y);
        y += 7;
        pdf.setDrawColor(220, 220, 230);
        pdf.setLineWidth(0.3);
        pdf.line(M, y - 2, W - M, y - 2);
        y += 4;
      }

      function bodyText(text: string, fontSize = 9.5, color: [number, number, number] = [60, 60, 60]) {
        pdf.setFontSize(fontSize);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...color);
        const lines = pdf.splitTextToSize(clean(text), CW) as string[];
        lines.forEach((line) => {
          newPageIfNeeded(6);
          pdf.text(line, M, y);
          y += fontSize * 0.42 + 1.2;
        });
      }

      // ── Cover bar ─────────────────────────────────────────────────────────
      pdf.setFillColor(109, 40, 217);
      pdf.rect(0, 0, W, 28, "F");
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text(meeting.title, M, 17);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(210, 200, 255);
      pdf.text(`${meeting.date} · ${meeting.duration}`, M, 24);
      y = 38;

      if (meeting.languages.length > 0) {
        const badgeMap: Record<string, string> = { en: "English", zh: "Mandarin", sg: "Singlish", ms: "Malay" };
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(120, 100, 200);
        pdf.text(meeting.languages.map((l) => badgeMap[l] ?? l).join("  /  "), M, y);
        y += 8;
      }
      y += 4;

      // ── Summary ───────────────────────────────────────────────────────────
      sectionHeading("Summary");
      bodyText(meeting.summary);
      y += 8;

      // ── Action Items ──────────────────────────────────────────────────────
      if (meeting.actions.length > 0) {
        sectionHeading("Action Items");
        meeting.actions.forEach((a, i) => {
          newPageIfNeeded(10);
          const status = a.done ? "[x]" : "[ ]";
          const owner = a.owner ? `  --  ${a.owner}` : "";
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(a.done ? 100 : 30, a.done ? 100 : 30, a.done ? 100 : 30);
          pdf.text(`${i + 1}.  ${status}`, M, y);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(a.done ? 130 : 50, a.done ? 130 : 50, a.done ? 130 : 50);
          const itemLines = pdf.splitTextToSize(`${clean(a.text)}${owner}`, CW - 14) as string[];
          itemLines.forEach((line, li) => {
            newPageIfNeeded(6);
            pdf.text(line, M + 14, y + li * 5);
          });
          y += itemLines.length * 5 + 4;
        });
        y += 6;
      }

      // ── Speakers ──────────────────────────────────────────────────────────
      const speakerNames = Object.values(meeting.speakers);
      if (speakerNames.length > 0) {
        sectionHeading("Speakers");
        bodyText(speakerNames.join(", "));
        y += 8;
      }

      // ── Transcript ────────────────────────────────────────────────────────
      sectionHeading("Transcript");
      meeting.transcript.forEach((u) => {
        const name = meeting.speakers[u.s] ?? u.s;
        newPageIfNeeded(14);
        pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(109, 40, 217);
        pdf.text(name, M, y);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(160, 140, 200);
        pdf.text(`[${u.t}]`, M + pdf.getTextWidth(`${name} `), y);
        y += 5;
        bodyText(u.text, 9);
        y += 3;
      });

      // ── Flowchart ─────────────────────────────────────────────────────────
      if (meeting.flow) {
        if (needSwitch) setActiveTab("flowchart");

        // Poll until React Flow is in the DOM (up to 2.5 s)
        const flowEl = await new Promise<HTMLElement | null>((resolve) => {
          const deadline = Date.now() + 2500;
          function check() {
            const el = document.querySelector(".react-flow") as HTMLElement | null;
            if (el) return resolve(el);
            if (Date.now() > deadline) return resolve(null);
            setTimeout(check, 80);
          }
          check();
        });

        if (flowEl) {
          try {
            // Scroll element into view so html2canvas can capture it
            flowEl.scrollIntoView({ block: "nearest" });
            await new Promise((r) => requestAnimationFrame(r));
            await new Promise((r) => setTimeout(r, 200));

            const canvas = await html2canvas(flowEl, {
              backgroundColor: "#ffffff",
              scale: 1.5,
              logging: false,
              useCORS: true,
              allowTaint: true,
              foreignObjectRendering: false,
              windowWidth: flowEl.scrollWidth,
              windowHeight: flowEl.scrollHeight,
            });
            const imgData = canvas.toDataURL("image/png");
            const imgH = Math.min((canvas.height / canvas.width) * CW, H - 2 * M - 20);
            pdf.addPage();
            y = M;
            sectionHeading("Flowchart");
            newPageIfNeeded(imgH);
            pdf.addImage(imgData, "PNG", M, y, CW, imgH);
          } catch {
            // Capture failed — skip silently
          }
        }

        if (needSwitch) setActiveTab(prevTab);
      }

      pdf.save(`${safeName(meeting.title)}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
      if (needSwitch) setActiveTab(prevTab);
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleShare() {
    setOpen(false);
    setShareState("loading");
    try {
      const url = await onShare();
      await navigator.clipboard.writeText(url);
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 2500);
    } catch (err) {
      console.error("Share link failed:", err);
      setShareState("idle");
    }
  }

  const shareLabel =
    shareState === "loading" ? "Generating…"
    : shareState === "copied" ? "Link copied!"
    : "Share as link";

  return (
    <div ref={menuRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={pdfLoading || shareState === "loading"}
        className={`flex items-center gap-1.5 rounded-lg text-sm font-medium
          bg-secondary hover:bg-secondary/80 text-foreground border border-border
          transition-colors disabled:opacity-50
          ${iconOnly ? "p-2" : "px-3 py-1.5"}`}
        aria-label="Export"
      >
        {shareState === "copied" ? (
          <Check className="w-4 h-4 text-green-600" />
        ) : (
          <Download className={`w-4 h-4 ${pdfLoading ? "animate-bounce" : ""}`} />
        )}
        {!iconOnly && (pdfLoading ? "Exporting…" : shareState !== "idle" ? shareLabel : "Export")}
        {!iconOnly && !pdfLoading && shareState === "idle" && <ChevronDown className="w-3.5 h-3.5 opacity-60" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-xl
          shadow-lg z-50 overflow-hidden py-1">
          <button
            type="button"
            onClick={handleExportPDF}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-foreground
              hover:bg-secondary/60 transition-colors"
          >
            <Download className="w-4 h-4 text-muted-foreground" />
            Export as PDF
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-foreground
              hover:bg-secondary/60 transition-colors"
          >
            <Link2 className="w-4 h-4 text-muted-foreground" />
            Share as link
          </button>
        </div>
      )}
    </div>
  );
}
