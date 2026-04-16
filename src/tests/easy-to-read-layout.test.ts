import test from "node:test";
import assert from "node:assert/strict";
import { formatEasyToReadLayout } from "../services/summarize/easy-to-read-layout.js";

const baseOptions = {
  enabled: true,
  maxLineChars: 48,
  maxLinesPerParagraph: 4,
};

test("formatEasyToReadLayout wraps long lines and inserts paragraph spacing", () => {
  const input =
    "Det här är en lång mening som behöver delas upp i kortare rader för att bli lättare att läsa för fler personer. " +
    "Därför ska formatsteget skapa tydliga radbrytningar och hålla en jämn rytm.";

  const output = formatEasyToReadLayout(input, baseOptions);
  const lines = output.split("\n").filter((line) => line.trim().length > 0);

  assert.ok(lines.length >= 3);
  assert.ok(lines.every((line) => line.length <= 48));
});

test("formatEasyToReadLayout keeps short headings on single line", () => {
  const input = "Hur ansöker jag?\n\nDu ansöker genom att fylla i formuläret.";
  const output = formatEasyToReadLayout(input, baseOptions);
  const firstParagraph = output.split("\n\n")[0];

  assert.equal(firstParagraph, "Hur ansöker jag?");
});

test("formatEasyToReadLayout preserves bullet structure", () => {
  const input = "- Första punkten är ganska lång och behöver delas upp i fler rader för att bli tydlig\n- Andra punkten";
  const output = formatEasyToReadLayout(input, baseOptions);

  assert.match(output, /^- /m);
  assert.match(output, /^  /m);
});

test("formatEasyToReadLayout can be disabled", () => {
  const input = "Rad ett\nRad två";
  const output = formatEasyToReadLayout(input, {
    ...baseOptions,
    enabled: false,
  });

  assert.equal(output, input);
});
