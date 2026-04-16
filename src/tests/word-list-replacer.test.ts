import test from "node:test";
import assert from "node:assert/strict";
import { applyWordListReplacements } from "../utils/text/word-list-replacer.js";

test("applyWordListReplacements replaces whole words", () => {
  const entries = [
    { term: "cat", replacement: "dog" },
    { term: "Term", replacement: "Definition" },
  ];

  const text = "A cat and Term appear, but concatenate should not change.";
  const result = applyWordListReplacements(text, entries);

  assert.equal(
    result,
    "A dog and Definition appear, but concatenate should not change.",
  );
});

test("applyWordListReplacements respects unicode boundaries", () => {
  const entries = [{ term: "råd", replacement: "rekommendation" }];
  const text = "Det här är ett råd. rådet är viktigt.";
  const result = applyWordListReplacements(text, entries);

  assert.equal(result, "Det här är ett rekommendation. rådet är viktigt.");
});
