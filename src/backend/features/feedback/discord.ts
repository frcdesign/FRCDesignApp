/** A report as a Discord webhook message, and posting it. */
import { HttpStatus } from "http-status-ts";
import { internalError } from "../../lib/api-error";
import {
    FEEDBACK_CATEGORY_LABELS,
    FEEDBACK_SOURCE_LABELS,
    FEEDBACK_TOPIC_LABELS,
    FeedbackCategory,
    type FeedbackDiagnostics,
    type FeedbackSource,
    type FeedbackTopic
} from "./contract";

/** The part a report names, as the server found it. */
export interface ReportedPart {
    name: string;
    groupName: string;
    /** Opens the part in Onshape, in the reported configuration when there is one. */
    url: string;
    /** `Name: value` per shown parameter; absent when the configuration was left out. */
    configuration?: string[];
}

export interface Report {
    id: string;
    topic: FeedbackTopic;
    category: FeedbackCategory;
    source: FeedbackSource;
    message: string;
    contact?: string;
    /** Undefined for a reporter who isn't signed in. */
    userId?: string;
    userAgent?: string;
    part?: ReportedPart;
    diagnostics: FeedbackDiagnostics;
    createdAt: Date;
}

interface DiscordEmbedField {
    name: string;
    value: string;
    inline?: boolean;
}

interface DiscordEmbed {
    title: string;
    url?: string;
    description: string;
    color: number;
    fields: DiscordEmbedField[];
    footer: { text: string };
    timestamp: string;
}

export interface DiscordMessage {
    embeds: DiscordEmbed[];
    /** Empty, so text a reporter typed can't ping anyone. */
    allowed_mentions: { parse: [] };
    /** Required by a forum channel, which posts each message as a thread. */
    thread_name?: string;
}

/** Discord's limits on an embed. */
const TITLE_LIMIT = 256;
const FIELD_LIMIT = 1024;
const EMBED_LIMIT = 6000;
const THREAD_NAME_LIMIT = 100;

const RED = 0xe03131;
const BLUE = 0x1c7ed6;
const ORANGE = 0xf08c00;
const GRAY = 0x868e96;

const CATEGORY_COLORS: Record<FeedbackCategory, number> = {
    [FeedbackCategory.BUG]: RED,
    [FeedbackCategory.INSERT_FAILED]: RED,
    [FeedbackCategory.BROKEN_CONFIGURATION]: RED,
    [FeedbackCategory.INCORRECT_PART]: ORANGE,
    [FeedbackCategory.METADATA]: ORANGE,
    [FeedbackCategory.THUMBNAIL]: ORANGE,
    [FeedbackCategory.ORGANIZATION]: ORANGE,
    [FeedbackCategory.FEATURE_REQUEST]: BLUE,
    [FeedbackCategory.PART_REQUEST]: BLUE,
    [FeedbackCategory.QUESTION]: BLUE,
    [FeedbackCategory.OTHER]: GRAY
};

export function truncate(text: string, limit: number): string {
    return text.length <= limit ? text : text.slice(0, limit - 1) + "…";
}

/** Fenced, so a value can't format the rest of the embed. */
function code(text: string, limit = FIELD_LIMIT): string {
    const fence = "```";
    const clean = text.replaceAll(fence, "'''");
    return fence + "\n" + truncate(clean, limit - 8) + "\n" + fence;
}

function field(name: string, value: string, inline = false) {
    return { name, value: truncate(value, FIELD_LIMIT), inline };
}

function describeLaunch(
    launch: FeedbackDiagnostics["launch"]
): string | undefined {
    if (!launch) return undefined;
    const lines = Object.entries(launch)
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([key, value]) => `${key}: ${value}`);
    return lines.length ? lines.join("\n") : undefined;
}

function reportTitle(report: Report): string {
    const category = FEEDBACK_CATEGORY_LABELS[report.category];
    const about = report.part?.name ?? FEEDBACK_TOPIC_LABELS[report.topic];
    return `${category}: ${about}`;
}

