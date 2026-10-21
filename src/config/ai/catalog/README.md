# Local model catalog

The catalog is the single source of truth for model identity, generation limits,
capabilities, defaults, lifecycle and request parameter policies. It makes no
HTTP requests. Provider credentials and connection configuration remain in `.env`.

## Structure

Each of the 18 providers has:

- `provider.ts`: identity, label, environment key name, API base and explicit default profile ID.
- `types.ts`: provider-specific model input type, narrowing the allowed reasoning policies.
- `model.template.ts`: unregistered draft template to copy when adding a model.
- `models/*.ts`: one independently maintained definition per model/profile.
- `index.ts`: explicit master index importing the registered model files.

The root `index.ts` composes provider indexes and validated local JSON overrides.
`types.ts`, `validation.ts` and `defaults.ts` provide the shared contract and helpers.
The admin UI receives metadata and calculated defaults from the backend; it does
not infer limits or capabilities from model-name patterns.

## Full inventory maintenance

`catalog-maintenance/sources.ts` records each provider's authoritative inventory,
model API and lifecycle sources. `collect.ts` reads official model pages, tables,
and public serving APIs; read-only authenticated inventories are optional. No
runtime module imports this tooling. Research snapshots live under
`config/catalog-research/` and are excluded from Docker runtime images.

Build the Docker tooling image and run research from the project directory:

```sh
docker build --target test -t textverktyget-tests .
docker run --rm --env-file .env -v "./src:/app/src" -v "./config:/app/config" textverktyget-tests node dist/config/ai/catalog-maintenance/cli.js
```

`--accounts` additionally uses configured environment credentials for read-only
model listing. Request headers and API keys are never saved in snapshots.
`--providers=<comma-separated IDs>` selects sources.
`--from-snapshot --apply` emits one typed `researched-*.ts` file per eligible model
and an explicit `inventory.ts` master index. Independently maintained model files
and external custom overrides remain authoritative and are not overwritten.

The source parser binds token limits to named table columns and individual model
pages. Prices, release dates, logos and documentation headings are not model
limits/IDs. Endpoint-specific router limits use the lower currently active ceilings
where available. Missing ceilings are visibly conservative. Models with unsupported
or insufficiently specified protocols are inventoried with pending readiness and
cannot be activated. Source completeness does not mean live/account verification.

Retained generated definitions are not deleted solely because a fetch fails.
Coverage includes exclusions for media, moderation, embedding and dynamic-router
models. Local models remain installation-specific; this is not an inventory of
every downloadable weights checkpoint. Account/deployment/region restrictions are
separate from model specification and adapter compatibility.

## Add or update a built-in model

1. Copy the provider's `model.template.ts` into `models/<model>.ts`.
2. Export `defineModel({...} satisfies <Provider>ModelInput)`.
3. Fill in limits and request policy from current provider documentation.
4. Register it explicitly in the provider's `index.ts`. Draft templates never appear in the UI.
5. Increment `metadata.revision` when changing a definition and update its review date/notes/sources.
6. Run the Docker test stack (including TypeScript and catalog tests). Rebuild/recreate the app to deploy it.

Adding a model using an already supported request policy does not require an
admin markup or transport change. A genuinely new API policy needs adapter
implementation and tests before enabling that capability.

## Definition fields

