import type { ProcessorSemanticValidator } from "./semantic.validator";
import type {
  EvidenceManifestEntry,
  SemanticValidationContext,
  ValidationIssue,
} from "./validation.types";

type Row = Readonly<Record<string, unknown>>;
const row = (value: unknown): Row =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
const normalized = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const textOf = (entry: EvidenceManifestEntry) => {
  const payload = row(entry.normalizedPayload);
  return String(
    payload.statement_text ?? payload.text_or_normalized_message ?? "",
  );
};

/** Bounded deterministic support checks; the grounded prompt owns natural-language interpretation. */
export class BrandCharacterSemanticValidator implements ProcessorSemanticValidator {
  readonly validatorId = "brand_character";

  validate(
    output: Row,
    context: SemanticValidationContext,
  ): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const metadata = row(output.output_metadata);
    const fail = (code: string, objectId: string) =>
      issues.push({
        category: "SEMANTIC",
        code,
        componentPath: objectId,
        message:
          "Character output violates frozen identity, alignment or grounded-support rules",
      });
    for (const objectId of ["brand_values", "brand_personality"] as const) {
      const items = output[objectId];
      const metas = metadata[objectId];
      if ((items === null) !== (metas === null))
        fail("METADATA_ALIGNMENT", objectId);
      if (!Array.isArray(items) || !Array.isArray(metas)) continue;
      const ids = items.map((item) => row(item).semantic_id);
      const metaIds = metas.map((item) => row(item).semantic_id);
      if (
        new Set(ids).size !== ids.length ||
        ids.some(
          (id) => typeof id !== "string" || !id.trim() || /^\d+$/u.test(id),
        )
      )
        fail("INVALID_SEMANTIC_ITEM_ID", objectId);
      if (
        ids.length !== metaIds.length ||
        ids.some(
          (id) => metaIds.filter((candidate) => candidate === id).length !== 1,
        )
      )
        fail("SEMANTIC_ITEM_METADATA_MISMATCH", objectId);
      const labels = items.map((item) =>
        normalized(
          String(
            row(item)[objectId === "brand_values" ? "value" : "trait"] ?? "",
          ),
        ),
      );
      if (new Set(labels).size !== labels.length)
        fail("DUPLICATE_CHARACTER_MEANING", objectId);
      for (const item of items) {
        const value = row(item);
        const label = String(
          value[objectId === "brand_values" ? "value" : "trait"] ?? "",
        );
        const meta = row(
          metas.find(
            (candidate) => row(candidate).semantic_id === value.semantic_id,
          ),
        );
        const refs = Array.isArray(meta.evidence_refs)
          ? meta.evidence_refs
          : [];
        const support = context.evidenceManifest.filter((entry) =>
          refs.includes(entry.evidenceRef),
        );
        const establishing = support.filter((entry) =>
          this.establishes(entry, objectId),
        );
        if (!establishing.length)
          fail("NON_ESTABLISHING_CHARACTER_EVIDENCE", objectId);
        if (
          /\b(visual style|campaign tone|audience personality|founder personality|communication tone)\b/iu.test(
            label,
          )
        )
          fail("CHARACTER_SCOPE_VIOLATION", objectId);
        const filler =
          /\b(innovative|authentic|customer[ -]centric|friendly|premium)\b/iu.exec(
            label,
          )?.[0];
        if (
          filler &&
          !establishing.some((entry) =>
            normalized(textOf(entry)).includes(normalized(filler)),
          )
        )
          fail("UNSUPPORTED_GENERIC_CHARACTER", objectId);
        if (meta.authority === "SYSTEM_DERIVED")
          fail("MODEL_CANNOT_CLAIM_DETERMINISTIC_AUTHORITY", objectId);
        if (
          meta.authority === "OBSERVED" &&
          !establishing.some((entry) =>
            normalized(textOf(entry)).includes(normalized(label)),
          )
        )
          fail("OBSERVED_CHARACTER_NOT_EXPLICIT", objectId);
      }
    }
    return issues;
  }

  private establishes(entry: EvidenceManifestEntry, objectId: string): boolean {
    if (
      ![
        "owned_website.brand_company_context",
        "owned_website.brand_messaging",
      ].includes(entry.capabilityId)
    )
      return false;
    if (
      !["PERSISTENT_BRAND_LEVEL", "REPEATED_REPRESENTATIVE"].includes(
        entry.representativeness ?? "",
      )
    )
      return false;
    if (entry.polarity === "EXPLICIT_NEGATIVE") return false;
    const payload = row(entry.normalizedPayload);
    const text = textOf(entry);
    if (
      !text ||
      /\b(campaign|one.off|limited.time|this week|font|logo|typography|color palette)\b/iu.test(
        text,
      )
    )
      return false;
    if (
      /\b(founder|he|she)\b/iu.test(text) &&
      !/\b(our (?:brand|company|mission|values)|we (?:believe|value|are)|brand.wide)\b/iu.test(
        text,
      )
    )
      return false;
    const principle =
      payload.assertion_nature === "BRAND_AUTHORED_PRINCIPLE_OR_VALUE" ||
      ["MISSION_OR_PURPOSE", "STATED_PRINCIPLE"].includes(
        String(payload.statement_class),
      ) ||
      /\b(our (?:mission|values|principles|commitment)|we (?:believe|value|commit))\b/iu.test(
        text,
      );
    if (objectId === "brand_values")
      return (
        principle ||
        (entry.representativeness === "REPEATED_REPRESENTATIVE" &&
          /\b(we always|our commitment|our principles|we stand for)\b/iu.test(
            text,
          ))
      );
    // A page classification alone cannot turn one playful headline into character.
    return (
      /\b(we are|our (?:brand|character|personality)|as a brand)\b/iu.test(
        text,
      ) ||
      (entry.representativeness === "REPEATED_REPRESENTATIVE" &&
        /\b(we|our brand)\b/iu.test(text))
    );
  }
}
