import { describe, expect, it } from "vitest";

import { IntelligencePersistenceError } from "../domain/intelligence-persistence.error";
import { ComponentPathCodec } from "./component-path.codec";

describe("ComponentPathCodec", () => {
  const codec = new ComponentPathCodec();

  it("round-trips root, field, nested field, and semantic item paths", () => {
    const segments = [
      { kind: "item" as const, semanticId: "persona/a" },
      { kind: "field" as const, value: "motivations" },
      { kind: "item" as const, semanticId: "why 100%" },
    ];
    const encoded = codec.encode(segments);

    expect(encoded).toBe("$/i/persona%2Fa/f/motivations/i/why%20100%25");
    expect(codec.decode(encoded).segments).toEqual(segments);
    expect(codec.normalize(encoded)).toBe(encoded);
    expect(codec.decode("$").segments).toEqual([]);
  });

  it("keeps presentation order out of semantic identity", () => {
    const path = codec.encode([{ kind: "item", semanticId: "stable-id" }]);
    expect(path).toBe("$/i/stable-id");
    expect(path).not.toContain("0");
  });

  it.each([
    "",
    "/f/name",
    "$/f",
    "$/x/name",
    "$/f/",
    "$/f/..",
    "$/i/0",
    "$/i/%",
    "$/f/name/extra",
  ])("rejects malformed or ambiguous path %s", (path) => {
    expect(() => codec.decode(path)).toThrow(IntelligencePersistenceError);
  });

  it("distinguishes normalization from canonical assertion", () => {
    expect(codec.normalize("$/f/a%2fb")).toBe("$/f/a%2Fb");
    expect(() => codec.assertCanonical("$/f/a%2fb")).toThrowError(
      expect.objectContaining({ code: "INVALID_SEMANTIC_PATH" }),
    );
  });
});
