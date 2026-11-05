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
    /** The reporter's answer to whether the Onshape document is at fault. */
    inDocument?: boolean;
}

export interface Report {
    id: string;
    /** The reporter's; names the thread. */
    title: string;
    /** The forum's tags to file the thread under. */
    tagIds: string[];
    topic: FeedbackTopic;
    category: FeedbackCategory;
    source: FeedbackSource;
    message: string;
    contact?: string;
    teamNumber?: number;
    signedIn: boolean;
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
    title?: string;
    url?: string;
    description: string;
    color: number;
    fields?: DiscordEmbedField[];
    footer?: { text: string };
    timestamp?: string;
}

export interface DiscordMessage {
    embeds: DiscordEmbed[];
    /** Empty, so text a reporter typed can't ping anyone. */
    allowed_mentions: { parse: [] };
    /** Every report channel is a forum, which opens each post as a thread named this. */
    thread_name: string;
    /** The forum's own tag ids; absent when the forum has none configured. */
    applied_tags?: string[];
}

/** Discord's limits on an embed; the total is across a message's embeds. */
const TITLE_LIMIT = 256;
const FIELD_LIMIT = 1024;
const DESCRIPTION_LIMIT = 4096;
const EMBEDS_LIMIT = 6000;
/** Keeps the details block short, whatever a url or browser string holds. */
const DETAIL_LIMIT = 500;
const THREAD_NAME_LIMIT = 100;

const RED = 0xe03131;
const BLUE = 0x1c7ed6;
const ORANGE = 0xf08c00;
const GRAY = 0x868e96;
const GREEN = 0x2f9e44;

const CATEGORY_COLORS: Record<FeedbackCategory, number> = {
    [FeedbackCategory.BUG]: RED,
    [FeedbackCategory.BROKEN_CONFIGURATION]: RED,
    [FeedbackCategory.INCORRECT_GEOMETRY]: ORANGE,
    [FeedbackCategory.METADATA]: ORANGE,
    [FeedbackCategory.ORGANIZATION]: ORANGE,
    [FeedbackCategory.FEATURE_REQUEST]: BLUE,
    [FeedbackCategory.PART_REQUEST]: BLUE,
    [FeedbackCategory.KUDOS]: GREEN,
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
    if (!launch?.elementType) return undefined;
    const where = [launch.elementType];
    if (launch.instanceType === "w") where.push("workspace");
    if (launch.enterprise) where.push("Enterprise");
    return where.join(", ");
}

/** What the reporter is reporting, shown first. */
function reportFields(report: Report): DiscordEmbedField[] {
    const { diagnostics, part } = report;
    const fields: DiscordEmbedField[] = [];
    if (part) {
        fields.push(field("Part", `${part.groupName} / ${part.name}`));
        if (part.configuration?.length) {
            fields.push(
                field("Configuration", code(part.configuration.join("\n")))
            );
        }
        fields.push(
            field(
                "Problem with the Onshape document",
                part.inDocument ? "Yes" : "No"
            )
        );
    }
    if (diagnostics.error) {
        const { shown, kind, detail } = diagnostics.error;
        const lines = [shown];
        if (kind) lines.push(`kind: ${kind}`);
        if (detail && detail !== shown) lines.push(`detail: ${detail}`);
        fields.push(field("Error", code(lines.join("\n"))));
    }
    if (report.contact) {
        fields.push(field("Discord username", report.contact, true));
    }
    if (report.teamNumber !== undefined) {
        fields.push(field("Team number", String(report.teamNumber), true));
    }
    return fields;
}

/** Where and how it was sent, `Label: value` per line, for the team to dig into. */
function detailLines(report: Report): string[] {
    const { diagnostics } = report;
    const lines = [
        `Topic: ${FEEDBACK_TOPIC_LABELS[report.topic]}`,
        `Type: ${FEEDBACK_CATEGORY_LABELS[report.category]}`,
        `From: ${FEEDBACK_SOURCE_LABELS[report.source]}`,
        `Page: ${truncate(diagnostics.url, DETAIL_LIMIT)}`,
        `Launched in: ${describeLaunch(diagnostics.launch) ?? "Not in Onshape"}`,
        `Signed in: ${report.signedIn ? "Yes" : "No"}`,
        `Viewed as: ${diagnostics.viewedAccessLevel ?? "unknown"}`,
        `Build: ${diagnostics.build ?? "unknown"}`
    ];
    if (diagnostics.viewport) {
        lines.push(`Window: ${diagnostics.viewport}`);
    }
    if (report.userAgent) {
        lines.push(`Browser: ${truncate(report.userAgent, DETAIL_LIMIT)}`);
    }
    return lines;
}

function embedLength(embed: DiscordEmbed): number {
    return (
        (embed.title?.length ?? 0) +
        embed.description.length +
        (embed.footer?.text.length ?? 0) +
        (embed.fields ?? []).reduce(
            (total, each) => total + each.name.length + each.value.length,
            0
        )
    );
}

/**
 * Two embeds: the report as the reporter wrote it, then a gray block of where
 * it came from. Discord has no collapsible embed, so the details go last.
 */
export function buildReportMessage(report: Report): DiscordMessage {
    const title = truncate(report.title, TITLE_LIMIT);
    const main: DiscordEmbed = {
        title,
        url: report.part?.url,
        description: report.message || "_No description given._",
        color: CATEGORY_COLORS[report.category],
        fields: reportFields(report)
    };
    const details: DiscordEmbed = {
        description: code(detailLines(report).join("\n"), DESCRIPTION_LIMIT),
        color: GRAY,
        footer: { text: `Report ${report.id}` },
        timestamp: report.createdAt.toISOString()
    };
    // The message is what gives: everything else is short and bounded.
    const excess = embedLength(main) + embedLength(details) - EMBEDS_LIMIT;
    if (excess > 0) {
        main.description = truncate(
            main.description,
            main.description.length - excess
        );
    }
    return {
        embeds: [main, details],
        allowed_mentions: { parse: [] },
        thread_name: truncate(title, THREAD_NAME_LIMIT),
        ...(report.tagIds.length > 0 && { applied_tags: report.tagIds })
    };
}

function send(url: URL, message: DiscordMessage): Promise<Response> {
    return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message)
    });
}

/**
 * Opens the report's thread in the topic's forum channel. A tag id the forum
 * doesn't have fails the whole post, so a refused tagged post goes again
 * untagged: a report matters more than its tags.
 */
export async function postToDiscord(
    webhookUrl: string,
    message: DiscordMessage
): Promise<void> {
    const url = new URL(webhookUrl);
    // Without it a message Discord drops still answers 204.
    url.searchParams.set("wait", "true");

    let response = await send(url, message);
    if (response.status === HttpStatus.BAD_REQUEST && message.applied_tags) {
        console.error(
            "Discord refused a tagged report; sending it untagged",
            await response.text().catch(() => "")
        );
        // Undefined is left out of the JSON.
        response = await send(url, { ...message, applied_tags: undefined });
    }
    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw internalError(
            `Discord answered ${response.status}: ${text}`,
            HttpStatus.BAD_GATEWAY
        );
    }
}
