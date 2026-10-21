import researched from "./inventory.js";
import provider from "./provider.js";
import latest from "./models/grok-4.7.js";
import old from "./models/grok-4.js";
import mini from "./models/grok-3-mini.js";
export default { ...provider, models: [latest, old, mini, ...researched] };
