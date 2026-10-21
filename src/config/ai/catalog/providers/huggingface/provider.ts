import type { ProviderInfo } from "../../types.js";
export default { id: "huggingface", label: "Hugging Face", key: "HF_TOKEN", endpoint: "https://router.huggingface.co/v1", defaultModelId: "Qwen/Qwen3-32B" } satisfies ProviderInfo<"huggingface">;
