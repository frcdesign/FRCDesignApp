import { HttpStatus } from "http-status-ts";
import { type AppContext, getApp } from "../../lib/context";
import { validate } from "../../lib/validate";
import { handledError, internalError } from "../../lib/api-error";
import { getDb } from "../../db/client";
import { isSignedIn } from "../auth/request-auth";
import { cookieNames } from "../auth/cookie-options";
import { type AccessLevel } from "../auth/access-level";
import { LibraryId } from "../library/library-id";
import { trackReport } from "../analytics/tracking";
import { feedbackBody, type FeedbackOut, topicLibrary } from "./contract";
import { getWebhookUrl, reportTagIds } from "./channels";
import { buildReportMessage, postToDiscord, type Report } from "./discord";
import { findReportedPart } from "./reported-part";
import { reporterKey, takeReportSlot } from "./rate-limit";

export const feedbackRoutes = getApp();

/** Per library, as admin teams are; unreadable leaves it out rather than failing the report. */
async function readAccessLevels(
    c: AppContext
): Promise<Record<LibraryId, AccessLevel> | undefined> {
    try {
        const entries = await Promise.all(
            Object.values(LibraryId).map(
                async (libraryId) =>
                    [libraryId, await c.var.getAccessLevel(libraryId)] as const
            )
        );
        return Object.fromEntries(entries) as Record<LibraryId, AccessLevel>;
    } catch (error) {
        console.warn("Failed to read a reporter's access levels", error);
        return undefined;
    }
}

/**
 * POST /api/feedback: posts a report to the topic's Discord channel. Open to a
 * caller who isn't signed in, since signing in is one of the things that breaks.
 */
feedbackRoutes.post("/feedback", validate("json", feedbackBody), async (c) => {
    const body = c.req.valid("json");
    const webhookUrl = getWebhookUrl(c.env, body.topic);
    if (!webhookUrl) {
        throw handledError(
            "Reports can't be sent right now. Please post in the FRCDesign Discord instead.",
            HttpStatus.SERVICE_UNAVAILABLE
        );
    }

    const userId = (await isSignedIn(c)) ? await c.var.getUserId() : undefined;
    const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
    if (!(await takeReportSlot(c.env.KV, reporterKey(userId, ip)))) {
        throw handledError(
            "You've sent a lot of reports recently. Please try again in an hour.",
            HttpStatus.TOO_MANY_REQUESTS
        );
    }

    const libraryId = topicLibrary(body.topic);
    let part;
    if (body.part) {
        part = libraryId
            ? await findReportedPart(
                  getDb(c.env.DB),
                  libraryId,
                  body.part.insertableId,
                  body.part.selection
              )
            : undefined;
        if (!part) {
            throw internalError(
                "The reported part isn't in the topic's library",
                HttpStatus.NOT_FOUND
            );
        }
    }

    const reportId = crypto.randomUUID();
    const report: Report = {
        id: reportId,
        title: body.title,
        tagIds: reportTagIds(body.topic, body.category, body.source),
        topic: body.topic,
        category: body.category,
        source: body.source,
        message: body.message,
        contact: body.contact || undefined,
        teamNumber: body.teamNumber,
        signedIn: userId !== undefined,
        cookies: cookieNames(c),
        accessLevels: await readAccessLevels(c),
        userAgent: c.req.header("User-Agent"),
        part,
        diagnostics: body.diagnostics,
        createdAt: new Date()
    };
    // To Workers Logs, so a report can be looked up there by its id.
    console.log({ event: "report", userId, ...report });
    await postToDiscord(webhookUrl, buildReportMessage(report));

    await trackReport(c, {
        id: reportId,
        userId,
        libraryId,
        topic: body.topic,
        category: body.category,
        source: body.source,
        teamNumber: body.teamNumber,
        part
    });
    return c.json({ reportId } satisfies FeedbackOut);
});
