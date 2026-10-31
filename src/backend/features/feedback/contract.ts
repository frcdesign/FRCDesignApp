/** What a report carries and how it is labelled. A leaf, so the frontend can import it. */
import * as z from "zod";
import { LibraryId } from "../library/library-id";

/** What a report is about; a library topic is spelled as its `LibraryId`. */
export enum FeedbackTopic {
    APP = "app",
    VERSION_MANAGER = "version-manager",
    FRC_DESIGN_LIB = "frc-design-lib",
    MKCAD = "mkcad",
    CONFIG_LIB = "config-lib"
}

export enum FeedbackCategory {
    BUG = "bug",
    FEATURE_REQUEST = "feature-request",
    QUESTION = "question",
    PART_REQUEST = "part-request",
    ORGANIZATION = "organization",
    METADATA = "metadata",
    INCORRECT_PART = "incorrect-part",
    BROKEN_CONFIGURATION = "broken-configuration",
    INSERT_FAILED = "insert-failed",
    THUMBNAIL = "thumbnail",
    OTHER = "other"
}

/** Where the report was started, which decides what it carries. */
export enum FeedbackSource {
    /** The form in settings, or any other that names no part or error. */
    GENERAL = "general",
    /** A part's menu: the report names the part. */
    PART = "part",
    /** An error's Report button: the report carries the error. */
    ERROR = "error"
}

export const FEEDBACK_TOPIC_LABELS: Record<FeedbackTopic, string> = {
    [FeedbackTopic.APP]: "FRCDesignApp",
    [FeedbackTopic.VERSION_MANAGER]: "Version Manager",
    [FeedbackTopic.FRC_DESIGN_LIB]: "FRCDesignLib",
    [FeedbackTopic.MKCAD]: "MKCad",
    [FeedbackTopic.CONFIG_LIB]: "ConfigLib"
};

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
    [FeedbackCategory.BUG]: "Bug",
    [FeedbackCategory.FEATURE_REQUEST]: "Feature request",
    [FeedbackCategory.QUESTION]: "Question",
    [FeedbackCategory.PART_REQUEST]: "Part request",
    [FeedbackCategory.ORGANIZATION]: "Search or organization",
    [FeedbackCategory.METADATA]: "Missing or incorrect metadata",
    [FeedbackCategory.INCORRECT_PART]: "Incorrect part",
    [FeedbackCategory.BROKEN_CONFIGURATION]: "Broken configuration",
    [FeedbackCategory.INSERT_FAILED]: "Insert fails",
    [FeedbackCategory.THUMBNAIL]: "Wrong or missing thumbnail",
    [FeedbackCategory.OTHER]: "Other"
};

export const FEEDBACK_SOURCE_LABELS: Record<FeedbackSource, string> = {
    [FeedbackSource.GENERAL]: "Feedback form",
    [FeedbackSource.PART]: "Part menu",
    [FeedbackSource.ERROR]: "Error report"
};

/** In the order the form lists them. */
export const FEEDBACK_TOPICS = Object.values(FeedbackTopic);

const APP_CATEGORIES = [
    FeedbackCategory.BUG,
    FeedbackCategory.FEATURE_REQUEST,
    FeedbackCategory.QUESTION,
    FeedbackCategory.OTHER
];

const LIBRARY_CATEGORIES = [
    FeedbackCategory.PART_REQUEST,
    FeedbackCategory.ORGANIZATION,
    FeedbackCategory.BUG,
    FeedbackCategory.FEATURE_REQUEST,
    FeedbackCategory.OTHER
];

const PART_CATEGORIES = [
    FeedbackCategory.METADATA,
    FeedbackCategory.INCORRECT_PART,
    FeedbackCategory.BROKEN_CONFIGURATION,
    FeedbackCategory.INSERT_FAILED,
    FeedbackCategory.THUMBNAIL,
    FeedbackCategory.OTHER
];

