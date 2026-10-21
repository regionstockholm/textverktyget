import researched from "./inventory.js";
import provider from "./provider.js";
import small from "./models/mistral-small-latest.js";
import medium from "./models/mistral-medium-latest.js";
import medium35 from "./models/mistral-medium-3-5.js";
import large from "./models/mistral-large-latest.js";
export default { ...provider, models: [small, medium35, medium, large, ...researched] };
