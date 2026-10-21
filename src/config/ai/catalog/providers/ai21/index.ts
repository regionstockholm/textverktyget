import researched from "./inventory.js";
import provider from "./provider.js";
import large from "./models/jamba-large.js";
import mini from "./models/jamba-mini.js";
export default { ...provider, models: [large, mini, ...researched] };
