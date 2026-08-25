import { Injectable } from "@nestjs/common";

import { IntelligencePersistenceError } from "../domain/intelligence-persistence.error";
import {
  COMPONENT_PATH_SCHEME_VERSION,
  type ComponentPathSegment,
  type DecodedComponentPath,
} from "./component-path.types";

const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/u;
const ARRAY_INDEX = /^(0|[1-9]\d*)$/u;

function encodeSegment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/gu,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function invalidPath(message: string): never {
  throw new IntelligencePersistenceError("INVALID_SEMANTIC_PATH", message);
}

@Injectable()
export class ComponentPathCodec {
  encode(
    segments: readonly ComponentPathSegment[],
    version: number = COMPONENT_PATH_SCHEME_VERSION,
  ): string {
    this.assertVersion(version);
    const encoded = segments.flatMap((segment) => {
      if (segment.kind === "field") {
        this.assertValue(segment.value, "field");
        return ["f", encodeSegment(segment.value)];
      }

      this.assertValue(segment.semanticId, "semantic item");
      if (ARRAY_INDEX.test(segment.semanticId)) {
        invalidPath("Array positions cannot be semantic item identity");
      }
      return ["i", encodeSegment(segment.semanticId)];
    });

    return encoded.length === 0 ? "$" : `$/${encoded.join("/")}`;
  }

  decode(
    path: string,
    version: number = COMPONENT_PATH_SCHEME_VERSION,
  ): DecodedComponentPath {
    this.assertVersion(version);
    if (path === "$") {
      return { version: COMPONENT_PATH_SCHEME_VERSION, segments: [] };
    }
    if (!path.startsWith("$/")) {
      invalidPath("A component path must begin at the '$' root");
    }

    const rawSegments = path.slice(2).split("/");
    if (rawSegments.length === 0 || rawSegments.length % 2 !== 0) {
      invalidPath("A component path must contain typed marker/value pairs");
    }

    const segments: ComponentPathSegment[] = [];
    for (let index = 0; index < rawSegments.length; index += 2) {
      const marker = rawSegments[index];
      const rawValue = rawSegments[index + 1];
      if (marker !== "f" && marker !== "i") {
        invalidPath(`Unknown component path marker '${marker}'`);
      }
      if (!rawValue) {
        invalidPath("Component path values cannot be empty");
      }

      let value: string;
      try {
        value = decodeURIComponent(rawValue);
      } catch {
        invalidPath("Component path contains malformed percent encoding");
      }
      this.assertValue(value, marker === "f" ? "field" : "semantic item");
      if (marker === "i") {
        if (ARRAY_INDEX.test(value)) {
          invalidPath("Array positions cannot be semantic item identity");
        }
        segments.push({ kind: "item", semanticId: value });
      } else {
        segments.push({ kind: "field", value });
      }
    }

    return { version: COMPONENT_PATH_SCHEME_VERSION, segments };
  }

  normalize(
    path: string,
    version: number = COMPONENT_PATH_SCHEME_VERSION,
  ): string {
    return this.encode(this.decode(path, version).segments, version);
  }

  assertCanonical(
    path: string,
    version: number = COMPONENT_PATH_SCHEME_VERSION,
  ): void {
    if (this.normalize(path, version) !== path) {
      invalidPath("Component path is syntactically valid but not canonical");
    }
  }

  private assertVersion(version: number): void {
    if (version !== COMPONENT_PATH_SCHEME_VERSION) {
      invalidPath(`Unsupported component path scheme version '${version}'`);
    }
  }

  private assertValue(value: string, label: string): void {
    if (
      value.length === 0 ||
      value === "." ||
      value === ".." ||
      CONTROL_CHARACTER.test(value)
    ) {
      invalidPath(`Invalid ${label} path segment`);
    }
  }
}
