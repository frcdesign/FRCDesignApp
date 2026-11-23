import { getTableColumns } from "drizzle-orm";
import { eventColumns, type LoggedEvent } from "./event-columns";

/**
 * One event as the log stores it: the columns every event has, and the rest
 * as JSON under their D1 names. The stream's schema can't change once made,
 * so a new column goes in `data` rather than in a column of its own.
 */
export interface EventLogRecord {
    id: string;
    type: string;
    /** Epoch milliseconds. */
    created_at: number;
    day: string;
    user_id: string;
    library_id: string | null;
    schema_version: number;
    data: string;
}

/** The stream's schema, as `scripts/event-log/stream-schema.json` declares it. */
const CORE_COLUMNS = [
    "id",
    "type",
    "createdAt",
    "day",
    "userId",
    "libraryId",
    "schemaVersion"
] as const satisfies readonly (keyof LoggedEvent)[];

export function toLogRecord(event: LoggedEvent): EventLogRecord {
    const data: Record<string, unknown> = {};
    for (const [key, column] of Object.entries(getTableColumns(eventColumns))) {
        if ((CORE_COLUMNS as readonly string[]).includes(key)) continue;
        data[column.name] = event[key as keyof LoggedEvent];
    }
    return {
        id: event.id,
        type: event.type,
        created_at: event.createdAt.getTime(),
        day: event.day,
        user_id: event.userId,
        library_id: event.libraryId,
        schema_version: event.schemaVersion,
        data: JSON.stringify(data)
    };
}

/** Sends to the log; a no-op where no stream is bound, as in local dev and tests. */
export async function logEvents(
    env: { EVENT_LOG?: EventLog },
    logged: LoggedEvent[]
): Promise<void> {
    if (!env.EVENT_LOG || logged.length === 0) return;
    await env.EVENT_LOG.send(logged.map(toLogRecord));
}

/** A Pipelines stream binding, as far as the log uses one; scripts import this module too. */
export interface EventLog {
    send(records: EventLogRecord[]): Promise<void>;
}
