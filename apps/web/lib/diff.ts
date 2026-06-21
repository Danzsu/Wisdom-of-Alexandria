import type { DiffSegment } from "@/components/kit/diff-pane";

/**
 * Word-level diff for the revision browser (and any before/after view). Produces
 * the two segment arrays {@link DiffPane} consumes: `original` carries equal +
 * deletion runs (the current text), `suggestion` carries equal + addition runs
 * (the revision). Whitespace is kept as its own tokens so the rendered panes
 * reassemble to the exact source text; adjacent same-type tokens are merged into
 * one segment so the DOM stays small.
 */
export interface WordDiff {
  original: DiffSegment[];
  suggestion: DiffSegment[];
}

/** Split into words AND whitespace runs so reassembly is loss-free. */
function tokenize(text: string): string[] {
  return text.match(/\s+|\S+/g) ?? [];
}

function mergePush(
  segments: DiffSegment[],
  type: DiffSegment["type"],
  text: string,
): void {
  const last = segments[segments.length - 1];
  if (last && last.type === type) {
    last.text += text;
  } else {
    segments.push({ type, text } as DiffSegment);
  }
}

export function diffWords(before: string, after: string): WordDiff {
  const a = tokenize(before);
  const b = tokenize(after);
  const n = a.length;
  const m = b.length;

  // LCS length table (bottom-up) — dp[i][j] = LCS of a[i:] and b[j:].
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const original: DiffSegment[] = [];
  const suggestion: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      mergePush(original, "equal", a[i]);
      mergePush(suggestion, "equal", b[j]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      mergePush(original, "deletion", a[i]);
      i++;
    } else {
      mergePush(suggestion, "addition", b[j]);
      j++;
    }
  }
  while (i < n) {
    mergePush(original, "deletion", a[i]);
    i++;
  }
  while (j < m) {
    mergePush(suggestion, "addition", b[j]);
    j++;
  }
  return { original, suggestion };
}
