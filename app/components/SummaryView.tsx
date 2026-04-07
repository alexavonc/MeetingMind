"use client";

import type { Meeting } from "@/types";
import MarkdownSummary from "@/app/components/MarkdownSummary";

interface Props {
  meeting: Meeting;
  onToggleAction: (idx: number) => void;
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
