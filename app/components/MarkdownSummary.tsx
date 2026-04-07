"use client";

/** Lightweight markdown renderer — handles ##/### headings, -, 1. lists, **bold** */
export default function MarkdownSummary({ text }: { text: string }) {
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
          ? <h3 key={elements.length} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-5 mb-1.5 first:mt-0">{title}</h3>
          : <h4 key={elements.length} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70 mt-4 mb-1">{title}</h4>
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
