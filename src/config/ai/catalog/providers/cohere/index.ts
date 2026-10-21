import researched from "./inventory.js";
import provider from "./provider.js";
import command from "./models/command-a-03-2025.js";
import plus from "./models/command-r-plus-08-2024.js";
export default { ...provider, models: [command, plus, ...researched] };
