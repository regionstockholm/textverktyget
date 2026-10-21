import provider from "./provider.js";
import generic from "./models/generic-local.js";
import qwen from "./models/qwen3-32b-ollama.js";
export default { ...provider, models: [generic, qwen] };
