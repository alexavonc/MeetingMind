import type { Token } from "@/types";

/**
 * Parses utterance text containing [zh|english|中文][/zh] and [sg]text[/sg] markup
 * into an array of typed tokens for rendering.
 *
 * Examples:
 *   "Let's [zh|go eat|去吃饭][/zh] first" → [{text}, {zh}, {text}]
 *   "[sg]lah[/sg] we confirm" → [{sg}, {text}]
 */
export function parseMarkup(input: string): Token[] {
  const tokens: Token[] = [];
  // Matches [zh|english|中文][/zh] or [sg]...[/sg]
  const pattern = /\[zh\|([^|]+)\|([^\]]+)\]\[\/zh\]|\[sg\]([\s\S]*?)\[\/sg\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    // Push any plain text before this match
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: input.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined && match[2] !== undefined) {
      // zh token: [zh|english|chinese][/zh]
      tokens.push({ type: "zh", english: match[1], chinese: match[2] });
    } else if (match[3] !== undefined) {
      // sg token: [sg]...[/sg]
      tokens.push({ type: "sg", value: match[3] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining plain text
  if (lastIndex < input.length) {
    tokens.push({ type: "text", value: input.slice(lastIndex) });
  }

  return tokens;
}
