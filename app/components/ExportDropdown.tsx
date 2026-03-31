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
  onShare: () => Promise<string>;
  iconOnly?: boolean;
}

export default function ExportDropdown({ meeting, onShare, iconOnly = false }: Props) {
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

    try {
      const { default: jsPDF } = await import("jspdf");
      const Dagre = await import("@dagrejs/dagre");

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

      // ── Flowchart (drawn natively with jsPDF + Dagre — no DOM capture) ────
      if (meeting.flow) {
        try {
          const raw = JSON.parse(meeting.flow) as {
            nodes: { id: string; label: string; type?: string }[];
            edges: { source: string; target: string; label?: string }[];
          };
          if (raw.nodes?.length) {
            const NODE_W = 155, NODE_H = 42;
            const g = new Dagre.default.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
            g.setGraph({ rankdir: "TB", ranksep: 52, nodesep: 42 });
            raw.nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
            raw.edges.forEach((e) => g.setEdge(e.source, e.target));
            Dagre.default.layout(g);

            // Bounding box of the graph
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            raw.nodes.forEach((n) => {
              const p = g.node(n.id);
              minX = Math.min(minX, p.x - NODE_W / 2);
              maxX = Math.max(maxX, p.x + NODE_W / 2);
              minY = Math.min(minY, p.y - NODE_H / 2);
              maxY = Math.max(maxY, p.y + NODE_H / 2);
            });

            const graphW = maxX - minX;
            const graphH = maxY - minY;
            // Scale to fit the content width; cap height at two-thirds of the page body
            const scale = Math.min(CW / graphW, (H - 2 * M - 40) * 0.65 / graphH);
            const drawW = graphW * scale;
            const drawH = graphH * scale;

            pdf.addPage();
            y = M;
            sectionHeading("Flowchart");

            const ox = M + (CW - drawW) / 2; // centre horizontally
            const oy = y;

            const toX = (px: number) => ox + (px - minX) * scale;
            const toY = (py: number) => oy + (py - minY) * scale;

            // Draw edges
            raw.edges.forEach((e) => {
              const src = g.node(e.source);
              const tgt = g.node(e.target);
              if (!src || !tgt) return;
              const x1 = toX(src.x), y1 = toY(src.y + NODE_H / 2);
              const x2 = toX(tgt.x), y2 = toY(tgt.y - NODE_H / 2);
              pdf.setDrawColor(180, 150, 230);
              pdf.setLineWidth(0.35);
              pdf.line(x1, y1, x2, y2);
              // Arrowhead
              const ang = Math.atan2(y2 - y1, x2 - x1);
              const aw = 1.8;
              pdf.line(x2, y2, x2 - aw * Math.cos(ang - 0.45), y2 - aw * Math.sin(ang - 0.45));
              pdf.line(x2, y2, x2 - aw * Math.cos(ang + 0.45), y2 - aw * Math.sin(ang + 0.45));
              // Edge label
              if (e.label) {
                pdf.setFontSize(6.5);
                pdf.setTextColor(130, 100, 190);
                pdf.text(e.label, (x1 + x2) / 2, (y1 + y2) / 2 - 1, { align: "center" });
              }
            });

            // Draw nodes
            raw.nodes.forEach((n) => {
              const pos = g.node(n.id);
              if (!pos) return;
              const nx = toX(pos.x - NODE_W / 2);
              const ny = toY(pos.y - NODE_H / 2);
              const nw = NODE_W * scale;
              const nh = NODE_H * scale;
              // Fill + border colour by type
              if (n.type === "start")         { pdf.setFillColor(237, 233, 254); pdf.setDrawColor(139, 92, 246); }
              else if (n.type === "end")      { pdf.setFillColor(209, 250, 229); pdf.setDrawColor(52, 211, 153); }
              else if (n.type === "decision") { pdf.setFillColor(254, 249, 195); pdf.setDrawColor(234, 179, 8); }
              else                            { pdf.setFillColor(248, 250, 252); pdf.setDrawColor(200, 200, 215); }
              pdf.setLineWidth(0.3);
              pdf.roundedRect(nx, ny, nw, nh, 2, 2, "FD");
              // Label
              pdf.setFontSize(7.5);
              pdf.setFont("helvetica", "bold");
              pdf.setTextColor(45, 25, 75);
              const lines = pdf.splitTextToSize(n.label, nw - 4) as string[];
              const lh = 3.4;
              const totalTH = lines.length * lh;
              lines.forEach((line, li) => {
                pdf.text(line, nx + nw / 2, ny + (nh - totalTH) / 2 + (li + 0.85) * lh, { align: "center" });
              });
            });

            y = oy + drawH + 10;
          }
        } catch {
          // Skip flowchart if JSON is malformed
        }
      }

      pdf.save(`${safeName(meeting.title)}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
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
