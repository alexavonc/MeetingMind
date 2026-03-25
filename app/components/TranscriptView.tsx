"use client";

import ParsedText from "./ParsedText";
import type { Meeting } from "@/types";

interface Props {
  meeting: Meeting;
}

const SPEAKER_COLORS = [
  "text-blue-400",
  "text-emerald-400",
  "text-violet-400",
  "text-orange-400",
];

export default function TranscriptView({ meeting }: Props) {
  const speakerKeys = Object.keys(meeting.speakers);

  return (
    <div className="space-y-4">
      {/* Speaker legend */}
      <div className="flex flex-wrap gap-3 pb-3 border-b border-border">
        {speakerKeys.map((key, i) => (
          <span key={key} className="flex items-center gap-1.5 text-sm">
            <span
              className={`inline-block w-2 h-2 rounded-full bg-current ${SPEAKER_COLORS[i % SPEAKER_COLORS.length]}`}
            />
            <span className={`font-medium ${SPEAKER_COLORS[i % SPEAKER_COLORS.length]}`}>
              {meeting.speakers[key]}
            </span>
          </span>
        ))}
      </div>

      {/* Utterances */}
      <div className="space-y-3">
        {meeting.transcript.map((utterance, idx) => {
          const speakerIdx = speakerKeys.indexOf(utterance.s);
          const colorClass = SPEAKER_COLORS[speakerIdx % SPEAKER_COLORS.length];
          const name = meeting.speakers[utterance.s] ?? utterance.s;

          return (
            <div key={idx} className="flex gap-3">
              <div className="flex-shrink-0 flex flex-col items-end gap-0.5 pt-0.5 w-24">
                <span className={`text-xs font-semibold ${colorClass}`}>
                  {name.split(" ")[0]}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {utterance.t}
                </span>
              </div>
              <div className="flex-1 text-sm leading-relaxed text-foreground/90">
                <ParsedText text={utterance.text} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
