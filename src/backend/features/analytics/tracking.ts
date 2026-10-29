import type { BatchItem } from "drizzle-orm/batch";
import { runInBackground } from "../../lib/background";
import { type AppBindings, type AppContext } from "../../lib/context";
import { getDb, type Db } from "../../db/client";
import { events, type LoggedEvent } from "./schema";
import {
    NOT_AN_INSERT,
    NOT_A_VERSION_RUN,
    type EventCore
} from "./logged-event";
import { rollupWrites } from "./rollups";
import { EVENT_SCHEMA_VERSION, EventType, InsertSource } from "./usage";
import {
    failedTaskCount,
    jobOutcome,
    VersionJobOutcome,
    type PullScopeKind,
    type VersionJobKind,
    type PushScopeKind,
    type VersionJobStatus
} from "../version-manager/contract";
import { type LibraryId } from "../library/library-id";
import { type ElementPath } from "../../lib/onshape/path";
import { ElementType } from "../../lib/onshape/element-type";
import {
    type ConfigurationParameter,
    type Selection
} from "../configurations/contract";
import { canonicalValues } from "../configurations/selection";
import { toDayKey } from "./day";

/** The caller is the one who inserted; see `trackInsert`. */
export interface InsertEvent {
    libraryId: LibraryId;
    /** The rollups key on the element id; the rest records the version. */
    path: ElementPath;
    insertableId: string;
    /** The type of tab the user inserted into. */
    targetElementType: ElementType;
    /** The whole selection the insert applied; undefined when it has none. */
    selection: Selection | undefined;
    /** Passed in, since the insert already loaded them. */
    parameters: ConfigurationParameter[];
    /** Whether the part was favorited, not where the insert came from. */
    isFavorite: boolean;
    isQuickInsert: boolean;
    source: InsertSource;
    fasten: boolean;
}

/** After the response, and never failing it: tracking is not what was asked for. */
export function trackInsert(c: AppContext, event: InsertEvent): Promise<void> {
    return runInBackground(c, "record an insert", async () =>
        record(
            getDb(c.env.DB),
            {
                ...eventCore(
                    EventType.INSERT,
                    event.libraryId,
                    await c.var.getUserId()
                ),
                ...NOT_A_VERSION_RUN,
                ...event.path,
                insertableId: event.insertableId,
                targetElementType: event.targetElementType,
                selection: appliedSelection(event.selection, event.parameters),
                isFavorite: event.isFavorite,
                isQuickInsert: event.isQuickInsert,
                source: event.source,
                fasten: event.fasten
            },
            event.parameters
        )
    );
}

/** As `trackInsert`, for a launch from Onshape. */
export function trackAppOpen(c: AppContext): Promise<void> {
    return runInBackground(c, "record an app open", async () =>
        record(
            getDb(c.env.DB),
            {
                ...eventCore(EventType.APP_OPEN, null, await c.var.getUserId()),
                ...NOT_AN_INSERT,
                ...NOT_A_VERSION_RUN
            },
            []
        )
    );
}

/** Canonical, so "5 in" and "(2 + 3) in" count as one. Null when there's nothing to configure. */
function appliedSelection(
    selection: Selection | undefined,
    parameters: ConfigurationParameter[]
): Selection | null {
    if (!selection || parameters.length === 0) return null;
    return canonicalValues(selection, parameters);
}

/** What every logged event carries; its kind fills in the rest. */
function eventCore(
    type: EventType,
    libraryId: LibraryId | null,
    userId: string
): EventCore {
    const now = Date.now();
    return {
        id: crypto.randomUUID(),
        type,
        createdAt: new Date(now),
        day: toDayKey(now),
        libraryId,
        userId,
        schemaVersion: EVENT_SCHEMA_VERSION
    };
}

/** A finished push or pull; see `features/version-manager`. */
export interface VersionRunEvent {
    userId: string;
    kind: VersionJobKind;
    scope: PushScopeKind | PullScopeKind;
    /** How it ended. */
    status: VersionJobStatus;
}

/** Recorded by the workflow once the run has ended, however it ended. */
export async function trackVersionRun(
    env: AppBindings,
    event: VersionRunEvent
): Promise<void> {
    const { status } = event;
    await record(
        getDb(env.DB),
        {
            ...eventCore(EventType.VERSION_RUN, null, event.userId),
            ...NOT_AN_INSERT,
            versionKind: event.kind,
            versionScope: event.scope,
            versionUpdateOnly: status.updateOnly ?? false,
            versionOutcome: jobOutcome(status) ?? VersionJobOutcome.FAILED,
            failedSteps: failedTaskCount(status),
            createdVersions: status.result?.createdVersions ?? 0,
            updatedElements: status.result?.updatedElements ?? 0
        },
        []
    );
}

/** Batched so neither half lands without the other. */
async function record(
    db: Db,
    event: LoggedEvent,
    parameters: ConfigurationParameter[]
): Promise<void> {
    const writes: BatchItem<"sqlite">[] = [
        db.insert(events).values(event),
        ...rollupWrites(db, event, parameters)
    ];

    await db.batch(writes as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}
