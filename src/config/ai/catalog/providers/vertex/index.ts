import researched from "./inventory.js";
import provider from "./provider.js";
import flash from "./models/gemini-2.5-flash.js";
import pro from "./models/gemini-2.5-pro.js";
export default { ...provider, models: [flash, pro, ...researched] };
