import { Fragment } from "react";

/** Lightweight markdown: **bold**, bullet lines, numbered lines, paragraphs. */
export function AssistantMessageContent({ text }: { text: string }) {
  const blocks = text.split(/\n\n+/);

  return (
    <div className="space-y-2">
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        const isList = lines.every((l) => /^\s*([•\-\*]|\d+[\.\)])\s+/.test(l) || l.trim() === "");
        const isSingleBulletBlock = lines.length > 1 && isList;

        if (isSingleBulletBlock) {
          return (
            <ul key={bi} className="list-disc space-y-1.5 ps-4">
              {lines
                .filter((l) => l.trim())
                .map((line, li) => (
                  <li key={li}>{renderInline(line.replace(/^\s*([•\-\*]|\d+[\.\)])\s+/, ""))}</li>
                ))}
            </ul>
          );
        }

        if (lines.length > 1) {
          return (
            <div key={bi} className="space-y-1.5">
              {lines.map((line, li) => (
                <p key={li}>{renderInline(line)}</p>
              ))}
            </div>
          );
        }

        return <p key={bi}>{renderInline(block)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
