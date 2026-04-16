import {
  type AudienceProfileArtifact,
  type ImportanceItemArtifact,
  type ImportanceMapArtifact,
  type RankingPolicy,
  type RewriteBlueprintArtifact,
  type SenderIntentProfileArtifact,
  validateAudienceProfileArtifact,
  validateImportanceMapArtifact,
  validateRewriteBlueprintArtifact,
  validateSenderIntentProfileArtifact,
} from "./pipeline-artifacts.js";

const MAX_SENTENCES = 30;
const TOP_SALIENCE_ITEMS = 8;
const GENERIC_TARGET_AUDIENCE_LABEL = "Allman malgrupp";
const GENERIC_AUDIENCE_ALIASES = new Set([
  "allman malgrupp",
  "general audience",
  "no specific group",
]);

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeIdentity(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function inferTextType(text: string): string {
  const lower = text.toLowerCase();
  if (/protokoll|sammantrade|mote/.test(lower)) {
    return "meeting";
  }
  if (/beslut|forordning|riktlinje|policy/.test(lower)) {
    return "policy";
  }
  if (/instruktion|sa har|steg|guide/.test(lower)) {
    return "instruction";
  }
  if (/pressmeddelande|nyhet|aktuellt/.test(lower)) {
    return "news";
  }
  return "general";
}

export function buildAudienceProfile(
  text: string,
  targetAudience: string,
): AudienceProfileArtifact {
  const normalizedAudience = normalizeWhitespace(targetAudience || "");
  const normalizedAudienceIdentity = normalizeIdentity(normalizedAudience);
  const genericAudience =
    normalizedAudience.length === 0 ||
    GENERIC_AUDIENCE_ALIASES.has(normalizedAudienceIdentity);

  const profile: AudienceProfileArtifact = {
    targetAudience: normalizedAudience || GENERIC_TARGET_AUDIENCE_LABEL,
    priorityMode: genericAudience ? "generic" : "specific",
    textType: inferTextType(text),
  };

  if (!validateAudienceProfileArtifact(profile)) {
    throw new Error("Invalid audienceProfile artifact generated");
  }

  return profile;
}

export function buildSenderIntentProfile(
  senderIntentPrompt: string,
): SenderIntentProfileArtifact {
  const normalizedPrompt = normalizeWhitespace(senderIntentPrompt || "");
  const priorities: string[] = [];
  const lower = normalizedPrompt.toLowerCase();

  if (lower.includes("transparen")) {
    priorities.push("transparens och tydlighet");
  }
  if (lower.includes("delakt") || lower.includes("inkluder")) {
    priorities.push("delaktighet och inkludering");
  }
  if (lower.includes("klarsprak") || lower.includes("begrip")) {
    priorities.push("klarsprak och begriplighet");
  }

  if (priorities.length === 0) {
    priorities.push("tydlig och tillganglig information");
  }

  const profile: SenderIntentProfileArtifact = {
    summary: priorities.join(", "),
    priorities,
  };

  if (!validateSenderIntentProfileArtifact(profile)) {
    throw new Error("Invalid senderIntentProfile artifact generated");
  }

  return profile;
}

interface SentenceCandidate {
  sentence: string;
  sourceSpan: {
    start: number;
    end: number;
  };
  index: number;
}

function toSentences(text: string): SentenceCandidate[] {
  const candidates: SentenceCandidate[] = [];
  const matcher = /[^.!?\n]+[.!?]?/g;
  let match: RegExpExecArray | null = null;

  while (
    (match = matcher.exec(text)) !== null &&
    candidates.length < MAX_SENTENCES
  ) {
    const rawSentence = match[0] || "";
    const sentence = normalizeWhitespace(rawSentence);
    if (sentence.length < 20) {
      continue;
    }

    candidates.push({
      sentence,
      sourceSpan: {
        start: match.index,
        end: match.index + rawSentence.length,
      },
      index: candidates.length,
    });
  }

  return candidates;
}

function scoreDimension(value: number): number {
  const bounded = Math.max(0, Math.min(10, Math.round(value)));
  return bounded;
}

function scoreSentence(
  candidate: SentenceCandidate,
  audienceProfile: AudienceProfileArtifact,
  senderIntentProfile: SenderIntentProfileArtifact,
): ImportanceItemArtifact {
  const { sentence, index } = candidate;
  const lower = sentence.toLowerCase();

  const coreImportanceBase = 10 - Math.min(index, 9);
  const hasNumbers = /\d/.test(sentence);
  const hasDecisionLanguage = /ska|kommer|beslut|andras|galler|galler for/.test(
    lower,
  );
  const hasCitizenImpact = /for invanare|for dig|beror dig|paverkar/.test(
    lower,
  );
  const hasAction = /gor|ansok|kontakta|las mer|anmal/.test(lower);

  const coreImportance = scoreDimension(
    coreImportanceBase + (hasDecisionLanguage ? 2 : 0),
  );

  let audienceRelevance = hasCitizenImpact ? 7 : 4;

  if (audienceProfile.priorityMode === "specific") {
    const audienceTokens = audienceProfile.targetAudience
      .toLowerCase()
      .split(/[^a-z0-9a-zA-Z]+/)
      .filter((token) => token.length > 2);

    if (audienceTokens.some((token) => lower.includes(token))) {
      audienceRelevance += 3;
    }
  }

  const senderIntentAlignment = scoreDimension(
    3 +
      senderIntentProfile.priorities.filter((priority) => {
        if (priority.includes("transparens")) {
          return /beslut|varfor|bakgrund|orsak/.test(lower);
        }
        if (priority.includes("delaktighet")) {
          return /invanare|delt|medverka|fraga/.test(lower);
        }
        if (priority.includes("klarsprak")) {
          return /enkel|tydlig|kort|steg/.test(lower);
        }
        return false;
      }).length *
        3,
  );

  const riskIfOmitted = scoreDimension(
    2 + (hasNumbers ? 3 : 0) + (hasDecisionLanguage ? 3 : 0),
  );
  const actionability = scoreDimension(2 + (hasAction ? 5 : 0));

  const normalizedAudienceRelevance = scoreDimension(audienceRelevance);
  const weights = {
    coreImportance,
    audienceRelevance: normalizedAudienceRelevance,
    senderIntentAlignment,
    riskIfOmitted,
    actionability,
  };

  const rankingPolicy: RankingPolicy =
    audienceProfile.priorityMode === "specific"
      ? "audience-first"
      : "core-first";
  const totalScore =
    rankingPolicy === "audience-first"
      ? normalizedAudienceRelevance * 0.32 +
        coreImportance * 0.24 +
        senderIntentAlignment * 0.18 +
        riskIfOmitted * 0.16 +
        actionability * 0.1
      : coreImportance * 0.32 +
        normalizedAudienceRelevance * 0.22 +
        senderIntentAlignment * 0.18 +
        riskIfOmitted * 0.18 +
        actionability * 0.1;

  return {
    id: `fact-${index + 1}`,
    sentence,
    sourceSpan: candidate.sourceSpan,
    weights,
    totalScore: Number(totalScore.toFixed(3)),
  };
}

export function buildSalienceMap(
  text: string,
  audienceProfile: AudienceProfileArtifact,
  senderIntentProfile?: SenderIntentProfileArtifact,
): ImportanceMapArtifact {
  const sentences = toSentences(text);
  const effectiveSenderIntentProfile = senderIntentProfile || {
    summary: "tydlig och tillganglig information",
    priorities: ["tydlig och tillganglig information"],
  };
  const rankingPolicy: RankingPolicy =
    audienceProfile.priorityMode === "specific"
      ? "audience-first"
      : "core-first";

  const importanceMap: ImportanceMapArtifact = {
    rankingPolicy,
    items: sentences
      .map((candidate) =>
        scoreSentence(candidate, audienceProfile, effectiveSenderIntentProfile),
      )
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, TOP_SALIENCE_ITEMS),
  };

  if (!validateImportanceMapArtifact(importanceMap)) {
    throw new Error("Invalid importanceMap artifact generated");
  }

  return importanceMap;
}

