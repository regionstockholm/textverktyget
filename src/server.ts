import { init } from "./server/init.js";

init().catch((error) => {
  console.error("Fatal server initialization error:", error);
  process.exit(1);
});
