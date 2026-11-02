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
        tags: {
            [FeedbackTopic.APP]: "1566636688627736646",
            [FeedbackTopic.VERSION_MANAGER]: "1566636709913829576",
            [FeedbackCategory.BUG]: "1566636728180277448",
            [FeedbackCategory.FEATURE_REQUEST]: "1566636742272880640",
            [FeedbackCategory.OTHER]: "1566636757770838138",
            [ERROR_REPORT_TAG]: "1566636772836777984"
        }
    },
    [DiscordForum.LIBRARY]: {
        channel: "frcdesignlib-feedback",
        invite: "https://discord.gg/gPGBpFxm2S",
        tags: {
            [FeedbackTopic.FRC_DESIGN_LIB]: "1566635734725828659",
            [FeedbackTopic.MKCAD]: "1566635762542321735",
            [FeedbackCategory.PART_REQUEST]: "1566635785682161764",
            [FeedbackCategory.ORGANIZATION]: "1566635803914797116",
            [FeedbackCategory.BUG]: "1566635818054066237",
            [FeedbackCategory.METADATA]: "1566635865222942810",
            [FeedbackCategory.INCORRECT_GEOMETRY]: "1566635891412443186",
            [FeedbackCategory.BROKEN_CONFIGURATION]: "1566636000825049179",
            [FeedbackCategory.THUMBNAIL]: "1566636028092096572",
            [FeedbackCategory.OTHER]: "1566636055531102300"
        }
    },
    /** In ConfigLib's own server, not FRCDesign's. */
    [DiscordForum.CONFIG_LIB]: {
        channel: "configlib-feedback",
        invite: "https://discord.gg/QM4EeNQ9KC",
        tags: {
            [FeedbackCategory.PART_REQUEST]: "1566634451591758014",
            [FeedbackCategory.ORGANIZATION]: "1566637067054747849",
            [FeedbackCategory.BUG]: "1566637081210650725",
            [FeedbackCategory.METADATA]: "1566637098138730647",
            [FeedbackCategory.INCORRECT_GEOMETRY]: "1566637118959394956",
            [FeedbackCategory.BROKEN_CONFIGURATION]: "1566637138064310322",
            [FeedbackCategory.THUMBNAIL]: "1566637156498411610",
            [FeedbackCategory.OTHER]: "1566637169806807151"
        }
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
