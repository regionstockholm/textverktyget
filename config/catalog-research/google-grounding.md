# Google Search grounding capability review

Reviewed: 2026-10-05. Model-list APIs do not enumerate Google Search tool support.
Grounding support must be reviewed separately from token limits and normal generation.

Official Google sources inspected:

- [Gemini grounding quickstart](https://github.com/google-gemini/cookbook/blob/main/quickstarts/Grounding.ipynb): explicitly lists Gemini 3.8 Flash, 3.7 Flash, 3.6 Flash, 3.5 Flash-Lite, 3.1 Pro Preview and 2.5 Pro for its grounding examples. The current quickstart uses Interactions.
- [GenerateContent grounding quickstart](https://github.com/google-gemini/cookbook/blob/archive/generate-content-api/quickstarts/Grounding.ipynb): documents `generate_content` with the `google_search` tool, grounding chunks/supports and search entry point metadata. Examples include Gemini 3.5 Flash, 3.1 Flash-Lite, 3.1 Pro Preview, 2.5 Flash and 2.5 Pro.
- [Google Cloud grounding quickstart](https://github.com/GoogleCloudPlatform/generative-ai/blob/main/gemini/grounding/intro-grounding-gemini.ipynb): explicitly uses Gemini 3.8 Flash with the Google Cloud client and `GoogleSearch` tool through `generate_content`.

The maintained allowlist is in `src/config/ai/catalog/google-grounding.ts`. It
does not infer grounding for specialized suffixes or for routed copies on other
providers. Existing separately maintained Gemini 2.5 profiles retain their prior
capability definitions. Public documentation at ai.google.dev timed out during
this review; the official Google GitHub examples were accessible.

Live verification used Gemini API `generateContent`, Gemini 3.8 Flash, and
`tools: [{ googleSearch: {} }]` with a synthetic public-information prompt about
the official Node.js release schedule. Grounding source links were returned;
quality JSON generation also passed. Evidence:
`live-tests/gemini-gemini-3.8-flash-grounding.json`.

No credentials, request headers, user text or generated answer bodies are saved
in this evidence. Vertex grounding is documented and adapter-tested with mocks;
it has not been live-tested with Cloud credentials in this installation.