/** The library a topic is about; undefined for the app's own topics. */
export function topicLibrary(topic: FeedbackTopic): LibraryId | undefined {
    switch (topic) {
        case FeedbackTopic.FRC_DESIGN_LIB:
            return LibraryId.FRC_DESIGN_LIB;
        case FeedbackTopic.MKCAD:
            return LibraryId.MKCAD;
        case FeedbackTopic.CONFIG_LIB:
            return LibraryId.CONFIG_LIB;
        case FeedbackTopic.APP:
        case FeedbackTopic.VERSION_MANAGER:
            return undefined;
    }
}

export function libraryTopic(libraryId: LibraryId): FeedbackTopic {
    switch (libraryId) {
        case LibraryId.FRC_DESIGN_LIB:
            return FeedbackTopic.FRC_DESIGN_LIB;
        case LibraryId.MKCAD:
            return FeedbackTopic.MKCAD;
        case LibraryId.CONFIG_LIB:
            return FeedbackTopic.CONFIG_LIB;
    }
}

/** The categories a report may take, in the order the form lists them. */
export function feedbackCategories(
    topic: FeedbackTopic,
    source: FeedbackSource
): FeedbackCategory[] {
    if (source === FeedbackSource.PART) {
        return PART_CATEGORIES;
    }
    return topicLibrary(topic) ? LIBRARY_CATEGORIES : APP_CATEGORIES;
}

/** Discord's own cap on a message is 4096; this leaves room for the rest. */
export const MAX_FEEDBACK_MESSAGE = 2000;
const MAX_CONTACT = 200;
const MAX_FIELD = 1000;
const MAX_ID = 100;

/** Diagnostics are clipped rather than refused: a long error shouldn't lose the report. */
function clipped(max: number) {
    return z.string().transform((value) => value.slice(0, max));
}

const idField = clipped(MAX_ID).optional();

/** Gathered by the client, since only it knows the page and the launch. */
export const feedbackDiagnosticsSchema = z.object({
    url: clipped(MAX_FIELD),
    build: idField,
    /** What Onshape launched the app with; in-app navigation drops it from the url. */
    launch: z
        .object({
            documentId: idField,
            instanceType: idField,
            instanceId: idField,
            elementId: idField,
            elementType: idField,
            sessionCompanyId: idField,
            server: clipped(MAX_FIELD).optional()
        })
        .optional(),
    /** The level the app is viewed at, which can be below what is granted. */
    viewedAccessLevel: idField,
    viewport: idField,
    /** Set when the report was started from an error. */
    error: z
        .object({
            /** What the user was shown. */
            shown: clipped(MAX_FIELD),
            kind: idField,
            /** The error's own message, which the user may not have been shown. */
            detail: clipped(MAX_FIELD).optional()
        })
        .optional()
});

export type FeedbackDiagnostics = z.input<typeof feedbackDiagnosticsSchema>;

export const feedbackBody = z
    .object({
        topic: z.enum(FeedbackTopic),
        category: z.enum(FeedbackCategory),
        source: z.enum(FeedbackSource),
        /** May be empty only for an error, which says something on its own. */
        message: z.string().trim().max(MAX_FEEDBACK_MESSAGE),
        contact: z.string().trim().max(MAX_CONTACT).optional(),
        /** Only from a part's menu, whose library must be the topic's. */
        part: z
            .object({
                insertableId: z.string().min(1).max(MAX_ID),
                /** Set when the reporter chose to include the configuration. */
                selection: z
                    .record(z.string().max(MAX_ID), z.string().max(MAX_FIELD))
                    .optional()
            })
            .optional(),
        diagnostics: feedbackDiagnosticsSchema
    })
    .refine(
        (body) =>
            feedbackCategories(body.topic, body.source).includes(body.category),
        "The category doesn't belong to the topic."
    )
    .refine(
        (body) => (body.source === FeedbackSource.PART) === !!body.part,
        "Only a part report names a part."
    )
    .refine(
        (body) =>
            body.message.length > 0 || body.source === FeedbackSource.ERROR,
        "A report needs a message."
    );

export type FeedbackIn = z.input<typeof feedbackBody>;

export interface FeedbackOut {
    /** Quoted in the Discord post, so a report can be found from the app. */
    reportId: string;
}
