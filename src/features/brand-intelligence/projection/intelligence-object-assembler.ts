import { Injectable } from "@nestjs/common";

import { ComponentPathCodec } from "../semantic-path/component-path.codec";
import type { ComponentPathSegment } from "../semantic-path/component-path.types";
import { IntelligenceCurrentProjectionError } from "./intelligence-current-projection.error";
import type { ProjectionComponentRecord } from "./intelligence-current-projection.repository";
import type { IntelligenceProjectedValue } from "./intelligence-current-projection.types";

@Injectable()
export class IntelligenceObjectAssembler {
  constructor(private readonly codec: ComponentPathCodec) {}

  assemble(
    components: readonly ProjectionComponentRecord[],
  ): IntelligenceProjectedValue {
    try {
      return this.assembleChecked(components);
    } catch (error) {
      if (error instanceof IntelligenceCurrentProjectionError) throw error;
      throw new IntelligenceCurrentProjectionError(
        "PROJECTION_INVARIANT",
        "Current Intelligence components could not be assembled",
      );
    }
  }

  private assembleChecked(
    components: readonly ProjectionComponentRecord[],
  ): IntelligenceProjectedValue {
    if (!components.length) return { state: "NO_CURRENT" };
    const sorted = [...components].sort((left, right) => {
      const leftDepth = this.codec.decode(left.componentSemanticPath).segments
        .length;
      const rightDepth = this.codec.decode(right.componentSemanticPath).segments
        .length;
      return (
        leftDepth - rightDepth ||
        left.componentSemanticPath.localeCompare(right.componentSemanticPath)
      );
    });
    let root: unknown;
    let rootState:
      | ProjectionComponentRecord["generation"]["valueState"]
      | null = null;
    for (const component of sorted) {
      this.codec.assertCanonical(
        component.componentSemanticPath,
        component.pathSchemeVersion,
      );
      const decoded = this.codec.decode(
        component.componentSemanticPath,
        component.pathSchemeVersion,
      );
      if (!decoded.segments.length) {
        rootState = component.generation.valueState;
        root = this.valueFor(component);
        continue;
      }
      if (root === undefined || root === null) {
        root = decoded.segments[0].kind === "item" ? [] : {};
      }
      this.apply(root, decoded.segments, component);
    }
    if (
      root !== undefined &&
      !(root === null && rootState === "EXPLICIT_NULL")
    ) {
      const order = new Map(
        components
          .filter(
            (component) => component.generation.presentationOrder !== null,
          )
          .map((component) => [
            component.componentSemanticPath,
            component.generation.presentationOrder!,
          ]),
      );
      return { state: "VALUE", value: this.sortCollections(root, [], order) };
    }
    if (rootState === "EXPLICIT_NULL") {
      return { state: "EXPLICIT_NULL", value: null };
    }
    return { state: "INTENTIONALLY_ABSENT" };
  }

  private valueFor(component: ProjectionComponentRecord): unknown {
    if (component.generation.valueState === "VALUE") {
      if (component.generation.valuePayload === null) {
        this.invariant("VALUE component has a null payload", component);
      }
      return cloneJson(component.generation.valuePayload);
    }
    if (component.generation.valueState === "EXPLICIT_NULL") return null;
    if (component.generation.valueState === "INTENTIONALLY_ABSENT") {
      return undefined;
    }
    this.invariant("Unknown persisted component value state", component);
  }

  private apply(
    root: unknown,
    segments: readonly ComponentPathSegment[],
    component: ProjectionComponentRecord,
  ): void {
    let current = root;
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const last = index === segments.length - 1;
      const next = segments[index + 1];
      if (segment.kind === "field") {
        if (!isRecord(current)) {
          this.invariant("A field path parent is not an Object", component);
        }
        if (last) {
          if (component.generation.valueState === "INTENTIONALLY_ABSENT") {
            delete current[segment.value];
          } else {
            current[segment.value] = this.valueFor(component);
          }
          return;
        }
        const existing = current[segment.value];
        if (existing === undefined || existing === null) {
          current[segment.value] = next.kind === "item" ? [] : {};
        }
        current = current[segment.value];
        continue;
      }

      if (!Array.isArray(current)) {
        this.invariant(
          "A semantic item path parent is not a collection",
          component,
        );
      }
      const itemIndex = current.findIndex(
        (item) => semanticIdOf(item) === segment.semanticId,
      );
      if (last) {
        if (component.generation.valueState === "INTENTIONALLY_ABSENT") {
          if (itemIndex >= 0) current.splice(itemIndex, 1);
          return;
        }
        if (component.generation.valueState === "EXPLICIT_NULL") {
          this.invariant(
            "A semantic collection item cannot be represented by null without identity",
            component,
          );
        }
        const value = this.valueFor(component);
        if (!isRecord(value) || value.semantic_id !== segment.semanticId) {
          this.invariant(
            "A semantic item payload must contain its matching semantic_id",
            component,
          );
        }
        if (itemIndex >= 0) current[itemIndex] = value;
        else current.push(value);
        return;
      }
      if (itemIndex < 0) {
        current.push({ semantic_id: segment.semanticId });
        current = current[current.length - 1];
      } else {
        const existing = current[itemIndex];
        if (typeof existing === "string") {
          current[itemIndex] = { semantic_id: segment.semanticId };
        }
        current = current[itemIndex];
      }
      if (!isRecord(current)) {
        this.invariant(
          "A semantic item cannot contain nested state",
          component,
        );
      }
      if (next.kind === "item") {
        this.invariant(
          "A nested item segment requires an intervening collection field",
          component,
        );
      }
    }
  }

  private sortCollections(
    value: unknown,
    path: readonly ComponentPathSegment[],
    order: ReadonlyMap<string, number>,
  ): unknown {
    if (Array.isArray(value)) {
      const items = value.map((item) => {
        const semanticId = semanticIdOf(item);
        if (!semanticId) return item;
        return this.sortCollections(
          item,
          [...path, { kind: "item", semanticId }],
          order,
        );
      });
      return items.sort((left, right) => {
        const leftId = semanticIdOf(left) ?? "";
        const rightId = semanticIdOf(right) ?? "";
        const leftOrder = leftId
          ? (order.get(
              this.codec.encode([
                ...path,
                { kind: "item", semanticId: leftId },
              ]),
            ) ?? Number.MAX_SAFE_INTEGER)
          : Number.MAX_SAFE_INTEGER;
        const rightOrder = rightId
          ? (order.get(
              this.codec.encode([
                ...path,
                { kind: "item", semanticId: rightId },
              ]),
            ) ?? Number.MAX_SAFE_INTEGER)
          : Number.MAX_SAFE_INTEGER;
        return leftOrder - rightOrder || leftId.localeCompare(rightId);
      });
    }
    if (isRecord(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([field, nested]) => [
          field,
          this.sortCollections(
            nested,
            [...path, { kind: "field", value: field }],
            order,
          ),
        ]),
      );
    }
    return value;
  }

  private invariant(
    message: string,
    component: ProjectionComponentRecord,
  ): never {
    throw new IntelligenceCurrentProjectionError(
      "PROJECTION_INVARIANT",
      message,
      { componentSemanticPath: component.componentSemanticPath },
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function semanticIdOf(value: unknown): string | null {
  if (typeof value === "string") return value;
  return isRecord(value) && typeof value.semantic_id === "string"
    ? value.semantic_id
    : null;
}

function cloneJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneJson);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, cloneJson(nested)]),
    );
  }
  return value;
}
