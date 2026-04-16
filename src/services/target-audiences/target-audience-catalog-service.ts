import type { Prisma, PrismaClient } from "@prisma/client";
import { getPrismaClient } from "../../config/database/prisma-client.js";
import { getDefaultConfig } from "../../config/default-config-loader.js";

const GLOBAL_CONFIG_KEY = "global";
const TARGET_AUDIENCE_CATALOG_KEY = "targetAudienceCatalog";
const SORT_STEP = 10;
const GENERIC_FALLBACK_CATEGORY_NAME = "Default";
const GENERIC_FALLBACK_AUDIENCE_LABEL = "Allman malgrupp";

type DbClient = Prisma.TransactionClient | PrismaClient;

export interface TargetAudienceCategory {
  name: string;
  sortOrder: number;
}

export interface TargetAudienceItem {
  label: string;
  category: string;
  sortOrder: number;
}

export interface TargetAudienceCatalog {
  categories: TargetAudienceCategory[];
  audiences: TargetAudienceItem[];
}

interface ValidationResult {
  ok: boolean;
  errors: string[];
  value: TargetAudienceCatalog;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeSortOrder(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

function uniqueBy<T>(values: T[], keyFn: (value: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const value of values) {
    const key = keyFn(value);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(value);
  }
  return result;
}

function nextSortOrder(existing: number[]): number {
  if (existing.length === 0) {
    return SORT_STEP;
  }
  return Math.max(...existing) + SORT_STEP;
}

function getDefaultGlobalValues(): { provider: string; retryCount: number } {
  const defaultConfig = getDefaultConfig();
  const retryCount =
    Number.isInteger(defaultConfig.settings.global.retryCount) &&
    defaultConfig.settings.global.retryCount >= 1
      ? defaultConfig.settings.global.retryCount
      : 5;

  return {
    provider: defaultConfig.settings.global.provider,
    retryCount,
  };
}

function sortTargetAudienceCategories(
  categories: TargetAudienceCategory[],
): TargetAudienceCategory[] {
  return [...categories].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "sv"),
  );
}

function sortTargetAudienceItems(audiences: TargetAudienceItem[]): TargetAudienceItem[] {
  return [...audiences].sort(
    (a, b) =>
      a.category.localeCompare(b.category, "sv") ||
      a.sortOrder - b.sortOrder ||
      a.label.localeCompare(b.label, "sv"),
  );
}

function normalizeTargetAudienceOrdering(
  catalog: TargetAudienceCatalog,
): TargetAudienceCatalog {
  const sortedCategories = sortTargetAudienceCategories(catalog.categories).map(
    (category, index) => ({
      ...category,
      sortOrder: (index + 1) * SORT_STEP,
    }),
  );

  const sortedAudiences: TargetAudienceItem[] = [];
  sortedCategories.forEach((category) => {
    const byCategory = sortTargetAudienceItems(
      catalog.audiences.filter((audience) => audience.category === category.name),
    ).map((audience, index) => ({
      ...audience,
      sortOrder: (index + 1) * SORT_STEP,
    }));
    sortedAudiences.push(...byCategory);
  });

  return {
    categories: sortedCategories,
    audiences: sortedAudiences,
  };
}

function sanitizeCatalog(raw: unknown): TargetAudienceCatalog {
  if (!isRecord(raw)) {
    return { categories: [], audiences: [] };
  }

  const rawCategories = Array.isArray(raw.categories) ? raw.categories : [];
  const categories = uniqueBy(
    rawCategories
      .map((entry) => {
        if (!isRecord(entry)) {
          return null;
        }
        const name = normalizeName(entry.name);
        const sortOrder = normalizeSortOrder(entry.sortOrder);
        if (!name || !sortOrder) {
          return null;
        }
        return { name, sortOrder } satisfies TargetAudienceCategory;
      })
      .filter((entry): entry is TargetAudienceCategory => entry !== null)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "sv")),
    (entry) => entry.name,
  );

  const rawAudiences = Array.isArray(raw.audiences) ? raw.audiences : [];
  const audiences = uniqueBy(
    rawAudiences
      .map((entry) => {
        if (!isRecord(entry)) {
          return null;
        }
        const label = normalizeName(entry.label);
        const category = normalizeName(entry.category);
        const sortOrder = normalizeSortOrder(entry.sortOrder);
        if (!label || !category || !sortOrder) {
          return null;
        }
        return { label, category, sortOrder } satisfies TargetAudienceItem;
      })
      .filter((entry): entry is TargetAudienceItem => entry !== null)
      .sort(
        (a, b) =>
          a.category.localeCompare(b.category, "sv") ||
          a.sortOrder - b.sortOrder ||
          a.label.localeCompare(b.label, "sv"),
      ),
    (entry) => entry.label,
  );

  return {
    categories,
    audiences,
  };
}

function buildCatalogFromDefaultConfig(): TargetAudienceCatalog {
  const defaultConfig = getDefaultConfig();
  const catalog = sanitizeCatalog({
    categories: defaultConfig.settings.targetAudienceCategories,
    audiences: defaultConfig.settings.targetAudiences.map((audience) => ({
      label: audience.label,
      category: audience.category,
      sortOrder: audience.sortOrder,
    })),
  });

  return normalizeTargetAudienceOrdering(catalog);
}

function buildGenericFallbackCatalog(): TargetAudienceCatalog {
  return {
    categories: [
      {
        name: GENERIC_FALLBACK_CATEGORY_NAME,
        sortOrder: SORT_STEP,
      },
    ],
    audiences: [
      {
        label: GENERIC_FALLBACK_AUDIENCE_LABEL,
        category: GENERIC_FALLBACK_CATEGORY_NAME,
        sortOrder: SORT_STEP,
      },
    ],
  };
}

