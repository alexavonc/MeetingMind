"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import type { Meeting } from "@/types";

function clean(text: string) {
  return text
    .replace(/\[zh\|([^\]]+)\]\[\/zh\]/g, "$1")
    .replace(/\[sg\]([\s\S]*?)\[\/sg\]/g, "$1");
}

function safeName(title: string) {
  return title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_") || "meeting";
}

export default function ExportButton({ meeting }: { meeting: Meeting }) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      // Dynamic imports — keeps these heavy libs out of the initial bundle
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210, H = 297, M = 18;
      const CW = W - 2 * M;
      let y = M;

      // ── Helpers ──────────────────────────────────────────────────────────

      function newPageIfNeeded(needed: number) {
        if (y + needed > H - M) { pdf.addPage(); y = M; }
      }

      function sectionHeading(text: string) {
        newPageIfNeeded(12);
        pdf.setFontSize(13);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(30, 30, 30);
        pdf.text(text, M, y);
        y += 7;
        // Underline
        pdf.setDrawColor(220, 220, 230);
        pdf.setLineWidth(0.3);
        pdf.line(M, y - 2, W - M, y - 2);
        y += 3;
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

      // ── Cover ─────────────────────────────────────────────────────────────

      // Violet header bar
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

      // Language badges (text)
      if (meeting.languages.length > 0) {
        const badgeMap: Record<string, string> = { en: "English", zh: "Mandarin", sg: "Singlish" };
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(120, 100, 200);
        pdf.text(meeting.languages.map((l) => badgeMap[l] ?? l).join("  ·  "), M, y);
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
          const check = a.done ? "✓" : "○";
          const owner = a.owner ? `  —  ${a.owner}` : "";
          // Bullet number + checkbox symbol
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(a.done ? 100 : 30, a.done ? 100 : 30, a.done ? 100 : 30);
          pdf.text(`${i + 1}.  ${check}`, M, y);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(a.done ? 130 : 50, a.done ? 130 : 50, a.done ? 130 : 50);
          const itemLines = pdf.splitTextToSize(`${clean(a.text)}${owner}`, CW - 12) as string[];
          itemLines.forEach((line, li) => {
            newPageIfNeeded(6);
            pdf.text(line, M + 12, y + li * 5);
          });
          y += itemLines.length * 5 + 3;
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

        // Speaker + timestamp label
        pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(109, 40, 217);
        pdf.text(`${name}`, M, y);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(160, 140, 200);
        pdf.text(`[${u.t}]`, M + pdf.getTextWidth(`${name} `), y);
        y += 5;

        bodyText(u.text, 9);
        y += 3;
      });

      // ── Flowchart ─────────────────────────────────────────────────────────

      if (meeting.flow) {
        const flowEl = document.querySelector(".react-flow") as HTMLElement | null;
        if (flowEl) {
          try {
            const canvas = await html2canvas(flowEl, {
              backgroundColor: "#ffffff",
              scale: 2,
              logging: false,
              useCORS: true,
            });
            const imgData = canvas.toDataURL("image/png");
            const imgH = Math.min((canvas.height / canvas.width) * CW, H - 2 * M - 20);

            pdf.addPage();
            y = M;
            sectionHeading("Flowchart");
            newPageIfNeeded(imgH);
            pdf.addImage(imgData, "PNG", M, y, CW, imgH);
          } catch {
            // Flowchart capture failed — skip silently
          }
        } else {
          // React Flow not currently rendered (user not on flowchart tab)
          pdf.addPage();
          y = M;
          sectionHeading("Flowchart");
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "italic");
          pdf.setTextColor(140, 140, 140);
          pdf.text("Open the Flowchart tab and re-export to include the flowchart diagram.", M, y);
        }
      }

      pdf.save(`${safeName(meeting.title)}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
        bg-secondary hover:bg-secondary/80 text-foreground border border-border
        transition-colors disabled:opacity-50 flex-shrink-0"
    >
      <Download className={`w-4 h-4 ${loading ? "animate-bounce" : ""}`} />
      {loading ? "Exporting…" : "Export PDF"}
    </button>
  );
}
