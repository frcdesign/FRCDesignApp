import { HttpStatus } from "http-status-ts";
import { getApp } from "../../lib/context";
import { validate } from "../../lib/validate";
import { handledError, internalError } from "../../lib/api-error";
import { getDb } from "../../db/client";
import { isSignedIn } from "../auth/request-auth";
import { trackReport } from "../analytics/tracking";
import { feedbackBody, type FeedbackOut, topicLibrary } from "./contract";
import { getChannel, reportTagIds, reportTagKeys } from "./channels";
import { buildReportMessage, postToDiscord } from "./discord";
import { findReportedPart } from "./reported-part";
import { reporterKey, takeReportSlot } from "./rate-limit";

export const feedbackRoutes = getApp();

/**
 * POST /api/feedback: posts a report to the topic's Discord channel. Open to a
 * caller who isn't signed in, since signing in is one of the things that breaks.
 */
feedbackRoutes.post("/feedback", validate("json", feedbackBody), async (c) => {
    const body = c.req.valid("json");
    const channel = getChannel(c.env, body.topic);
    if (!channel) {
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
    await postToDiscord(
        channel.webhookUrl,
        buildReportMessage({
            id: reportId,
            title: body.title,
            tagIds: reportTagIds(
                channel,
                reportTagKeys(body.topic, body.category, body.source)
            ),
            topic: body.topic,
            category: body.category,
            source: body.source,
            message: body.message,
            contact: body.contact || undefined,
            userId,
            userAgent: c.req.header("User-Agent"),
            part,
            diagnostics: body.diagnostics,
            createdAt: new Date()
        })
    );

    await trackReport(c, {
        id: reportId,
        userId,
        libraryId,
        topic: body.topic,
        category: body.category,
        source: body.source,
        part
    });
    return c.json({ reportId } satisfies FeedbackOut);
});
