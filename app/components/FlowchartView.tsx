"use client";

import { useCallback, useMemo, useState } from "react";
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
import { RefreshCw } from "lucide-react";
import type { Meeting } from "@/types";

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

const NODE_W = 170;
const NODE_H = 48;
const NODE_SEP = 40;   // horizontal gap between siblings
const RANK_SEP = 80;   // vertical gap between levels

function buildLayoutedElements(raw: FlowData): { nodes: Node[]; edges: Edge[] } {
  // Build child/parent adjacency (preserving JSON edge order for sibling ordering)
  const childrenOf = new Map<string, string[]>();
  const parentsOf  = new Map<string, Set<string>>();
  for (const n of raw.nodes) { childrenOf.set(n.id, []); parentsOf.set(n.id, new Set()); }
  for (const e of raw.edges) {
    childrenOf.get(e.source)?.push(e.target);
    parentsOf.get(e.target)?.add(e.source);
  }

  // Use Dagre only for y (rank) assignment
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: RANK_SEP, nodesep: NODE_SEP });
  raw.nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  raw.edges.forEach((e) => g.setEdge(e.source, e.target));
  Dagre.layout(g);

  const dagreY = new Map(raw.nodes.map((n) => [n.id, g.node(n.id).y]));

  // Compute the minimum subtree width needed to lay out each subtree without overlap
  const subtreeW = new Map<string, number>();
  function computeSubtreeW(id: string, visited = new Set<string>()): number {
    if (visited.has(id)) return NODE_W; // cycle guard
    visited.add(id);
    const kids = childrenOf.get(id) ?? [];
    if (kids.length === 0) { subtreeW.set(id, NODE_W); return NODE_W; }
    const total = kids.reduce((sum, k) => sum + computeSubtreeW(k, visited), 0)
      + (kids.length - 1) * NODE_SEP;
    const w = Math.max(NODE_W, total);
    subtreeW.set(id, w);
    return w;
  }

  // Roots = nodes with no parents
  const roots = raw.nodes.filter((n) => parentsOf.get(n.id)!.size === 0).map((n) => n.id);
  roots.forEach((r) => computeSubtreeW(r));

  // Top-down x assignment: each parent centres itself over its children
  const nodeX = new Map<string, number>();
  function assignX(id: string, leftEdge: number, visited = new Set<string>()) {
    if (visited.has(id)) return;
    visited.add(id);
    const w = subtreeW.get(id) ?? NODE_W;
    nodeX.set(id, leftEdge + w / 2);
    const kids = childrenOf.get(id) ?? [];
    let cursor = leftEdge;
    for (const kid of kids) {
      assignX(kid, cursor, visited);
      cursor += (subtreeW.get(kid) ?? NODE_W) + NODE_SEP;
    }
  }

  let rootCursor = 0;
  for (const root of roots) {
    assignX(root, rootCursor);
    rootCursor += (subtreeW.get(root) ?? NODE_W) + NODE_SEP * 2;
  }

  // Fall back to Dagre x for any node not reached (disconnected / multi-root DAG)
  const nodes: Node[] = raw.nodes.map((n) => {
    const dagrePos = g.node(n.id);
    return {
      id: n.id,
      type: "flowNode",
      position: {
        x: (nodeX.get(n.id) ?? dagrePos.x) - NODE_W / 2,
        y: dagreY.get(n.id)! - NODE_H / 2,
      },
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
    nodeType === "start"
      ? "bg-violet-100 border-violet-300 text-violet-700"
      : nodeType === "end"
      ? "bg-emerald-100 border-emerald-300 text-emerald-700"
      : nodeType === "decision"
      ? "bg-amber-100 border-amber-300 text-amber-700"
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

interface Props {
  meeting: Meeting;
  onRegenerate: () => Promise<void>;
  hasApiKey: boolean;
}

export default function FlowchartView({ meeting, onRegenerate, hasApiKey }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flowData = useMemo(() => parseFlow(meeting.flow ?? ""), [meeting.flow]);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => (flowData ? buildLayoutedElements(flowData) : { nodes: [], edges: [] }),
    [flowData]
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const handleRegenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await onRegenerate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate");
    } finally {
      setLoading(false);
    }
  }, [onRegenerate]);

  const isOldFormat = !flowData && meeting.flow && meeting.flow.trim().startsWith("flowchart");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Auto-generated from meeting content</p>
        {hasApiKey && (
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
              bg-secondary hover:bg-secondary/80 text-foreground border border-border
              transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Regenerating…" : "Regenerate"}
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {isOldFormat && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
          This flowchart uses the old format. Click Regenerate to update.
        </div>
      )}

      {flowData && nodes.length > 0 ? (
        <div className="w-full rounded-xl border border-border overflow-hidden" style={{ height: "min(460px, 65vh)" }}>
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
      ) : (
        !isOldFormat && (
          <div className="flex items-center justify-center h-48 rounded-xl bg-secondary/60 text-muted-foreground text-sm border border-border">
            No flowchart yet{hasApiKey ? " — click Regenerate to create one" : ""}
          </div>
        )
      )}
    </div>
  );
}
