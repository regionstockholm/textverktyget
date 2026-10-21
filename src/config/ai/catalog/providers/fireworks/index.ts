import researched from "./inventory.js";
import provider from "./provider.js";
import llama from "./models/llama-v3p3-70b-instruct.js";
export default { ...provider, models: [llama, ...researched] };
