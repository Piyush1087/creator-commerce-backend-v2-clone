import {
  DescribeDBInstancesCommand,
  RDSClient,
  StartDBInstanceCommand,
} from "@aws-sdk/client-rds";
import { ECSClient, UpdateServiceCommand } from "@aws-sdk/client-ecs";

const REGION = "ap-south-1";
const DB_INSTANCE_ID = "creator-dev-postgres-small";
const ECS_CLUSTER = "creatorshop-be-dev-apiclusterCluster";
const ECS_SERVICE = "api";
const DB_POLL_MS = 30_000;
const DB_MAX_WAIT_MS = 12 * 60 * 1000;

const rds = new RDSClient({ region: REGION });
const ecs = new ECSClient({ region: REGION });

async function waitForDbAvailable() {
  const deadline = Date.now() + DB_MAX_WAIT_MS;

  while (Date.now() < deadline) {
    const described = await rds.send(
      new DescribeDBInstancesCommand({ DBInstanceIdentifier: DB_INSTANCE_ID }),
    );
    const status = described.DBInstances?.[0]?.DBInstanceStatus;

    if (status === "available") {
      return status;
    }
    if (status === "failed") {
      throw new Error(`RDS ${DB_INSTANCE_ID} entered failed state`);
    }

    await new Promise((resolve) => setTimeout(resolve, DB_POLL_MS));
  }

  throw new Error(`Timed out waiting for ${DB_INSTANCE_ID} to become available`);
}

export async function handler() {
  const described = await rds.send(
    new DescribeDBInstancesCommand({ DBInstanceIdentifier: DB_INSTANCE_ID }),
  );
  let status = described.DBInstances?.[0]?.DBInstanceStatus;

  if (status === "stopped") {
    await rds.send(
      new StartDBInstanceCommand({ DBInstanceIdentifier: DB_INSTANCE_ID }),
    );
    status = await waitForDbAvailable();
  } else if (status !== "available") {
    status = await waitForDbAvailable();
  }

  await ecs.send(
    new UpdateServiceCommand({
      cluster: ECS_CLUSTER,
      service: ECS_SERVICE,
      desiredCount: 1,
    }),
  );

  return {
    ok: true,
    ecsDesiredCount: 1,
    dbStatus: status ?? "unknown",
  };
}
