import type { Token } from "@/types";

/**
 * Parses utterance text containing [zh|english][/zh], [ms|english][/ms], and [sg]text[/sg] markup.
 */
export function parseMarkup(input: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /\[zh\|([^|\]]+)(?:\|[^\]]+)?\]\[\/zh\]|\[ms\|([^\]]+)\]\[\/ms\]|\[sg\]([\s\S]*?)\[\/sg\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: input.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined) {
      tokens.push({ type: "zh", english: match[1], chinese: "" });
    } else if (match[2] !== undefined) {
      tokens.push({ type: "ms", english: match[2] });
    } else if (match[3] !== undefined) {
      tokens.push({ type: "sg", value: match[3] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < input.length) {
    tokens.push({ type: "text", value: input.slice(lastIndex) });
  }

  return tokens;
}
