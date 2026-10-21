import { createHash } from "node:crypto";
import { join } from "node:path";
import { safeReadFile } from "./file-reader.js";

// A new app process/image computes a new URL when its bundled script changes.
const versions = new Map<string, Promise<string>>();

export async function versionAdminScript(html: string, name: "admin-ui" | "admin-login"): Promise<string> {
  const path = join(process.cwd(), "public", "script", `${name}.js`);
  let version = versions.get(path);
  if (!version) {
    version = safeReadFile(path, "utf8").then(content => createHash("sha256").update(content).digest("hex").slice(0, 16));
    versions.set(path, version);
    // Allow a retry if the build has not completed yet in local development.
    void version.catch(() => versions.delete(path));
  }
  return html.replace(`/script/${name}.js`, `/script/${name}.js?v=${await version}`);
}
