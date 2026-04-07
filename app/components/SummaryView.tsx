"use client";

import type { Meeting } from "@/types";

interface Props {
  meeting: Meeting;
  onToggleAction: (idx: number) => void;
}

/** Lightweight markdown renderer — handles ##/### headings, -, 1. lists, **bold** */
function MarkdownSummary({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;

  function flushList() {
    if (!listItems.length) return;
    if (listType === "ol") {
      elements.push(
        <ol key={elements.length} className="list-decimal list-outside ml-5 space-y-1 mb-2">
          {listItems.map((item, i) => <li key={i} className="text-sm text-foreground/90 leading-relaxed">{renderInline(item)}</li>)}
        </ol>
      );
    } else {
      elements.push(
        <ul key={elements.length} className="list-disc list-outside ml-5 space-y-1 mb-2">
          {listItems.map((item, i) => <li key={i} className="text-sm text-foreground/90 leading-relaxed">{renderInline(item)}</li>)}
        </ul>
      );
    }
    listItems = [];
    listType = null;
  }

  function renderInline(s: string): React.ReactNode {
    // Handle **bold**
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
        : part
    );
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushList(); continue; }

    if (line.startsWith("## ") || line.startsWith("### ")) {
      flushList();
      const level = line.startsWith("### ") ? 3 : 2;
      const title = line.replace(/^#{2,3} /, "");
      elements.push(
        level === 2
          ? <h3 key={elements.length} className="text-sm font-semibold text-foreground mt-5 mb-1.5 first:mt-0">{title}</h3>
          : <h4 key={elements.length} className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4 mb-1">{title}</h4>
      );
      continue;
    }

    const olMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (olMatch) {
      if (listType === "ul") flushList();
      listType = "ol";
      listItems.push(olMatch[2]);
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (listType === "ol") flushList();
      listType = "ul";
      listItems.push(line.slice(2));
      continue;
    }

    flushList();
    elements.push(
      <p key={elements.length} className="text-sm leading-relaxed text-foreground/90 mb-1">{renderInline(line)}</p>
    );
  }
  flushList();

  return <div className="space-y-0">{elements}</div>;
}

export default function SummaryView({ meeting, onToggleAction }: Props) {
  const speakerNames = Object.values(meeting.speakers);
  // Detect whether summary is structured markdown (has ## headings) or legacy plain text
  const isMarkdown = meeting.summary.includes("## ");

  return (
    <div className="space-y-6">
      {/* Summary */}
      <section>
        {!isMarkdown && (
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Summary
          </h3>
        )}
        {isMarkdown
          ? <MarkdownSummary text={meeting.summary} />
          : <p className="text-sm leading-relaxed text-foreground/90">{meeting.summary}</p>
        }
      </section>

      {/* Action items */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Action Items
        </h3>
        <ul className="space-y-2">
          {meeting.actions.map((action, i) => (
            <li
              key={i}
              className="flex items-start gap-3 p-3 rounded-lg bg-secondary/40 hover:bg-secondary/60 transition-colors"
            >
              <button
                type="button"
                onClick={() => onToggleAction(i)}
                className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded border transition-colors ${
                  action.done
                    ? "bg-primary border-primary"
                    : "border-border hover:border-primary"
                }`}
                aria-label={action.done ? "Mark incomplete" : "Mark complete"}
              >
                {action.done && (
                  <svg viewBox="0 0 12 12" className="w-full h-full text-primary-foreground">
                    <polyline
                      points="2,6 5,9 10,3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm ${action.done ? "line-through text-muted-foreground" : "text-foreground"}`}
                >
                  {action.text}
                </p>
                {action.owner && (
                  <p className="text-xs text-muted-foreground mt-0.5">{action.owner}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Speakers */}
      {speakerNames.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Participants
          </h3>
          <div className="flex flex-wrap gap-2">
            {speakerNames.map((name) => (
              <span
                key={name}
                className="px-2.5 py-1 rounded-full bg-secondary text-xs text-foreground/80 border border-border"
              >
                {name}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
