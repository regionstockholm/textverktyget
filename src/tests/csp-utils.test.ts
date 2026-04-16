import test from "node:test";
import assert from "node:assert/strict";
import { generateCSPDirectives } from "../utils/security/csp-utils.js";

test("generateCSPDirectives includes nonce and core restrictive directives", () => {
  const nonce = "test-nonce";
  const csp = generateCSPDirectives(nonce);

  assert.equal(csp.includes("default-src 'self'"), true);
  assert.equal(csp.includes(`script-src 'self' 'nonce-${nonce}'`), true);
  assert.equal(csp.includes("object-src 'none'"), true);
  assert.equal(csp.includes("frame-ancestors 'none'"), true);
  assert.equal(csp.includes("form-action 'self'"), true);
});
