import researched from "./inventory.js";
import provider from "./provider.js";
import llama from "./models/llama-3.3-70b.js";
export default { ...provider, models: [llama, ...researched] };
