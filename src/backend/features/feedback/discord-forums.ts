/**
 * The FRCDesign Discord, and the forum each report topic is posted to. A leaf,
 * so the frontend can name a report's channel and offer its invite. Webhooks
 * are secrets, so they stay in the environment; see `channels.ts`.
 */
import { FeedbackCategory, FeedbackTopic } from "./contract";

/** The server's own invite, for anything with no channel of its own. */
export const DISCORD_INVITE_URL = "https://discord.gg/PMgzEUTgB7";

export enum DiscordForum {
    APP = "app",
    /** FRCDesignLib and MKCad, which share a forum. */
    LIBRARY = "library",
    CONFIG_LIB = "config-lib"
}

/** The tag every report started from an error is filed under, beside its type's. */
export const ERROR_REPORT_TAG = "error-report";

/** What a forum's tag ids are keyed by: a topic, a category, or `error-report`. */
export type FeedbackTagKey =
    | FeedbackTopic
    | FeedbackCategory
    | typeof ERROR_REPORT_TAG;

interface ForumSettings {
    /** The channel's name, without its `#`. */
    channel: string;
    /** Made from the channel, so joining lands there; the server's invite when absent. */
    invite?: string;
    /**
     * By tag key; a key with no id is left untagged. Discord's app never shows
     * a tag's id: saving the forum's settings in the browser answers with the
     * channel, whose `available_tags` hold each tag's id and name.
     */
    tags: Partial<Record<FeedbackTagKey, string>>;
}

export const DISCORD_FORUMS: Record<DiscordForum, ForumSettings> = {
    [DiscordForum.APP]: {
        channel: "frcdesignapp-feedback",
        invite: "https://discord.gg/vJXPVbxddV",
        tags: {}
    },
    [DiscordForum.LIBRARY]: {
        channel: "frcdesignlib-feedback",
        invite: "https://discord.gg/gPGBpFxm2S",
        tags: {}
    },
    /** In ConfigLib's own server, not FRCDesign's. */
    [DiscordForum.CONFIG_LIB]: {
        channel: "configlib-feedback",
        invite: "https://discord.gg/QM4EeNQ9KC",
        tags: {}
    }
};

export const TOPIC_FORUMS: Record<FeedbackTopic, DiscordForum> = {
    [FeedbackTopic.APP]: DiscordForum.APP,
    [FeedbackTopic.VERSION_MANAGER]: DiscordForum.APP,
    [FeedbackTopic.FRC_DESIGN_LIB]: DiscordForum.LIBRARY,
    [FeedbackTopic.MKCAD]: DiscordForum.LIBRARY,
    [FeedbackTopic.CONFIG_LIB]: DiscordForum.CONFIG_LIB
};

export function topicForum(topic: FeedbackTopic): ForumSettings {
    return DISCORD_FORUMS[TOPIC_FORUMS[topic]];
}

/** Where to send somebody to find a topic's reports. */
export function forumInvite(topic: FeedbackTopic): string {
    return topicForum(topic).invite ?? DISCORD_INVITE_URL;
}
