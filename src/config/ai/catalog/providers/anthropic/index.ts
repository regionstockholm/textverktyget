import researched from "./inventory.js";
import provider from "./provider.js";
import sonnet from "./models/claude-sonnet-4-5.js";
import haiku from "./models/claude-haiku-4-5.js";
import opus from "./models/claude-opus-4-5.js";
export default { ...provider, models: [sonnet, haiku, opus, ...researched] };
