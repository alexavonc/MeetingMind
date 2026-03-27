"use client";

import { parseMarkup } from "@/lib/parser";
import type { Token } from "@/types";

interface ParsedTextProps {
  text: string;
  className?: string;
}

/**
 * Renders utterance text with zh/sg markup.
 * - [zh|English translation][/zh] → amber italic (translated from Mandarin)
 * - [sg]text[/sg] → pink for Singlish slang
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
              <span
                key={i}
                className="text-amber-600 italic"
                title="Translated from Mandarin"
              >
                {token.english}
              </span>
            );
          case "ms":
            return (
              <span key={i} className="text-emerald-700 italic" title="Translated from Malay">
                {token.english}
              </span>
            );
          case "sg":
            return (
              <span key={i} className="text-pink-600 font-medium" title="Singlish">
                {token.value}
              </span>
            );
        }
      })}
    </span>
  );
}
