import { type AppBindings } from "../../lib/context";
import { FeedbackTopic } from "./contract";

/** The secret naming each topic's Discord webhook; FRCDesignLib and MKCad share a channel. */
const TOPIC_WEBHOOKS = {
    [FeedbackTopic.APP]: "DISCORD_APP_WEBHOOK_URL",
    [FeedbackTopic.VERSION_MANAGER]: "DISCORD_APP_WEBHOOK_URL",
    [FeedbackTopic.FRC_DESIGN_LIB]: "DISCORD_FRC_DESIGN_LIB_WEBHOOK_URL",
    [FeedbackTopic.MKCAD]: "DISCORD_FRC_DESIGN_LIB_WEBHOOK_URL",
    [FeedbackTopic.CONFIG_LIB]: "DISCORD_CONFIG_LIB_WEBHOOK_URL"
} as const satisfies Record<FeedbackTopic, keyof AppBindings>;

/** Undefined when the environment has no channel for the topic. */
export function getWebhookUrl(
    env: AppBindings,
    topic: FeedbackTopic
): string | undefined {
    return env[TOPIC_WEBHOOKS[topic]] || undefined;
}
