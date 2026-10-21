import {
  EMPTY_TARGET_AUDIENCE_CATALOG,
  getDefaultRewritePlanTasks,
} from "./admin_constants.js";
import type {
  RewritePlanTaskSettings,
  RuntimeSettings,
  TargetAudienceCatalog,
  TaskDefinition,
} from "./admin_types.js";

export type AdminState = {
  lastTargetAudience: string;
  lastTaskPrompt: string;
  rewritePlanTasks: RewritePlanTaskSettings;
  runtimeSettings: RuntimeSettings;
  taskDefinitions: TaskDefinition[];
  targetAudienceCatalog: TargetAudienceCatalog;
};

export function createAdminState(): AdminState {
  return {
    lastTargetAudience: "",
    lastTaskPrompt: "",
    rewritePlanTasks: getDefaultRewritePlanTasks(),
    runtimeSettings: {},
    taskDefinitions: [],
    targetAudienceCatalog: {
      categories: [...EMPTY_TARGET_AUDIENCE_CATALOG.categories],
      audiences: [...EMPTY_TARGET_AUDIENCE_CATALOG.audiences],
    },
  };
}
