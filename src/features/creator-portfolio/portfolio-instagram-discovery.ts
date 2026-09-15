import {
  assertCaptionIsData,
  containsNormalizedPhrase,
  extractCaptionTokens,
  finalizeLikelyCollab,
  type InstagramC3AdmittedContext,
} from "../instagram-intelligence/semantics/instagram-c3-semantics";

export const PORTFOLIO_DISCLOSURE_PROFILE = "portfolio-caption-disclosure-v1";
/** A bounded source-native inference adapter, not a provider or Evidence engine.
 * The caller must admit the completed source Capture/Evidence and current
 * Settings fence before using its result. No metrics or representatives enter.
 * Missing visual/temporal scope can never establish a negative. */
export function discoverPortfolioCollaboration(input: {
  caption: string | null;
  sourceEvidenceRef: string;
}) {
  const context: InstagramC3AdmittedContext = {
    caption: {
      state:
        input.caption === null
          ? "UNKNOWN"
          : input.caption === ""
            ? "EXPLICIT_EMPTY"
            : "AVAILABLE",
      text: input.caption ?? undefined,
      contentHash: null,
      evidenceRef: input.sourceEvidenceRef,
    },
    visual: { state: "UNKNOWN" },
    inspection: {
      depth: "LIGHT_ONLY",
      selectedForDeepAnalysis: false,
      selectionReasons: [],
      inspectedChildCount: 0,
      availableChildCount: 0,
      inspectedFrameCount: 0,
      completeVisualScope: false,
      completeVisualTextScope: false,
      completeVideoScope: false,
      reasonCodes: ["VISUAL_SCOPE_NOT_ADMITTED"],
    },
  };
  if (input.caption) assertCaptionIsData(input.caption);
  const disclosurePhrases = [
    "paid partnership",
    "sponsored by",
    "in partnership with",
    "advertisement",
    "#ad",
    "#sponsored",
  ];
  const negated =
    /\b(?:not|never|no)\s+(?:(?:an?|a paid)\s+)?(?:ad(?:vertisement)?|sponsored|paid partnership|partnership)\b/iu.test(
      input.caption ?? "",
    );
  const disclosed =
    !negated &&
    disclosurePhrases.some((phrase) =>
      containsNormalizedPhrase(input.caption ?? "", phrase),
    );
  const cues = disclosed
    ? [
        {
          cueId: PORTFOLIO_DISCLOSURE_PROFILE,
          signalClass: "EXPLICIT_PARTNERSHIP_DISCLOSURE",
          evidenceRefs: [input.sourceEvidenceRef],
        },
      ]
    : [];
  const result = finalizeLikelyCollab(cues, context);
  // Casual mention/product/performance alone is not Portfolio admission.
  return {
    admitted:
      disclosed &&
      (result.state === "POSSIBLE_COLLAB" || result.state === "LIKELY_COLLAB"),
    result,
    profile: PORTFOLIO_DISCLOSURE_PROFILE,
    brandMention: disclosed
      ? (extractCaptionTokens(input.caption ?? undefined).mentions[0] ?? null)
      : null,
  };
}
