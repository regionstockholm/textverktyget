import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAudienceProfile,
  buildSenderIntentProfile,
  buildSalienceMap,
  buildRewriteBlueprint,
  renderRewriteBlueprint,
} from "../services/summarize/pipeline-analysis.js";

const SAMPLE_TEXT =
  "Region Stockholm beslutar att utoka vardplatserna under sommaren. " +
  "For invanare betyder det kortare vantetider och battre tillganglighet. " +
  "Atgarden galler fran 1 juni och omfattar flera sjukhus. " +
  "Bakgrunden ar ett okat behov i regionen.";

test("buildAudienceProfile marks generic audience correctly", () => {
  const profile = buildAudienceProfile(SAMPLE_TEXT, "no specific group");
  assert.equal(profile.priorityMode, "generic");
});

test("buildAudienceProfile marks specific audience correctly", () => {
  const profile = buildAudienceProfile(SAMPLE_TEXT, "unga vuxna i regionen");
  assert.equal(profile.priorityMode, "specific");
  assert.equal(profile.targetAudience, "unga vuxna i regionen");
});

test("buildSenderIntentProfile extracts priorities", () => {
  const intent = buildSenderIntentProfile(
    "Fokus pa transparens, delaktighet och klarsprak.",
  );
  assert.ok(intent.priorities.length >= 2);
  assert.match(intent.summary, /transparens|delaktighet|klarsprak/);
});

test("salience map and rewrite blueprint produce guidance", () => {
  const profile = buildAudienceProfile(SAMPLE_TEXT, "no specific group");
  const senderIntent = buildSenderIntentProfile(
    "Fokus pa transparens, delaktighet och klarsprak.",
  );
  const importanceMap = buildSalienceMap(SAMPLE_TEXT, profile, senderIntent);
  const blueprint = buildRewriteBlueprint(importanceMap);
  const renderedBlueprint = renderRewriteBlueprint(blueprint, importanceMap);

  assert.ok(importanceMap.items.length > 0);
  assert.equal(importanceMap.rankingPolicy, "core-first");
  assert.equal(blueprint.sections.length, 3);
  assert.match(renderedBlueprint, /REWRITE BLUEPRINT/);
  assert.match(renderedBlueprint, /Karnbudskap|Kärnbudskap/);
  const topItem = importanceMap.items[0];
  assert.ok(topItem);
  assert.ok(topItem.weights.coreImportance >= 0);
});

test("sender intent keywords increase sender alignment weighting", () => {
  const text =
    "Regionen fattar beslut med tydlig bakgrund for invanare. " +
    "Det finns ocksa allman information utan sarskild riktning.";
  const profile = buildAudienceProfile(text, "no specific group");
  const intent = buildSenderIntentProfile(
    "Fokus pa transparens, delaktighet och klarsprak.",
  );

  const importanceMap = buildSalienceMap(text, profile, intent);
  const decisionSentence = importanceMap.items.find((item) =>
    item.sentence.toLowerCase().includes("fattar beslut"),
  );
  const neutralSentence = importanceMap.items.find((item) =>
    item.sentence.toLowerCase().includes("allman information"),
  );

  assert.ok(decisionSentence);
  assert.ok(neutralSentence);
  assert.ok(
    (decisionSentence?.weights.senderIntentAlignment || 0) >=
      (neutralSentence?.weights.senderIntentAlignment || 0),
  );
});
