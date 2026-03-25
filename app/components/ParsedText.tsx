"use client";

import { useState } from "react";
import { parseMarkup } from "@/lib/parser";
import type { Token } from "@/types";

interface ZhTooltipProps {
  english: string;
  chinese: string;
}

function ZhTooltip({ english, chinese }: ZhTooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        className="underline decoration-amber-400 decoration-2 underline-offset-2 text-amber-300 cursor-pointer hover:text-amber-200 transition-colors"
        onClick={() => setVisible((v) => !v)}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        aria-label={`Mandarin: ${chinese}`}
      >
        {english}
      </button>
      {visible && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none
            bg-zinc-800 border border-amber-400/40 rounded-lg px-3 py-2 shadow-xl
            text-sm whitespace-nowrap flex flex-col items-center gap-0.5"
          role="tooltip"
        >
          <span className="text-amber-300 font-medium">{chinese}</span>
          <span className="text-zinc-400 text-xs">Mandarin</span>
          {/* Tooltip arrow */}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800" />
        </span>
      )}
    </span>
  );
}

interface ParsedTextProps {
  text: string;
  className?: string;
}

/**
 * Renders utterance text with zh/sg markup into styled interactive elements.
 * - [zh|english|中文][/zh] → amber underline with tooltip showing Chinese characters
 * - [sg]text[/sg] → pink highlight for Singlish slang
 */
export default function ParsedText({ text, className }: ParsedTextProps) {
  const tokens: Token[] = parseMarkup(text);

  return (
    <span className={className}>
      {tokens.map((token, i) => {
        switch (token.type) {
          case "text":
            return <span key={i}>{token.value}</span>;
          case "zh":
            return (
              <ZhTooltip key={i} english={token.english} chinese={token.chinese} />
            );
          case "sg":
            return (
              <span
                key={i}
                className="text-pink-400 font-medium"
                title="Singlish"
              >
                {token.value}
              </span>
            );
        }
      })}
    </span>
  );
}
