import type { JSONContent } from "@tiptap/react";

/**
 * Convert a scene's plain-text `content` (backend stores text, splitting on
 * whitespace for word count) into a Tiptap document. Each non-empty line becomes
 * a paragraph; an empty scene yields a single empty paragraph so the editor has
 * a valid, editable doc.
 */
export function textToDoc(content: string | null | undefined): JSONContent {
  const text = content ?? "";
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    })),
  };
}
