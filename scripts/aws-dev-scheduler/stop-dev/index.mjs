import {
  DescribeDBInstancesCommand,
  RDSClient,
  StopDBInstanceCommand,
} from "@aws-sdk/client-rds";
import { ECSClient, UpdateServiceCommand } from "@aws-sdk/client-ecs";

const REGION = "ap-south-1";
const DB_INSTANCE_ID = "creator-dev-postgres-small";
const ECS_CLUSTER = "creatorshop-be-dev-apiclusterCluster";
const ECS_SERVICE = "api";

const rds = new RDSClient({ region: REGION });
const ecs = new ECSClient({ region: REGION });

export async function handler() {
  await ecs.send(
    new UpdateServiceCommand({
      cluster: ECS_CLUSTER,
      service: ECS_SERVICE,
      desiredCount: 0,
    }),
  );

  const described = await rds.send(
    new DescribeDBInstancesCommand({ DBInstanceIdentifier: DB_INSTANCE_ID }),
  );
  const status = described.DBInstances?.[0]?.DBInstanceStatus;

  if (status === "available") {
    await rds.send(
      new StopDBInstanceCommand({ DBInstanceIdentifier: DB_INSTANCE_ID }),
    );
  }

  return {
    ok: true,
    ecsDesiredCount: 0,
    dbStatus: status ?? "unknown",
    dbStopRequested: status === "available",
  };
}
