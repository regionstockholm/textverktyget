import type { AdminFeedback } from "./admin_feedback.js";
import type { DomRefs } from "./admin_dom.js";
import type { AdminState } from "./admin_state.js";
import type { AdminApiRequest } from "./admin_types.js";

export type AdminContext = {
  refs: DomRefs;
  request: AdminApiRequest;
  feedback: AdminFeedback;
  state: AdminState;
};
