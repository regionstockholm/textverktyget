import researched from "./inventory.js";
import provider from "./provider.js";
import flash from "./models/gemini-2.5-flash.js";
import pro from "./models/gemini-2.5-pro.js";
import lite from "./models/gemini-2.5-flash-lite.js";
import legacyPro from "./models/gemini-1.5-pro.js";
import legacyFlash from "./models/gemini-1.5-flash.js";
export default { ...provider, models: [flash, pro, lite, legacyPro, legacyFlash, ...researched] };
