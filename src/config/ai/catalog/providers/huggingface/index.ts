import researched from "./inventory.js";
import provider from "./provider.js";
import qwen from "./models/qwen3-32b.js";
export default { ...provider, models: [qwen, ...researched] };
