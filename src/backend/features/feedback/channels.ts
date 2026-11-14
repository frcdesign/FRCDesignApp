import { type AppBindings } from "../../lib/context";
import { FeedbackCategory, FeedbackSource, FeedbackTopic } from "./contract";
import {
    DiscordForum,
    ERROR_REPORT_TAG,
    type FeedbackTagKey,
    TOPIC_FORUMS,
    topicForum
} from "./discord-forums";

/** The secret holding each forum's webhook. */
const FORUM_WEBHOOKS = {
    [DiscordForum.APP]: "DISCORD_APP_WEBHOOK_URL",
    [DiscordForum.LIBRARY]: "DISCORD_FRC_DESIGN_LIB_WEBHOOK_URL",
    [DiscordForum.CONFIG_LIB]: "DISCORD_CONFIG_LIB_WEBHOOK_URL",
    [DiscordForum.FEATURESCRIPTS]: "DISCORD_FEATURESCRIPTS_WEBHOOK_URL"
} as const satisfies Record<DiscordForum, keyof AppBindings>;

/** Discord applies at most five tags to a thread. */
const MAX_TAGS = 5;

/** Undefined when the environment has no webhook for the topic's forum. */
export function getWebhookUrl(
    env: AppBindings,
    topic: FeedbackTopic
): string | undefined {
    return env[FORUM_WEBHOOKS[TOPIC_FORUMS[topic]]] || undefined;
}

/** The forum's ids for the report's topic, its type, and whether it came from an error. */
export function reportTagIds(
    topic: FeedbackTopic,
    category: FeedbackCategory,
    source: FeedbackSource
): string[] {
    const keys: FeedbackTagKey[] = [topic, category];
    if (source === FeedbackSource.ERROR) keys.push(ERROR_REPORT_TAG);
    const { tags } = topicForum(topic);
    return keys
        .map((key) => tags[key])
        .filter((id): id is string => id !== undefined)
        .slice(0, MAX_TAGS);
}
