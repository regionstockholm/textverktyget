import researched from "./inventory.js";
import provider from "./provider.js";
import gemini from "./models/gemini-2.5-flash.js";
import claude from "./models/claude-sonnet-4.5.js";
import gpt from "./models/gpt-4.1.js";
export default { ...provider, models: [gemini, claude, gpt, ...researched] };
