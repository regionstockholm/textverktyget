import test from "node:test";
import assert from "node:assert/strict";
import type { NextFunction, Request, Response } from "express";
import { setCacheHeaders } from "../routes/static/middleware/cache-control.js";

function createResponseRecorder(): {
  res: Response;
  headers: Map<string, string>;
} {
  const headers = new Map<string, string>();
  const res = {
    setHeader: (name: string, value: string) => {
      headers.set(name, value);
    },
  } as unknown as Response;

  return { res, headers };
}

test("setCacheHeaders disables caching for API route", () => {
  const req = { path: "/api/summarize-progress/CLI-123" } as Request;
  const { res, headers } = createResponseRecorder();

  let calledNext = false;
  const next: NextFunction = () => {
    calledNext = true;
  };

  setCacheHeaders(req, res, next);

  assert.equal(headers.get("Cache-Control"), "no-store");
  assert.equal(calledNext, true);
});

test("setCacheHeaders keeps long cache for static script assets", () => {
  const req = { path: "/script/app-main.js" } as Request;
  const { res, headers } = createResponseRecorder();

  let calledNext = false;
  const next: NextFunction = () => {
    calledNext = true;
  };

  setCacheHeaders(req, res, next);

  assert.equal(headers.get("Cache-Control"), "public, max-age=86400");
  assert.equal(calledNext, true);
});
