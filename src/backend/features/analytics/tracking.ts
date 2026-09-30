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
import {
    EVENT_SCHEMA_VERSION,
    EventType,
    InsertSource,
    VersionRunKind
} from "./usage";
import type {
    PullScopeKind,
    PushScopeKind,
    VersionJobResult
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

/**
 * As `trackInsert`. An open belongs to no library: it is the app being opened,
 * not the page it resumes into.
 */
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

/** What a finished push or pull did; see `features/version-manager`. */
export interface VersionRunEvent {
    userId: string;
    kind: VersionRunKind;
    scope: PushScopeKind | PullScopeKind;
    result: Pick<
        VersionJobResult,
        "createdVersions" | "updatedWorkspaces" | "updatedElements"
    >;
}

/**
 * Recorded by the workflow once the run has finished, so a run that failed
 * halfway still says what it managed. It belongs to no library: it acts on the
 * Onshape document the app was launched from.
 */
export async function trackVersionRun(
    env: AppBindings,
    event: VersionRunEvent
): Promise<void> {
    const { result } = event;
    await record(
        getDb(env.DB),
        {
            ...eventCore(EventType.VERSION_RUN, null, event.userId),
            ...NOT_AN_INSERT,
            versionKind: event.kind,
            versionScope: event.scope,
            createdVersions: result.createdVersions,
            updatedWorkspaces: result.updatedWorkspaces,
            updatedElements: result.updatedElements
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
