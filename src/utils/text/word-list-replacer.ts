export interface WordReplacementEntry {
  term: string;
  replacement: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeEntries(
  entries: Iterable<WordReplacementEntry>,
): WordReplacementEntry[] {
  const list: WordReplacementEntry[] = [];

  for (const entry of entries) {
    if (!entry.term || !entry.replacement) {
      continue;
    }

    const term = entry.term.trim();
    const replacement = entry.replacement.trim();
    if (!term || !replacement) {
      continue;
    }

    list.push({ term, replacement });
  }

  return list.sort((a, b) => b.term.length - a.term.length);
}

export function applyWordListReplacements(
  text: string,
  entries: Iterable<WordReplacementEntry>,
): string {
  if (!text) {
    return text;
  }

  const replacements = normalizeEntries(entries);
  if (replacements.length === 0) {
    return text;
  }

  let updated = text;
  const boundary = "(^|[^\\p{L}\\p{N}])";
  const tailBoundary = "(?=$|[^\\p{L}\\p{N}])";

  for (const entry of replacements) {
    const escaped = escapeRegExp(entry.term);
    const regex = new RegExp(`${boundary}(${escaped})${tailBoundary}`, "giu");
    updated = updated.replace(regex, (_match, prefix) => {
      return `${prefix}${entry.replacement}`;
    });
  }

  return updated;
}
