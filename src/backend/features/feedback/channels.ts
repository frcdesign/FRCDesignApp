import * as z from "zod";
import { type AppBindings } from "../../lib/context";
import {
    FeedbackCategory,
    FeedbackSource,
    FeedbackTopic,
    type ReportForum
} from "./contract";

/** The bindings naming each topic's forum; FRCDesignLib and MKCad share one. */
const TOPIC_CHANNELS = {
    [FeedbackTopic.APP]: {
        webhook: "DISCORD_APP_WEBHOOK_URL",
        forum: "DISCORD_APP_FORUM"
    },
    [FeedbackTopic.VERSION_MANAGER]: {
        webhook: "DISCORD_APP_WEBHOOK_URL",
        forum: "DISCORD_APP_FORUM"
    },
    [FeedbackTopic.FRC_DESIGN_LIB]: {
        webhook: "DISCORD_FRC_DESIGN_LIB_WEBHOOK_URL",
        forum: "DISCORD_FRC_DESIGN_LIB_FORUM"
    },
    [FeedbackTopic.MKCAD]: {
        webhook: "DISCORD_FRC_DESIGN_LIB_WEBHOOK_URL",
        forum: "DISCORD_FRC_DESIGN_LIB_FORUM"
    },
    [FeedbackTopic.CONFIG_LIB]: {
        webhook: "DISCORD_CONFIG_LIB_WEBHOOK_URL",
        forum: "DISCORD_CONFIG_LIB_FORUM"
    }
} as const satisfies Record<
    FeedbackTopic,
    { webhook: keyof AppBindings; forum: keyof AppBindings }
>;

/** The tag every report started from an error is filed under, beside its type's. */
export const ERROR_REPORT_TAG = "error-report";

/** What a forum's tag ids are keyed by: a topic, a category, or `error-report`. */
export type FeedbackTagKey =
    | FeedbackTopic
    | FeedbackCategory
    | typeof ERROR_REPORT_TAG;

/** Discord applies at most five tags to a thread. */
const MAX_TAGS = 5;

/** A forum's settings: what a reporter is told and sent to, and its tags. */
const forumSchema = z.object({
    name: z.string().min(1).optional(),
    invite: z.url().optional(),
    tags: z.record(z.string(), z.string()).default({})
});

export interface FeedbackChannel {
    webhookUrl: string;
    forum: ReportForum;
    /** By {@link FeedbackTagKey}; a key with no id is left untagged. */
    tagIds: Partial<Record<string, string>>;
}

/**
 * An object from `wrangler.jsonc`'s vars, or its JSON text from `.env`. A
 * malformed value is ignored rather than failing reports.
 */
function parseForum(raw: unknown): z.infer<typeof forumSchema> {
    if (raw === undefined || raw === "") return { tags: {} };
    try {
        return forumSchema.parse(
            typeof raw === "string" ? JSON.parse(raw) : raw
        );
    } catch (error) {
        console.error("Ignoring malformed Discord forum settings", error);
        return { tags: {} };
    }
}

/** Undefined when the environment has no forum for the topic. */
export function getChannel(
    env: AppBindings,
    topic: FeedbackTopic
): FeedbackChannel | undefined {
    const bindings = TOPIC_CHANNELS[topic];
    const webhookUrl = env[bindings.webhook];
    if (!webhookUrl) return undefined;
    const forum = parseForum(env[bindings.forum]);
    return {
        webhookUrl,
        forum: { name: forum.name, inviteUrl: forum.invite },
        tagIds: forum.tags
    };
}

/** The report's topic, its type, and whether it came from an error. */
export function reportTagKeys(
    topic: FeedbackTopic,
    category: FeedbackCategory,
    source: FeedbackSource
): FeedbackTagKey[] {
    const keys: FeedbackTagKey[] = [topic, category];
    if (source === FeedbackSource.ERROR) keys.push(ERROR_REPORT_TAG);
    return keys;
}

/** The forum's ids for those keys that it has a tag for. */
export function reportTagIds(
    channel: FeedbackChannel,
    keys: FeedbackTagKey[]
): string[] {
    return keys
        .map((key) => channel.tagIds[key])
        .filter((id): id is string => id !== undefined)
        .slice(0, MAX_TAGS);
}
