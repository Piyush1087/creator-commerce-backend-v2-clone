import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { IntelligencePersistenceError } from "../domain/intelligence-persistence.error";
import { ComponentPathCodec } from "../semantic-path/component-path.codec";

export type ObjectGenerationWrite = Omit<
  Prisma.IntelligenceObjectGenerationUncheckedCreateInput,
  "createdAt"
>;
export type ComponentGenerationWrite = Omit<
  Prisma.IntelligenceComponentGenerationUncheckedCreateInput,
  "createdAt" | "objectGenerationId" | "brandId" | "objectSemanticId"
>;
export type EvidenceReferenceWrite = Omit<
  Prisma.IntelligenceEvidenceReferenceUncheckedCreateInput,
  "createdAt" | "objectGenerationId" | "brandId"
>;
export type BusinessStateReferenceWrite = Omit<
  Prisma.IntelligenceBusinessStateReferenceUncheckedCreateInput,
  "createdAt" | "objectGenerationId" | "brandId"
>;

export interface PersistGenerationCommand {
  readonly object: ObjectGenerationWrite;
  readonly components: readonly ComponentGenerationWrite[];
  readonly evidenceReferences?: readonly EvidenceReferenceWrite[];
  readonly businessStateReferences?: readonly BusinessStateReferenceWrite[];
}

const generationInclude =
  Prisma.validator<Prisma.IntelligenceObjectGenerationInclude>()({
    componentGenerations: true,
    evidenceReferences: true,
    businessStateReferences: true,
  });

export type PersistedGeneration =
  Prisma.IntelligenceObjectGenerationGetPayload<{
    include: typeof generationInclude;
  }>;