function resolveFallbackCatalog(): TargetAudienceCatalog {
  try {
    const fromDefaultConfig = buildCatalogFromDefaultConfig();
    if (
      fromDefaultConfig.categories.length > 0 &&
      fromDefaultConfig.audiences.length > 0
    ) {
      return fromDefaultConfig;
    }
  } catch {
    // Ignore and use generic fallback.
  }

  return buildGenericFallbackCatalog();
}

function normalizeCatalogForRuntime(catalog: TargetAudienceCatalog): TargetAudienceCatalog {
  const sanitized = sanitizeCatalog(catalog);
  const fallback = resolveFallbackCatalog();

  let categories = [...sanitized.categories];
  if (categories.length === 0) {
    categories = [...fallback.categories];
  }

  const fallbackCategoryName =
    categories[0]?.name ??
    fallback.categories[0]?.name ??
    GENERIC_FALLBACK_CATEGORY_NAME;
  const categoryNameSet = new Set(categories.map((category) => category.name));

  let audiences = sanitized.audiences.map((audience) => ({
    ...audience,
    category: categoryNameSet.has(audience.category)
      ? audience.category
      : fallbackCategoryName,
  }));

  if (audiences.length === 0) {
    audiences = [
      {
        label: fallback.audiences[0]?.label ?? GENERIC_FALLBACK_AUDIENCE_LABEL,
        category: fallbackCategoryName,
        sortOrder: nextSortOrder([]),
      },
    ];
  }

  return normalizeTargetAudienceOrdering({
    categories,
    audiences,
  });
}

export function validateTargetAudienceCatalogInput(value: unknown): ValidationResult {
  const errors: string[] = [];
  const catalog = sanitizeCatalog(value);

  if (!isRecord(value)) {
    errors.push("Catalog payload must be an object.");
  }

  if (catalog.categories.length === 0) {
    errors.push("Catalog must include at least one category.");
  }

  if (catalog.audiences.length === 0) {
    errors.push("Catalog must include at least one target audience.");
  }

  const categoryNames = new Set(catalog.categories.map((category) => category.name));
  for (const audience of catalog.audiences) {
    if (!categoryNames.has(audience.category)) {
      errors.push(`Unknown category '${audience.category}' for audience '${audience.label}'.`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    value: catalog,
  };
}

function extractStoredCatalog(runtimeSettings: unknown): TargetAudienceCatalog {
  if (!isRecord(runtimeSettings)) {
    return { categories: [], audiences: [] };
  }

  return sanitizeCatalog(runtimeSettings[TARGET_AUDIENCE_CATALOG_KEY]);
}

function setStoredCatalog(
  runtimeSettings: Record<string, unknown>,
  catalog: TargetAudienceCatalog,
): Record<string, unknown> {
  return {
    ...runtimeSettings,
    [TARGET_AUDIENCE_CATALOG_KEY]: {
      categories: catalog.categories,
      audiences: catalog.audiences,
    },
  };
}

export async function getTargetAudienceCatalog(
  client: DbClient = getPrismaClient(),
): Promise<TargetAudienceCatalog> {
  const globalConfig = await client.globalConfig.findUnique({
    where: { configKey: GLOBAL_CONFIG_KEY },
  });

  const storedCatalog = extractStoredCatalog(globalConfig?.runtimeSettings);
  return normalizeCatalogForRuntime(storedCatalog);
}

export async function saveTargetAudienceCatalog(
  catalog: TargetAudienceCatalog,
  actor: string,
  client: DbClient = getPrismaClient(),
): Promise<TargetAudienceCatalog> {
  const normalizedCatalog = normalizeCatalogForRuntime(catalog);

  const existingCatalog = await getTargetAudienceCatalog(client);
  const existingLabels = new Set(existingCatalog.audiences.map((audience) => audience.label));
  const nextLabels = new Set(normalizedCatalog.audiences.map((audience) => audience.label));
  const removedLabels = [...existingLabels].filter((label) => !nextLabels.has(label));

  const existing = await client.globalConfig.findUnique({
    where: { configKey: GLOBAL_CONFIG_KEY },
  });

  const runtimeSettings = isRecord(existing?.runtimeSettings)
    ? (existing?.runtimeSettings as Record<string, unknown>)
    : {};

  const nextRuntimeSettings = setStoredCatalog(runtimeSettings, normalizedCatalog);
  const defaults = getDefaultGlobalValues();

  await client.globalConfig.upsert({
    where: { configKey: GLOBAL_CONFIG_KEY },
    create: {
      configKey: GLOBAL_CONFIG_KEY,
      provider: existing?.provider ?? defaults.provider,
      retryCount: existing?.retryCount ?? defaults.retryCount,
      rewritePlanTasks: existing?.rewritePlanTasks as Prisma.InputJsonValue | undefined,
      runtimeSettings: nextRuntimeSettings as Prisma.InputJsonValue,
      updatedBy: actor,
    },
    update: {
      runtimeSettings: nextRuntimeSettings as Prisma.InputJsonValue,
      updatedBy: actor,
    },
  });

  if (removedLabels.length > 0) {
    const removedPromptNames = removedLabels.map(
      (label) => `targetAudience:${label}`,
    );
    await client.promptTemplate.updateMany({
      where: {
        name: { in: removedPromptNames },
        isActive: true,
      },
      data: { isActive: false },
    });
  }

  return normalizedCatalog;
}
