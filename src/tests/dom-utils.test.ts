import test from "node:test";
import assert from "node:assert/strict";
import { updateElementContent } from "../client/ui/utils/dom.js";

test("updateElementContent uses textContent and supports clearing", () => {
  const element = {
    textContent: "",
    innerHTML: "",
  } as unknown as Element;

  const payload = "<img src=x onerror=alert(1)>";
  const setResult = updateElementContent(element, payload);
  assert.equal(setResult, true);
  assert.equal((element as unknown as { textContent: string }).textContent, payload);
  assert.equal((element as unknown as { innerHTML: string }).innerHTML, "");

  const clearResult = updateElementContent(element, "");
  assert.equal(clearResult, true);
  assert.equal((element as unknown as { textContent: string }).textContent, "");
});
