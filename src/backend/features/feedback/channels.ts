import * as z from "zod";
import { type AppBindings } from "../../lib/context";
import { FeedbackCategory, FeedbackSource, FeedbackTopic } from "./contract";

/** The bindings naming each topic's forum; FRCDesignLib and MKCad share one. */
const TOPIC_CHANNELS = {
    [FeedbackTopic.APP]: {
        webhook: "DISCORD_APP_WEBHOOK_URL",
        tags: "DISCORD_APP_TAG_IDS"
    },
    [FeedbackTopic.VERSION_MANAGER]: {
        webhook: "DISCORD_APP_WEBHOOK_URL",
        tags: "DISCORD_APP_TAG_IDS"
    },
    [FeedbackTopic.FRC_DESIGN_LIB]: {
        webhook: "DISCORD_FRC_DESIGN_LIB_WEBHOOK_URL",
        tags: "DISCORD_FRC_DESIGN_LIB_TAG_IDS"
    },
    [FeedbackTopic.MKCAD]: {
        webhook: "DISCORD_FRC_DESIGN_LIB_WEBHOOK_URL",
        tags: "DISCORD_FRC_DESIGN_LIB_TAG_IDS"
    },
    [FeedbackTopic.CONFIG_LIB]: {
        webhook: "DISCORD_CONFIG_LIB_WEBHOOK_URL",
        tags: "DISCORD_CONFIG_LIB_TAG_IDS"
    }
} as const satisfies Record<
    FeedbackTopic,
    { webhook: keyof AppBindings; tags: keyof AppBindings }
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

const tagIdsSchema = z.record(z.string(), z.string());

export interface FeedbackChannel {
    webhookUrl: string;
    /** By {@link FeedbackTagKey}; a key with no id is left untagged. */
    tagIds: Partial<Record<string, string>>;
}

/** Tag ids are JSON, `{"bug": "1234…"}`; a malformed value tags nothing rather than failing reports. */
function parseTagIds(raw: string | undefined): Record<string, string> {
    if (!raw) return {};
    try {
        return tagIdsSchema.parse(JSON.parse(raw));
    } catch (error) {
        console.error("Ignoring malformed Discord tag ids", error);
        return {};
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
    return { webhookUrl, tagIds: parseTagIds(env[bindings.tags]) };
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
