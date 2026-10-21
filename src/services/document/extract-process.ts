import { getTextExtractor } from "office-text-extractor";
import { assertBoundedOfficeArchive } from "./archive-limits.js";

// Keep library diagnostics out of the text-only stdout protocol.
console.log = console.error;
try {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > 100 * 1024 * 1024) throw new Error("Document too large");
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  assertBoundedOfficeArchive(buffer);
  const text = await getTextExtractor().extractText({ input: buffer, type: "buffer" });
  if (typeof text !== "string" || Buffer.byteLength(text) > 20 * 1024 * 1024) throw new Error("Extracted text exceeds 20 MiB");
  process.stdout.write(text);
} catch {
  process.stderr.write("Document extraction failed or exceeded safety limits\n");
  process.exitCode = 1;
}
