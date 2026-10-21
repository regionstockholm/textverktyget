import { resolve, join } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { generateText } from "../providers/transport.js";
import { catalog, requireModelDefinition } from "../catalog/index.js";
import { defaultsForModel } from "../catalog/defaults.js";
import { normalizeProviderId, assertProviderConfigured } from "../provider-registry.js";

/** Explicit developer command. Never invoked by catalog loading, build or startup. */
export async function runSmoke(args: string[]) {
  const providerArg = args.find(argument => argument.startsWith("--provider="))?.slice(11);
  const modelId = args.find(argument => argument.startsWith("--model="))?.slice(8);
  if (!providerArg || !modelId) throw new Error("Specify --provider=<provider> and --model=<registered ID>");
  const provider = normalizeProviderId(providerArg);
  assertProviderConfigured(provider);
  const model = requireModelDefinition(provider, modelId);
  if (model.deploymentRequired) throw new Error("Deployment profiles must be tested in admin with their actual deployment name");
  const defaults = defaultsForModel(model);
  const grounding = args.includes("--grounding");
  if (grounding && !model.webSearch) throw new Error("This model's adapter does not support grounding");
  const settings = { ...defaults, maxOutputTokens: Math.min(defaults.maxOutputTokens, 2048), useWebSearch: grounding };
  const start = Date.now();
  const text = await generateText(provider, settings, grounding
    ? "Use Google Search to find the official Node.js release schedule and summarize the status of Node.js 22 today in one short Swedish sentence. Use current official nodejs.org sources."
    : "Rewrite this short Swedish sentence in plain language. Return only the rewritten sentence: Vi kommer att genomföra en undersökning av frågan.");
  if (!text.trim()) throw new Error("Empty generation response");
  if (grounding && !text.includes("Källor (Google Search):")) throw new Error("Search-enabled generation returned no grounding sources; actual grounding is not verified");
  const quality = await generateText(provider, settings, "Evaluate the rewritten Swedish sentence for fidelity and plain language. Return a JSON quality report with integer scores 1-10, all six required subscores, and a failures array. Original: Vi kommer att genomföra en undersökning av frågan. Rewritten: " + text, true);
  const report = JSON.parse(quality.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  if (typeof report.overall !== "number" || !report.subscores || !Array.isArray(report.failures)) throw new Error("Invalid live quality report");
  const result = { provider, model: model.id, testedAt: new Date().toISOString(), generation: "passed", qualityJson: "passed", ...(grounding ? { grounding: "passed", groundingSourcesReturned: true } : {}), latencyMs: Date.now() - start, profileCount: catalog.getProvider(provider).models.length };
  const directory = join(process.cwd(), "config/catalog-research/live-tests");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `${provider}-${model.id.replace(/[^a-z0-9.-]/gi, "-")}${grounding ? "-grounding" : ""}.json`), JSON.stringify(result, null, 2) + "\n");
  console.log(result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runSmoke(process.argv.slice(2)).catch(error => { console.error(error instanceof Error ? error.message : "Live smoke test failed"); process.exitCode = 1; });
}
