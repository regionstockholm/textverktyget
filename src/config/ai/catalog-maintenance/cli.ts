import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { collectInventories } from "./collect.js";
import { BUILTIN_PROVIDERS } from "../catalog/index.js";
import { defineModel, validateModelDefinition } from "../catalog/validation.js";
import { PROVIDER_IDS, type ProviderId } from "../catalog/types.js";
import { excludedReason, validRemoteModelId, type ProviderInventory } from "./research.js";
import { withGoogleGrounding } from "../catalog/google-grounding.js";

export function modelFilename(id: string): string {
  const slug = id.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
  return `researched-${slug}-${createHash("sha256").update(id).digest("hex").slice(0, 8)}.ts`;
}

export async function emitInventories(inventories: ProviderInventory[], root: string, apply: boolean) {
  const directory = join(root, "config", "catalog-research");
  await mkdir(directory, { recursive: true });
  for (let inventory of inventories) {
    if (inventory.sourceStatus === "unavailable" || !inventory.records.length) {
      try {
        const previous = JSON.parse(await readFile(join(directory, `${inventory.provider}.json`), "utf8")) as ProviderInventory;
        if (previous.records.length) inventory = { ...previous, sourceStatus: "partial", errors: [...inventory.errors, `Previous snapshot from ${previous.capturedAt} retained after unsuccessful fetch`] };
      } catch { /* No prior snapshot. */ }
    }
    const provider = BUILTIN_PROVIDERS.find(item => item.id === inventory.provider)!;
    const modelFiles: string[] = [];
    for (const record of inventory.records) {
      const newlyExcluded = excludedReason(record.id);
      if (newlyExcluded) { record.disposition = "excluded"; record.reason = newlyExcluded; delete record.definition; }
      if (!record.definition || record.disposition === "excluded") continue;
      if (!validRemoteModelId(inventory.provider, record.id)) { record.disposition = "needs-review"; record.reason = "Source parser did not establish a valid provider model ID"; delete record.definition; continue; }
      const existing = provider.models.find(model => model.id === record.id || model.apiModelId === record.id || model.aliases.includes(record.id));
      if (existing && !existing.metadata.generatedBy) { record.disposition = "existing"; record.reason += "; independently maintained definition retained"; continue; }
      const definition = defineModel(withGoogleGrounding({ ...record.definition, metadata: { ...record.definition.metadata, generatedBy: "catalog-maintenance", sourceHash: inventory.evidence.find(evidence => evidence.url === record.sources[0])?.sha256 } }));
      try {
        const live = JSON.parse(await readFile(join(directory, "live-tests", `${inventory.provider}-${record.id.replace(/[^a-z0-9.-]/gi, "-")}.json`), "utf8"));
        if (live.generation === "passed" && live.qualityJson === "passed") {
          definition.readiness = { adapter: "supported", specifications: definition.limits.verification === "verified" ? "verified" : "conservative", live: "passed" };
          definition.metadata.notes = definition.metadata.notes.replace(/Account access and live generation have not been tested\.\s*/g, "") + ` Live synthetic generation and quality JSON passed ${live.testedAt}; account access can differ between installations.`;
        }
      } catch { /* No live test for this model. */ }
      try { validateModelDefinition(definition); }
      catch (error) { record.disposition = "needs-review"; record.reason = `Definition validation: ${error instanceof Error ? error.message : "failed"}`; continue; }
      if (!apply) continue;
      const filename = modelFilename(record.id);
      const modelDir = join(root, "src/config/ai/catalog/providers", inventory.provider, "models");
      const typeName = `${inventory.provider.charAt(0).toUpperCase()}${inventory.provider.slice(1)}ModelInput`;
      const contents = `// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.\nimport { defineModel } from "../../../validation.js";\nimport type { ${typeName} } from "../types.js";\nexport default defineModel(${JSON.stringify(definition, null, 2)} satisfies ${typeName});\n`;
      await writeFile(join(modelDir, filename), contents);
      modelFiles.push(filename);
    }
    if (apply && modelFiles.length) {
      const providerDir = join(root, "src/config/ai/catalog/providers", inventory.provider);
      // A partial fetch retains previously generated files in its master index; a failed fetch never removes choices.
      const master = join(providerDir, "inventory.ts");
      const previous: string[] = [];
      try { for (const match of (await readFile(master, "utf8")).matchAll(/\.\/models\/(researched-[^"]+\.js)/g)) previous.push(match[1]!.replace(/\.js$/, ".ts")); } catch { /* First snapshot. */ }
      const retained: string[] = [];
      for (const file of previous) {
        try {
          const contents = await readFile(join(providerDir, "models", file), "utf8");
          const input = JSON.parse(contents.match(/defineModel\((\{[\s\S]*\})\s+satisfies/)?.[1] || "null");
          if (input?.metadata?.generatedBy === "catalog-maintenance" && validRemoteModelId(inventory.provider, input.id) && !excludedReason(input.id)) retained.push(file);
        } catch { /* A modified/non-generated file is not managed by this generated master index. */ }
      }
      const files = [...new Set([...retained, ...modelFiles])].sort();
      const imports = files.map((file, index) => `import model${index} from "./models/${file.replace(/\.ts$/, ".js")}";`).join("\n");
      await writeFile(master, `${imports}\nexport default [${files.map((_file, index) => `model${index}`).join(", ")}];\n`);
      const indexFile = join(providerDir, "index.ts");
      let index = await readFile(indexFile, "utf8");
      if (!index.includes('"./inventory.js"')) {
        index = `import researched from "./inventory.js";\n${index.replace(/models: \[([^\]]*)\]/, "models: [$1, ...researched]")}`;
        await writeFile(indexFile, index);
      }
    }
    // Evidence snapshots contain public documentation/model metadata only, never request headers.
    await writeFile(join(directory, `${inventory.provider}.json`), JSON.stringify(inventory, null, 2) + "\n");
  }
  const allInventories: ProviderInventory[] = [];
  for (const provider of PROVIDER_IDS) {
    try { allInventories.push(JSON.parse(await readFile(join(directory, `${provider}.json`), "utf8")) as ProviderInventory); }
    catch { /* Not researched yet. */ }
  }
  const summary = allInventories.map(inventory => ({ provider: inventory.provider, capturedAt: inventory.capturedAt, sourceStatus: inventory.sourceStatus,
    discovered: inventory.records.length, included: inventory.records.filter(record => record.disposition === "included").length,
    existing: inventory.records.filter(record => record.disposition === "existing").length,
    excluded: inventory.records.filter(record => record.disposition === "excluded").length,
    needsReview: inventory.records.filter(record => record.disposition === "needs-review").length, errors: inventory.errors }));
  await writeFile(join(directory, "coverage.json"), JSON.stringify(summary, null, 2) + "\n");
  const markdown = ["# Provider inventory coverage", "", "This is a dated research snapshot, not a claim of account access or live model validation.", "", "| Provider | Source status | Discovered | Added candidates | Existing | Excluded | Review required |", "|---|---|---:|---:|---:|---:|---:|",
    ...summary.map(item => `| ${item.provider} | ${item.sourceStatus} | ${item.discovered} | ${item.included} | ${item.existing} | ${item.excluded} | ${item.needsReview} |`), "", ...summary.filter(item => item.errors.length).flatMap(item => [`## ${item.provider}`, ...item.errors.map(error => `- ${error}`), ""])].join("\n");
  await writeFile(join(directory, "README.md"), markdown + "\n");
  return summary;
}

export async function runMaintenance(args: string[]) {
  const root = process.cwd();
  await access(join(root, "src/config/ai/catalog/providers"));
  const selectedArg = args.find(argument => argument.startsWith("--providers="));
  const selected = selectedArg?.slice("--providers=".length).split(",") as ProviderId[] | undefined;
  if (selected?.some(provider => !PROVIDER_IDS.includes(provider))) throw new Error("Unsupported provider filter");
  let inventories: ProviderInventory[];
  if (args.includes("--from-snapshot")) {
    inventories = await Promise.all((selected || [...PROVIDER_IDS]).map(async provider => JSON.parse(await readFile(join(root, "config/catalog-research", `${provider}.json`), "utf8")) as ProviderInventory));
  } else inventories = await collectInventories(args.includes("--accounts"), selected);
  const summary = await emitInventories(inventories, root, args.includes("--apply"));
  console.table(summary.map(({ errors, ...item }) => ({ ...item, errors: errors.length })));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runMaintenance(process.argv.slice(2)).catch(error => { console.error(error instanceof Error ? error.message : "Catalog maintenance failed"); process.exitCode = 1; });
}
