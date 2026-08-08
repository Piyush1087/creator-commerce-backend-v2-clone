import type { ExecutionTelemetryRecord, ProcessorTelemetryRecord, TelemetrySink } from "./types";

/** First dry-run sink. Replace/bind with DB sink when execution tables are available. */
export class StructuredLogTelemetrySink implements TelemetrySink {
  async writeExecution(record:ExecutionTelemetryRecord) {
    console.info(JSON.stringify({event:"intelligence.execution",...record}));
  }
  async writeProcessor(record:ProcessorTelemetryRecord) {
    console.info(JSON.stringify({event:"intelligence.processor_execution",...record}));
  }
}