| Field | Meaning |
| --- | --- |
| `provider` + `id` | Provider-qualified stable profile identity. |
| `apiModelId` | Model ID sent to the API; aliases such as dated snapshots are preserved when selected. |
| `aliases` | Explicit equivalent identifiers. Never infer equivalent releases from names. |
| `deploymentRequired` | Administrator supplies installed model/deployment name separately. |
| `limits.contextWindow` | Effective combined budget used by the application. |
| `limits.maxInputTokens` | Optional separate input ceiling. |
| `limits.maxOutputTokens` | Output ceiling through this service/adapter, including thinking where applicable. |
| `limits.verification` | `verified`, `conservative`, or `deployment-dependent`. |
| `reasoning` | Explicit request policy; see modes below. |
| `temperature` | `supported`, `unsupported`, or `without-reasoning`. |
| `structuredOutput` | Adapter format: `prompt`, `json-object`, or `json-schema`. |
| `webSearch` | Whether the current adapter can actually enable web search. |
| `nativeCapabilities` | Optional publisher support that is not enabled through this adapter. |
| `outputTokenParameter` | Chat request token field: `max_tokens` or `max_completion_tokens`. |
| `status` | `active`, `preview`, `deprecated`, `retired`, or `draft`. Retired/draft models cannot be activated/generated; previews require explicit selection. |
| `apiStyle` | Explicit transport: Chat Completions, Responses, Azure v1, Vertex partner API, Bedrock Invoke or Mantle. |
| `readiness` | Adapter support, specification confidence and live test state; pending adapters cannot be activated. |
| `metadata` | Review date, revision, documentation URLs, maintenance notes and optional retirement date. URLs are references only, never fetched at runtime. |
| `defaults` | Optional temperature and output fraction; output fraction defaults to 0.95. |

Keep model context, API output ceiling, account quotas and server configuration
distinct. Where a provider does not publish an exact output limit, record an
explicit conservative ceiling with a note. Do not label estimates as verified.
The default output budget reserves input space and is approximately 95% of the
recorded ceiling. Thinking is on by default whenever its request policy supports it.

## Reasoning modes

### Search / grounding policy

`webSearch` means this exact model can enable search through its serving adapter,
not merely that the model publisher offers search in a consumer product. Google
model-list responses omit tool capabilities. `google-grounding.ts` maintains an
explicit documented allowlist for inventory generation, including Gemini 3.8 Flash;
the local profile stores the capability and documentation links. Specialized
image, audio, live, cyber and custom-tool variants do not inherit support by name.

Tasks persist `webSearchMode: "inherit" | "off" | "on"` (default `inherit`). Policy
is resolved after choosing the task model and again when falling back. Explicit
`on` fails when the actual serving model/adapter lacks support; inheritance only
enables search where supported. Background calls retain provider defaults and
quality JSON calls never enable search. Enabling the tool does not force a search.
When Google returns grounding sources, cited HTTP(S) source links are retained
in the plain-text response. Provider HTML is not inserted into answer text.

An explicit live grounding check is available in the tooling image:

```sh
docker run --rm --env-file .env -v "./config:/app/config" textverktyget-tests node dist/config/ai/catalog-maintenance/smoke.js --provider=gemini --model=gemini-3.8-flash --grounding
```

The check requires returned grounding source links and saves separate
`*-grounding.json` evidence. A normal generation smoke test does not verify search.

### Supported thinking modes

- `none`: no controlled thinking support in the adapter.
- `gemini-budget`: explicit enabled/disabled budgets and whether disabling is permitted.
- `gemini-level`: declared thinking levels for newer Gemini models, distinct from token budgets.
- `effort`: explicit enabled/disabled effort names and `canDisable`. Applicable to OpenAI-style APIs, Mistral and Ollama profiles when supported.
- `anthropic-budget`: minimum/default budget, constrained below the output limit.
- `anthropic-adaptive`: model chooses thinking depth, with an explicit effort and disable policy.
- `cohere-thinking`: Cohere v2 `thinking.type` enabled/disabled control.
- `nova-reasoning`: Nova 2 low/medium effort via Converse `reasoningConfig`; high effort is deliberately excluded because it changes token/sampling rules.
- `always-on`: model reasons intrinsically; checkbox is locked on.
- `thinking-toggle`: DeepSeek's explicit `thinking.type` enabled/disabled field.
- `openrouter`: routed `reasoning.enabled` control.
- `qwen-template`: local vLLM/SGLang `chat_template_kwargs.enable_thinking` control.

