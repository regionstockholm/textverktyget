import researched from "./inventory.js";
import provider from "./provider.js";
import omni from "./models/gpt-4o.js";
import full from "./models/gpt-4.1.js";
import mini from "./models/gpt-4.1-mini.js";
import reasoning from "./models/gpt-5.4.js";
export default { ...provider, models: [omni, full, mini, reasoning, ...researched] };
