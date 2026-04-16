import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAudienceProfile,
  buildSenderIntentProfile,
  buildSalienceMap,
  buildRewriteBlueprint,
} from "../services/summarize/pipeline-analysis.js";

const SENDER_INTENT =
  "Fokus pa transparens, delaktighet och klarsprak for invanare i regionen.";

test("text-type corpus is classified as expected", () => {
  const cases: Array<{ text: string; expectedType: string }> = [
    {
      text: "Protokoll fran mote i trafiknamnden: beslut om nya pendellinjer och uppfoljning av kapacitet.",
      expectedType: "meeting",
    },
    {
      text: "Ny policy och riktlinje beskriver hur vardcentraler ska prioritera tider under hosten.",
      expectedType: "policy",
    },
    {
      text: "Sa har gor du for att boka tid digitalt: folj stegen och kontrollera bekraftelsen.",
      expectedType: "instruction",
    },
    {
      text: "Pressmeddelande: nyhet om fler bussavganger fran och med mandag i hela lanet.",
      expectedType: "news",
    },
    {
      text: "Regionen sammanfattar arbetet med tillganglighet och service under aret.",
      expectedType: "general",
    },
  ];

  for (const testCase of cases) {
    const profile = buildAudienceProfile(testCase.text, "no specific group");
    assert.equal(profile.textType, testCase.expectedType);
    assert.equal(profile.priorityMode, "generic");
  }
});

test("specific audience prioritization reorders salience toward audience relevance", () => {
  const text =
    "Region Stockholm fattade idag beslut om ett nytt arbetssatt i varden under 2026. " +
    "Bakgrunden ar langa vantetider och behov av tydligare prioriteringar i hela regionen. " +
    "For studenter i Stockholmsregionen innebar forandringen kvallsoppna tider och enklare digital kontakt. " +
    "Beslutet foljs upp med oppna fragestunder dar invanare kan stalla fragor.";

  const senderIntent = buildSenderIntentProfile(SENDER_INTENT);
  const genericAudience = buildAudienceProfile(text, "no specific group");
  const specificAudience = buildAudienceProfile(text, "studenter i stockholmsregionen");

  const genericMap = buildSalienceMap(text, genericAudience, senderIntent);
  const specificMap = buildSalienceMap(text, specificAudience, senderIntent);

  assert.equal(genericMap.rankingPolicy, "core-first");
  assert.equal(specificMap.rankingPolicy, "audience-first");

  const audienceSentenceMatcher = /studenter i stockholmsregionen/;
  const genericTopSentence = genericMap.items[0]?.sentence.toLowerCase() || "";
  const genericRank = genericMap.items.findIndex((item) =>
    audienceSentenceMatcher.test(item.sentence.toLowerCase()),
  );
  const specificRank = specificMap.items.findIndex((item) =>
    audienceSentenceMatcher.test(item.sentence.toLowerCase()),
  );

  assert.match(genericTopSentence, /beslut/);
  assert.notEqual(genericRank, -1);
  assert.notEqual(specificRank, -1);
  assert.ok(specificRank <= genericRank);
});

test("rewrite blueprint keeps top-ranked facts in the lead section", () => {
  const text =
    "Beslut om utokad nattrafik galler fran 1 september och omfattar tre linjer. " +
    "For invanare betyder detta kortare restid till och fran arbete. " +
    "Regionen redovisar bakgrund, kostnad och hur effekten ska foljas upp.";
  const audience = buildAudienceProfile(text, "no specific group");
  const senderIntent = buildSenderIntentProfile(SENDER_INTENT);
  const map = buildSalienceMap(text, audience, senderIntent);
  const blueprint = buildRewriteBlueprint(map);

  const expectedLeadItems = map.items.slice(0, 2).map((item) => item.id);
  const leadSection = blueprint.sections.find((section) => section.key === "core-message");

  assert.ok(leadSection);
  assert.deepEqual(leadSection?.itemIds, expectedLeadItems);
});
