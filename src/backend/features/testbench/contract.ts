/** What the testbench's routes take and answer. A leaf, imported by the frontend. */
import * as z from "zod";

export const ONSHAPE_METHODS = ["GET", "POST", "DELETE"] as const;

export type OnshapeMethod = (typeof ONSHAPE_METHODS)[number];

export const onshapeCallBody = z.object({
    method: z.enum(ONSHAPE_METHODS),
    /** `/api/v{version}`; Onshape's own web client calls v14 for internal endpoints. */
    version: z.number().int().min(1).max(99),
    /** After the version, starting with a slash: `/users/sessioninfo`. */
    path: z
        .string()
        .regex(/^(\/[A-Za-z0-9_\-.~%:]+)+$/)
        .refine((path) => !path.split("/").includes(".."), "No .. segments"),
    query: z.record(z.string(), z.string()).default({}),
    body: z.unknown().optional(),
    /** Off for a burst, which reads only statuses and headers. */
    includeBody: z.boolean().default(true)
});

export type OnshapeCallBody = z.input<typeof onshapeCallBody>;

export interface OnshapeCallResult {
    url: string;
    status: number;
    /** From just before the Worker sends it to Onshape's last byte. */
    durationMs: number;
    /** Every header Onshape answered with, names lowercased. */
    headers: Record<string, string>;
    /** Parsed when it is JSON, otherwise text; cut at {@link MAX_BODY_CHARS}. */
    body?: unknown;
    truncated?: boolean;
}

export const MAX_BODY_CHARS = 500_000;

export interface WebhookProbeOut {
    id: string;
    params: Record<string, unknown>;
    createdAt: string;
    webhookId?: string;
    error?: string;
    deliveries: WebhookDelivery[];
}

export interface WebhookDelivery {
    receivedAt: string;
    body: unknown;
}

export interface RegisterProbeOut {
    id: string;
    webhookId?: string;
    error?: string;
}

export const registerProbeBody = z.object({
    events: z.array(z.string().min(1)).min(1),
    /** Anything else `POST /webhooks` takes: documentId, companyId, filter, isTransient… */
    params: z.record(z.string(), z.unknown()).default({})
});

export type RegisterProbeBody = z.input<typeof registerProbeBody>;

/** The events worth trying, from Onshape's OpenAPI callbacks; any other can be typed. */
export const SUGGESTED_EVENTS = [
    "onshape.document.lifecycle.shared",
    "onshape.document.lifecycle.madepublic",
    "onshape.document.lifecycle.madeprivate",
    "onshape.model.lifecycle.metadata",
    "onshape.model.lifecycle.changed",
    "onshape.model.lifecycle.createversion",
    "onshape.team.addmember",
    "onshape.team.removemember",
    "onshape.team.created",
    "onshape.team.deleted",
    "onshape.user.lifecycle.addcompanyuser",
    "onshape.user.lifecycle.removecompanyuser",
    "onshape.app.authorized"
];