function canonicalize(value: unknown): string {
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function commandMaterial(command: PersistGenerationCommand): unknown {
  const { id: _objectId, ...object } = command.object;
  return {
    object,
    components: command.components
      .map(({ id: _componentId, ...component }) => component)
      .sort((left, right) =>
        left.componentSemanticPath.localeCompare(right.componentSemanticPath),
      ),
    evidenceReferences: [...(command.evidenceReferences ?? [])]
      .map(({ id: _referenceId, ...reference }) => reference)
      .sort((left, right) =>
        `${left.componentSemanticPath}:${left.evidenceRef}:${left.capabilityId}`.localeCompare(
          `${right.componentSemanticPath}:${right.evidenceRef}:${right.capabilityId}`,
        ),
      ),
    businessStateReferences: [...(command.businessStateReferences ?? [])]
      .map(({ id: _referenceId, ...reference }) => reference)
      .sort((left, right) =>
        `${left.componentSemanticPath}:${left.entityType}:${left.entityId}:${left.semanticFieldPath}:${left.revisionToken}`.localeCompare(
          `${right.componentSemanticPath}:${right.entityType}:${right.entityId}:${right.semanticFieldPath}:${right.revisionToken}`,
        ),
      ),
  };
}

function storedMaterial(generation: PersistedGeneration): unknown {
  const {
    id: _objectId,
    createdAt: _objectCreatedAt,
    componentGenerations,
    evidenceReferences,
    businessStateReferences,
    ...object
  } = generation;
  return {
    object,
    components: componentGenerations
      .map(
        ({
          id: _componentId,
          brandId: _brandId,
          objectGenerationId: _objectGenerationId,
          objectSemanticId: _objectSemanticId,
          createdAt: _componentCreatedAt,
          ...component
        }) => component,
      )
      .sort((left, right) =>
        left.componentSemanticPath.localeCompare(right.componentSemanticPath),
      ),
    evidenceReferences: evidenceReferences
      .map(
        ({
          id: _referenceId,
          brandId: _brandId,
          objectGenerationId: _objectGenerationId,
          createdAt: _referenceCreatedAt,
          ...reference
        }) => reference,
      )
      .sort((left, right) =>
        `${left.componentSemanticPath}:${left.evidenceRef}:${left.capabilityId}`.localeCompare(
          `${right.componentSemanticPath}:${right.evidenceRef}:${right.capabilityId}`,
        ),
      ),
    businessStateReferences: businessStateReferences
      .map(
        ({
          id: _referenceId,
          brandId: _brandId,
          objectGenerationId: _objectGenerationId,
          createdAt: _referenceCreatedAt,
          ...reference
        }) => reference,
      )
      .sort((left, right) =>
        `${left.componentSemanticPath}:${left.entityType}:${left.entityId}:${left.semanticFieldPath}:${left.revisionToken}`.localeCompare(
          `${right.componentSemanticPath}:${right.entityType}:${right.entityId}:${right.semanticFieldPath}:${right.revisionToken}`,
        ),
      ),
  };
}

@Injectable()
export class IntelligenceGenerationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pathCodec: ComponentPathCodec,
  ) {}

  async persist(
    command: PersistGenerationCommand,
  ): Promise<PersistedGeneration> {
    this.assertCommand(command);
    const existing = await this.findPersistenceIdentity(command);
    if (existing) return this.assertReplay(existing, command);

    try {
      return await this.prisma.$transaction((tx) =>
        this.persistInTransaction(tx, command),
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const raced = await this.findPersistenceIdentity(command);
        if (raced) return this.assertReplay(raced, command);
      }
      throw this.mapPersistenceError(error);
    }
  }

  /** Allows a later persistence application service to share one bounded transaction with CAS decisions. */
  async persistInTransaction(
    tx: Prisma.TransactionClient,
    command: PersistGenerationCommand,
  ): Promise<PersistedGeneration> {
    this.assertCommand(command);
    const existing = await this.findPersistenceIdentity(command, tx);
    if (existing) return this.assertReplay(existing, command);

    const object = await tx.intelligenceObjectGeneration.create({
      data: command.object,
    });
    if (command.components.length > 0) {
      await tx.intelligenceComponentGeneration.createMany({
        data: command.components.map((component) => ({
          ...component,
          brandId: object.brandId,
          objectGenerationId: object.id,
          objectSemanticId: object.objectSemanticId,
        })),
      });
    }
    if ((command.evidenceReferences?.length ?? 0) > 0) {
      await tx.intelligenceEvidenceReference.createMany({
        data: command.evidenceReferences!.map((reference) => ({
          ...reference,
          brandId: object.brandId,
          objectGenerationId: object.id,
        })),
      });
    }
    if ((command.businessStateReferences?.length ?? 0) > 0) {
      await tx.intelligenceBusinessStateReference.createMany({
        data: command.businessStateReferences!.map((reference) => ({
          ...reference,
          brandId: object.brandId,
          objectGenerationId: object.id,
        })),
      });
    }
    return tx.intelligenceObjectGeneration.findUniqueOrThrow({
      where: { id: object.id },
      include: generationInclude,
    });
  }

  getById(id: string): Promise<PersistedGeneration | null> {
    return this.prisma.intelligenceObjectGeneration.findUnique({
      where: { id },
      include: generationInclude,
    });
  }

  private async findPersistenceIdentity(
    command: PersistGenerationCommand,
    client: Pick<
      Prisma.TransactionClient,
      "intelligenceObjectGeneration"
    > = this.prisma,
  ): Promise<PersistedGeneration | null> {
    const object = command.object;
    if (object.processorExecutionId) {
      return client.intelligenceObjectGeneration.findFirst({
        where: {
          processorExecutionId: object.processorExecutionId,
          objectSemanticId: object.objectSemanticId,
        },
        include: generationInclude,
      });
    }
    if (object.actionId) {
      return client.intelligenceObjectGeneration.findFirst({
        where: {
          actionId: object.actionId,
          objectSemanticId: object.objectSemanticId,
          generationOrdinal: object.generationOrdinal ?? 1,
        },
        include: generationInclude,
      });
    }
    throw new IntelligencePersistenceError(
      "PERSISTENCE_INVARIANT",
      "Generation persistence requires a processor execution or action identity",
    );
  }

  private assertCommand(command: PersistGenerationCommand): void {
    if (command.components.length === 0) {
      throw new IntelligencePersistenceError(
        "PERSISTENCE_INVARIANT",
        "An Object generation must include at least one component generation",
      );
    }
    const paths = new Set<string>();
    for (const component of command.components) {
      this.pathCodec.assertCanonical(
        component.componentSemanticPath,
        component.pathSchemeVersion ?? 1,
      );
      if (paths.has(component.componentSemanticPath)) {
        throw new IntelligencePersistenceError(
          "PERSISTENCE_INVARIANT",
          "A generation cannot contain the same component path twice",
        );
      }
      paths.add(component.componentSemanticPath);
    }
    for (const reference of [
      ...(command.evidenceReferences ?? []),
      ...(command.businessStateReferences ?? []),
    ]) {
      this.pathCodec.assertCanonical(reference.componentSemanticPath);
      if (!paths.has(reference.componentSemanticPath)) {
        throw new IntelligencePersistenceError(
          "PERSISTENCE_INVARIANT",
          "A lineage reference must address a component in the same Object generation",
        );
      }
    }
  }

  private assertReplay(
    existing: PersistedGeneration,
    command: PersistGenerationCommand,
  ): PersistedGeneration {
    if (
      canonicalize(storedMaterial(existing)) !==
      canonicalize(commandMaterial(command))
    ) {
      throw new IntelligencePersistenceError(
        "IDEMPOTENCY_CONFLICT",
        "Generation persistence identity was replayed with different content",
      );
    }
    return existing;
  }

  private mapPersistenceError(error: unknown): IntelligencePersistenceError {
    if (error instanceof IntelligencePersistenceError) return error;
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        return new IntelligencePersistenceError(
          "TENANCY_VIOLATION",
          "Generation lineage does not belong to the requested Brand",
        );
      }
      return new IntelligencePersistenceError(
        "PERSISTENCE_INVARIANT",
        "Generation persistence violated a database invariant",
      );
    }
    return new IntelligencePersistenceError(
      "PERSISTENCE_INVARIANT",
      "Generation persistence failed",
    );
  }
}
