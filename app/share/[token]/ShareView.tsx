"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import Dagre from "@dagrejs/dagre";
import "@xyflow/react/dist/style.css";
import type { Meeting } from "@/types";
import ParsedText from "@/app/components/ParsedText";

// ── Flowchart helpers (same as FlowchartView) ─────────────────────────────────

interface RawNode { id: string; label: string; type?: string }
interface RawEdge { source: string; target: string; label?: string; id?: string }
interface FlowData { nodes: RawNode[]; edges: RawEdge[] }

function parseFlow(flow: string): FlowData | null {
  try {
    const data = JSON.parse(flow) as FlowData;
    if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) return null;
    return data;
  } catch {
    return null;
  }
}

function buildLayoutedElements(raw: FlowData): { nodes: Node[]; edges: Edge[] } {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: 60, nodesep: 50 });
  raw.nodes.forEach((n) => g.setNode(n.id, { width: 170, height: 48 }));
  raw.edges.forEach((e) => g.setEdge(e.source, e.target));
  Dagre.layout(g);

  const nodes: Node[] = raw.nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      id: n.id,
      type: "flowNode",
      position: { x: pos.x - 85, y: pos.y - 24 },
      data: { label: n.label, nodeType: n.type ?? "step" },
    };
  });
  const edges: Edge[] = raw.edges.map((e, i) => ({
    id: e.id ?? `e-${i}`,
    source: e.source,
    target: e.target,
    label: e.label,
    type: "smoothstep",
    style: { stroke: "hsl(258 89% 62% / 0.55)", strokeWidth: 1.5 },
    labelStyle: { fontSize: 10, fill: "#888" },
    labelBgStyle: { fill: "white", fillOpacity: 0.8 },
  }));
  return { nodes, edges };
}

function FlowNode({ data }: { data: { label: string; nodeType?: string } }) {
  const { nodeType = "step" } = data;
  const cls =
    nodeType === "start" ? "bg-violet-100 border-violet-300 text-violet-700"
    : nodeType === "end" ? "bg-emerald-100 border-emerald-300 text-emerald-700"
    : nodeType === "decision" ? "bg-amber-100 border-amber-300 text-amber-700"
    : "bg-white border-gray-200 text-gray-700";
  return (
    <div className={`px-3 py-2.5 rounded-lg border text-[11px] font-medium text-center w-[170px] leading-snug shadow-sm ${cls}`}>
      <Handle type="target" position={Position.Top} style={{ background: "#d1d5db", width: 6, height: 6, border: "none" }} />
      {data.label}
      <Handle type="source" position={Position.Bottom} style={{ background: "#d1d5db", width: 6, height: 6, border: "none" }} />
    </div>
  );
}

const NODE_TYPES: NodeTypes = { flowNode: FlowNode };

function FlowChart({ flow }: { flow: string }) {
  const flowData = useMemo(() => parseFlow(flow), [flow]);
  const { nodes: initNodes, edges: initEdges } = useMemo(
    () => (flowData ? buildLayoutedElements(flowData) : { nodes: [], edges: [] }),
    [flowData]
  );
  const [nodes, , onNodesChange] = useNodesState(initNodes);
  const [edges, , onEdgesChange] = useEdgesState(initEdges);

  if (!flowData || nodes.length === 0) return null;

  return (
    <div className="w-full rounded-xl border border-gray-200 overflow-hidden" style={{ height: 460 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

// ── Share page ─────────────────────────────────────────────────────────────────

const LANG_LABELS: Record<string, string> = { en: "English", zh: "Mandarin", sg: "Singlish", ms: "Malay" };

export default function ShareView({ meeting }: { meeting: Meeting }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-violet-700 text-white px-6 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-3 text-violet-300 text-xs font-medium uppercase tracking-widest">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2.414a2 2 0 01.586-1.414z" />
            </svg>
            MeetingMind · Shared Meeting
          </div>
          <h1 className="text-2xl font-bold">{meeting.title}</h1>
          <p className="text-violet-200 text-sm mt-1">{meeting.date} · {meeting.duration}</p>
          {meeting.languages.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {meeting.languages.map((l) => (
                <span key={l} className="px-2 py-0.5 rounded-full bg-violet-500/40 text-violet-100 text-xs font-medium">
                  {LANG_LABELS[l] ?? l}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-10">

        {/* Summary */}
        {meeting.summary && (
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-violet-500 inline-block" />
              Summary
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{meeting.summary}</p>
          </section>
        )}

        {/* Action Items */}
        {meeting.actions.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-violet-500 inline-block" />
              Action Items
            </h2>
            <ol className="space-y-2">
              {meeting.actions.map((a, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center text-xs font-bold
                    ${a.done ? "bg-emerald-100 border-emerald-300 text-emerald-600" : "border-gray-300 text-gray-400"}`}>
                    {a.done ? "✓" : i + 1}
                  </span>
                  <span className={`flex-1 ${a.done ? "line-through text-gray-400" : "text-gray-700"}`}>
                    {a.text}
                    {a.owner && (
                      <span className="ml-2 text-gray-400 not-italic">— {a.owner}</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Flowchart */}
        {meeting.flow && (
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-violet-500 inline-block" />
              Flowchart
            </h2>
            <FlowChart flow={meeting.flow} />
          </section>
        )}

        {/* Transcript */}
        {meeting.transcript.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-violet-500 inline-block" />
              Transcript
            </h2>
            <div className="space-y-4">
              {meeting.transcript.map((u, i) => {
                const name = meeting.speakers[u.s] ?? u.s;
                return (
                  <div key={i} className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-700">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-xs font-semibold text-violet-700">{name}</span>
                        <span className="text-xs text-gray-400">{u.t}</span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        <ParsedText text={u.text} />
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <footer className="pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
          Generated by MeetingMind · Read-only shared view
        </footer>
      </main>
    </div>
  );
}