function reportFields(report: Report): DiscordEmbedField[] {
    const { diagnostics, part } = report;
    const fields = [
        field("Topic", FEEDBACK_TOPIC_LABELS[report.topic], true),
        field("Category", FEEDBACK_CATEGORY_LABELS[report.category], true),
        field("From", FEEDBACK_SOURCE_LABELS[report.source], true)
    ];
    if (part) {
        fields.push(field("Part", `${part.groupName} / ${part.name}`));
        if (part.configuration?.length) {
            fields.push(
                field("Configuration", code(part.configuration.join("\n")))
            );
        }
    }
    if (diagnostics.error) {
        const { shown, kind, detail } = diagnostics.error;
        const lines = [shown];
        if (kind) lines.push(`kind: ${kind}`);
        if (detail && detail !== shown) lines.push(`detail: ${detail}`);
        fields.push(field("Error", code(lines.join("\n"))));
    }
    if (report.contact) {
        fields.push(field("Contact", report.contact));
    }
    fields.push(field("Page", code(diagnostics.url)));
    const launch = describeLaunch(diagnostics.launch);
    if (launch) {
        fields.push(field("Launched in", code(launch)));
    }
    fields.push(
        field("Onshape user", report.userId ?? "Not signed in", true),
        field("Viewed as", diagnostics.viewedAccessLevel ?? "unknown", true),
        field("Build", diagnostics.build ?? "unknown", true)
    );
    if (diagnostics.viewport) {
        fields.push(field("Window", diagnostics.viewport, true));
    }
    if (report.userAgent) {
        fields.push(field("Browser", code(report.userAgent)));
    }
    return fields;
}

function embedLength(embed: DiscordEmbed): number {
    return (
        embed.title.length +
        embed.description.length +
        embed.footer.text.length +
        embed.fields.reduce(
            (total, each) => total + each.name.length + each.value.length,
            0
        )
    );
}

export function buildReportMessage(report: Report): DiscordMessage {
    const title = truncate(reportTitle(report), TITLE_LIMIT);
    const embed: DiscordEmbed = {
        title,
        url: report.part?.url,
        description: report.message || "_No description given._",
        color: CATEGORY_COLORS[report.category],
        fields: reportFields(report),
        footer: { text: `Report ${report.id}` },
        timestamp: report.createdAt.toISOString()
    };
    // The message is what gives: everything else is short and bounded.
    const excess = embedLength(embed) - EMBED_LIMIT;
    if (excess > 0) {
        embed.description = truncate(
            embed.description,
            embed.description.length - excess
        );
    }
    return {
        embeds: [embed],
        allowed_mentions: { parse: [] },
        thread_name: truncate(title, THREAD_NAME_LIMIT)
    };
}

/** Discord's answer to a forum channel's webhook sent no thread. */
const FORUM_NEEDS_THREAD_CODE = 220001;

async function isForumWithoutThread(response: Response): Promise<boolean> {
    if (response.status !== HttpStatus.BAD_REQUEST) return false;
    const body = (await response
        .clone()
        .json()
        .catch(() => undefined)) as { code?: number } | undefined;
    return body?.code === FORUM_NEEDS_THREAD_CODE;
}

function send(url: URL, message: DiscordMessage): Promise<Response> {
    return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message)
    });
}

/**
 * Posts to a text channel, or opens a thread in a forum channel. Discord
 * doesn't document what a text channel does with `thread_name`, so it is only
 * sent once Discord has said the channel is a forum.
 */
export async function postToDiscord(
    webhookUrl: string,
    message: DiscordMessage
): Promise<void> {
    const url = new URL(webhookUrl);
    // Without it a message Discord drops still answers 204.
    url.searchParams.set("wait", "true");
    const { thread_name: threadName, ...plain } = message;

    let response = await send(url, plain);
    if (await isForumWithoutThread(response)) {
        response = await send(url, { ...plain, thread_name: threadName });
    }
    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw internalError(
            `Discord answered ${response.status}: ${text}`,
            HttpStatus.BAD_GATEWAY
        );
    }
}
