import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { z } from "zod";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveJsonSchemaType(
  node: Record<string, unknown>,
): string | undefined {
  const type = node.type;
  if (typeof type === "string") {
    return type;
  }
  if (Array.isArray(type)) {
    return type.find((t) => t !== "null");
  }
  if (Array.isArray(node.anyOf)) {
    for (const branch of node.anyOf) {
      if (!isRecord(branch)) {
        continue;
      }
      const resolved = resolveJsonSchemaType(branch);
      if (resolved && resolved !== "null") {
        return resolved;
      }
    }
  }
  return undefined;
}

function isNullableJsonSchema(node: Record<string, unknown>): boolean {
  const type = node.type;
  if (Array.isArray(type) && type.includes("null")) {
    return true;
  }
  if (Array.isArray(node.anyOf)) {
    return node.anyOf.some(
      (branch) => isRecord(branch) && resolveJsonSchemaType(branch) === "null",
    );
  }
  return false;
}

function jsonSchemaNodeToGemini(node: unknown): ResponseSchema {
  if (!isRecord(node)) {
    return { type: SchemaType.STRING };
  }

  if (Array.isArray(node.enum) && node.enum.every((v) => typeof v === "string")) {
    return {
      type: SchemaType.STRING,
      enum: node.enum,
      nullable: isNullableJsonSchema(node) ? true : undefined,
    };
  }

  const type = resolveJsonSchemaType(node);

  if (type === "object") {
    const properties: Record<string, ResponseSchema> = {};
    const rawProps = node.properties;
    if (isRecord(rawProps)) {
      for (const [key, value] of Object.entries(rawProps)) {
        properties[key] = jsonSchemaNodeToGemini(value);
      }
    }
    return {
      type: SchemaType.OBJECT,
      properties,
      required: Array.isArray(node.required)
        ? node.required.filter((k): k is string => typeof k === "string")
        : undefined,
      nullable: isNullableJsonSchema(node) ? true : undefined,
    };
  }

  if (type === "array") {
    return {
      type: SchemaType.ARRAY,
      items: jsonSchemaNodeToGemini(node.items),
      nullable: isNullableJsonSchema(node) ? true : undefined,
    };
  }

  if (type === "integer") {
    return {
      type: SchemaType.INTEGER,
      nullable: isNullableJsonSchema(node) ? true : undefined,
    };
  }

  if (type === "number") {
    return {
      type: SchemaType.NUMBER,
      nullable: isNullableJsonSchema(node) ? true : undefined,
    };
  }

  if (type === "boolean") {
    return {
      type: SchemaType.BOOLEAN,
      nullable: isNullableJsonSchema(node) ? true : undefined,
    };
  }

  return {
    type: SchemaType.STRING,
    nullable: isNullableJsonSchema(node) ? true : undefined,
  };
}

/** Convert a Zod schema to Gemini `responseSchema` (same rules as server-side Zod parse). */
export function zodToGeminiResponseSchema(schema: z.ZodTypeAny): ResponseSchema {
  const jsonSchema = zodToJsonSchema(schema, {
    target: "openApi3",
    $refStrategy: "none",
  });
  return jsonSchemaNodeToGemini(jsonSchema);
}

/** Root JSON array (Prompt 2 / Prompt 3 style outputs). */
export function zodArrayToGeminiResponseSchema(
  itemSchema: z.ZodTypeAny,
): ResponseSchema {
  return {
    type: SchemaType.ARRAY,
    items: zodToGeminiResponseSchema(itemSchema),
  };
}
