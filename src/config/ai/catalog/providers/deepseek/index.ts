import provider from "./provider.js";
import flash from "./models/deepseek-flash.js";
import pro from "./models/deepseek-v4-pro.js";
import oldChat from "./models/deepseek-chat.js";
import oldReasoner from "./models/deepseek-reasoner.js";
export default { ...provider, models: [flash, pro, oldChat, oldReasoner] };
