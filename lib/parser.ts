import type { Token } from "@/types";

/**
 * Parses utterance text containing [zh|english][/zh] and [sg]text[/sg] markup.
 *
 * [zh|...][/zh] — Mandarin translated to English by Claude. Optionally may
 * still contain a legacy pipe-separated Chinese field which is ignored.
 * [sg]...[/sg]  — Singlish slang, rendered in pink.
 */
export function parseMarkup(input: string): Token[] {
  const tokens: Token[] = [];
  // Matches [zh|english][/zh], [zh|english|chinese][/zh] (legacy), or [sg]...[/sg]
  const pattern = /\[zh\|([^|\]]+)(?:\|[^\]]+)?\]\[\/zh\]|\[sg\]([\s\S]*?)\[\/sg\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: input.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined) {
      // zh token — only english translation, chinese field ignored
      tokens.push({ type: "zh", english: match[1], chinese: "" });
    } else if (match[2] !== undefined) {
      tokens.push({ type: "sg", value: match[2] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < input.length) {
    tokens.push({ type: "text", value: input.slice(lastIndex) });
  }

  return tokens;
}
