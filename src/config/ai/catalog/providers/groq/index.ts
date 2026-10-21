import researched from "./inventory.js";
import provider from "./provider.js";
import llama from "./models/llama-3.3-70b-versatile.js";
import oss from "./models/gpt-oss-120b.js";
export default { ...provider, models: [llama, oss, ...researched] };
