import researched from "./inventory.js";
import provider from "./provider.js";
import pro from "./models/nova-pro-v1.js";
import lite from "./models/nova-lite-v1.js";
export default { ...provider, models: [pro, lite, ...researched] };