Policies are checked against adapter compatibility at startup. Never copy
another provider's policy simply because it serves the same underlying weights.

## Custom JSON profiles / Docker

Use `config/llm-profile.example.json` as a starting point. Put JSON files into
`config/llm-profiles/` or one provider subdirectory. Mount that directory read-only
and set `LLM_CATALOG_DIR` to its container path. Recreate/restart the app after editing
mounted files; no image rebuild is necessary. A same-ID override replaces a built-in
definition; new profile IDs add choices. Two custom files cannot define the same ID.

These files contain only data. Executable code, secrets and endpoint fields are
not accepted. Invalid files, unsupported reasoning policies and ambiguous aliases
fail catalog validation with an actionable startup error. Model profile selection
is persisted separately from the API deployment/model name and round-trips in backups.
External JSON definitions are installation-managed and must be copied separately
when moving an installation.

## Research snapshot: 2026-10-02

Every registered definition records its own source URLs and review notes. Review
covered the existing supported model list plus documented replacement/profile IDs.
It is not an exhaustive catalog of every model offered by these services.

- OpenAI's GPT-4o, GPT-4.1/Mini and GPT-5.4 limits were verified on individual model pages.
- Google model pages confirm 1,048,576 context / 65,536 output. Direct Developer API pages redirected to authentication; the official Cloud references were used for shared limits, while Cloud-specific retirement dates remain only on Vertex profiles.
- Vertex 2.5 Flash/Pro pages schedule retirement for October 20, 2026. Gemini Developer API lifecycle is not inferred from that date.
- Anthropic Sonnet 4.5 is deprecated with November 30, 2026 retirement; Haiku/Opus 4.5 remain available. Extended thinking constraints are recorded explicitly.
- Mistral Small 4 and explicit Medium 3.5 support `high`/`none` effort. Hosted output ceilings were not separately published on reviewed pages, so output limits remain conservative and visibly labelled.
- DeepSeek announced discontinuation of `deepseek-chat`/`deepseek-reasoner` for July 24, 2026. Current Flash/Pro profiles use an explicit thinking toggle; the old IDs are retained as retired compatibility records.
- The old xAI pages return 404 and are absent from the current lineup. Legacy records remain conservative; a Grok 4.7 profile was added with verified context/effort and conservative output.
- Cohere's dated Command A/R+ models and AI21's current Jamba aliases were checked against their model and API reference tables.
- Groq's Llama/GPT OSS output ceilings are service-specific. GPT OSS cannot disable thinking.
- Together lists the Llama context but not a separate output ceiling. Fireworks' Llama page is deployment-dependent and contains inconsistent serverless wording; both are labelled conservatively.
- Cerebras publishes different free/paid limits. Its built-in GPT OSS profile uses the lower free-tier budget, and old Llama 3.1 is marked deprecated.
- Qwen's publisher card distinguishes native context from YaRN-expanded context; hosted and local serving limits are recorded separately.
- OpenRouter's endpoint data reports 65,535 output for Gemini, and different Claude context windows between routes. It is copied into local definitions, not consulted at runtime.
- Azure profiles distinguish deployment names from underlying models and model-version/deployment-tier limits.
- Amazon's Nova v1 table gives 300K context / 10K output for Lite and Pro. Nova v2 reasoning capabilities are not applied to v1.

Revisit the individual files when provider documentation changes. Account access
and availability are checked only by explicit connection/model tests or generation,
not by catalog discovery. Saved administrator choices are never silently migrated
to different model weights.

The expanded inventory was captured October 4–5, 2026. Its per-provider coverage
and evidence supersede this initial curated research summary. Latest protocol
families are tested with mocked API contracts; configured Gemini 2.5 Flash and
Gemini 3.8 Flash additionally passed live synthetic rewriting and quality-JSON
checks. Other models remain explicitly live-untested until tested with an account.
