import type { Response } from "express";

async function writeChunk(res: Response, chunk: string): Promise<void> {
  if (res.destroyed) throw new Error("Export disconnected");
  if (res.write(chunk)) return;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => { res.off("drain", drained); res.off("close", closed); res.off("error", failed); };
    const drained = () => { cleanup(); resolve(); };
    const closed = () => { cleanup(); reject(new Error("Export disconnected")); };
    const failed = (error: Error) => { cleanup(); reject(error); };
    res.once("drain", drained); res.once("close", closed); res.once("error", failed);
  });
}

export async function downloadCsv(res: Response, chunks: AsyncGenerator<string>, filename: string): Promise<void> {
  try {
    // Validate the database before starting the download.
    const first = await chunks.next();
    res.type("text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    if (first.value) await writeChunk(res, first.value);
    for await (const chunk of chunks) await writeChunk(res, chunk);
    res.end();
  } finally { await chunks.return(undefined); }
}