export function buildRewriteBlueprint(
  importanceMap: ImportanceMapArtifact,
): RewriteBlueprintArtifact {
  const topItems = importanceMap.items.slice(0, TOP_SALIENCE_ITEMS);
  const coreItems = topItems.slice(0, 2).map((item) => item.id);
  const impactItems = topItems.slice(2, 5).map((item) => item.id);
  const contextItems = topItems.slice(5).map((item) => item.id);

  const blueprint: RewriteBlueprintArtifact = {
    rankingPolicy: importanceMap.rankingPolicy,
    sections: [
      {
        key: "core-message",
        title: "Kärnbudskap",
        objective: "Inled med det viktigaste budskapet.",
        itemIds: coreItems,
      },
      {
        key: "impact",
        title: "Vad det betyder for invånaren",
        objective: "Beskriv konsekvenser och relevans för invånare.",
        itemIds: impactItems,
      },
      {
        key: "context",
        title: "Bakgrund och detaljer",
        objective: "Lägg till kontext efter huvudbudskapet.",
        itemIds: contextItems,
      },
    ],
  };

  if (!validateRewriteBlueprintArtifact(blueprint)) {
    throw new Error("Invalid rewriteBlueprint artifact generated");
  }

  return blueprint;
}

export function renderRewriteBlueprint(
  rewriteBlueprint: RewriteBlueprintArtifact,
  importanceMap: ImportanceMapArtifact,
): string {
  if (importanceMap.items.length === 0) {
    return "";
  }

  const sentenceById = new Map(
    importanceMap.items.map((item) => [item.id, item.sentence]),
  );

  const sections = [
    "REWRITE BLUEPRINT (important first)",
    `RANKING POLICY: ${rewriteBlueprint.rankingPolicy}`,
  ];

  rewriteBlueprint.sections.forEach((section, index) => {
    sections.push(`${index + 1}) ${section.title}`);
    if (section.itemIds.length === 0) {
      sections.push(`- ${section.objective}`);
      return;
    }

    section.itemIds.forEach((itemId) => {
      const sentence = sentenceById.get(itemId);
      if (sentence) {
        sections.push(`- ${sentence}`);
      }
    });
  });

  return sections.join("\n");
}
