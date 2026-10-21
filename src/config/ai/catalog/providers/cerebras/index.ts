import researched from "./inventory.js";
import provider from "./provider.js";
import oss from "./models/gpt-oss-120b.js";
import old from "./models/llama3.1-8b.js";
export default { ...provider, models: [oss, old, ...researched] };
