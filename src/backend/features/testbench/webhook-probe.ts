/**
 * Finds out which Onshape events fire, and for what: registers a webhook with
 * any events and params under the owner's token, and keeps what it is sent.
 * A delivery is matched to its probe by a token in its url.
 */
import { HttpStatus } from "http-status-ts";
import { forbiddenError } from "../../lib/api-error";
import { getApp } from "../../lib/context";
import { kvStore } from "../../lib/kv-store";
import { OnshapeApiError } from "../../lib/onshape/client";
import {
    deleteWebhook,
    type OnshapeWebhookInfo
} from "../../lib/onshape/endpoints/webhooks";
import { validate } from "../../lib/validate";
import { requireOwnerMiddleware } from "../auth/guards";
import {
    registerProbeBody,
    type RegisterProbeOut,
    type WebhookDelivery,
    type WebhookProbeOut
} from "./contract";

const PROBE_TTL_SECONDS = 24 * 3600;
const MAX_DELIVERIES = 50;
const PROBES_ID = "all";
export const PROBE_DELIVERY_ROUTE = "/testbench/webhooks/deliveries";

interface Probe {
    id: string;
    token: string;
    /** What was sent to Onshape, url aside. */
    params: Record<string, unknown>;
    createdAt: string;
    /** Set once Onshape accepts it. */
    webhookId?: string;
    /** Onshape's refusal, when it refused. */
    error?: string;
}

const probes = kvStore<Probe[]>("webhook-probe", {
    ttlSeconds: PROBE_TTL_SECONDS
});
const deliveries = kvStore<WebhookDelivery[]>("webhook-probe-deliveries", {
    ttlSeconds: PROBE_TTL_SECONDS
});

async function saveProbe(kv: KVNamespace, probe: Probe): Promise<void> {
    const all = (await probes.get(kv, PROBES_ID)) ?? [];
    await probes.put(kv, PROBES_ID, [
        ...all.filter((each) => each.id !== probe.id),
        probe
    ]);
}

export const webhookProbeRoutes = getApp();

/** GET /api/testbench/webhooks: every probe, newest first, with what it was sent. */
webhookProbeRoutes.get(
    "/testbench/webhooks",
    requireOwnerMiddleware,
    async (c) => {
        const all = (await probes.get(c.env.KV, PROBES_ID)) ?? [];
        const withDeliveries = await Promise.all(
            all.map(
                async (probe): Promise<WebhookProbeOut> => ({
                    id: probe.id,
                    params: probe.params,
                    createdAt: probe.createdAt,
                    webhookId: probe.webhookId,
                    error: probe.error,
                    deliveries: (await deliveries.get(c.env.KV, probe.id)) ?? []
                })
            )
        );
        return c.json(withDeliveries.reverse());
    }
);

/** POST /api/testbench/webhooks: registers one, answering with Onshape's reply or refusal. */
webhookProbeRoutes.post(
    "/testbench/webhooks",
    requireOwnerMiddleware,
    validate("json", registerProbeBody),
    async (c) => {
        const { events, params } = c.req.valid("json");
        const probe: Probe = {
            id: crypto.randomUUID(),
            token: crypto.randomUUID(),
            params: {
                name: "FRCDesignApp webhook probe",
                description: "A test of which events Onshape sends.",
                options: { collapseEvents: false },
                isTransient: true,
                ...params,
                events
            },
            createdAt: new Date().toISOString()
        };
        const url = new URL(`/api${PROBE_DELIVERY_ROUTE}`, c.env.APP_URL);
        url.searchParams.set("probe", probe.id);
        url.searchParams.set("token", probe.token);

        // Stored first: Onshape pings the url before it answers the create.
        await saveProbe(c.env.KV, probe);
        try {
            const client = await c.var.getOnshapeApi();
            const info = await client.post<OnshapeWebhookInfo>("/webhooks", {
                body: { ...probe.params, url: url.href }
            });
            probe.webhookId = info.id;
        } catch (error) {
            probe.error =
                error instanceof OnshapeApiError
                    ? `${error.status}: ${error.message}`
                    : String(error);
        }
        await saveProbe(c.env.KV, probe);
        return c.json<RegisterProbeOut>({
            id: probe.id,
            webhookId: probe.webhookId,
            error: probe.error
        });
    }
);

/** DELETE /api/testbench/webhooks/:probeId: unregisters it in Onshape and forgets it. */
webhookProbeRoutes.delete(
    "/testbench/webhooks/:probeId",
    requireOwnerMiddleware,
    async (c) => {
        const probeId = c.req.param("probeId");
        const all = (await probes.get(c.env.KV, PROBES_ID)) ?? [];
        const probe = all.find((each) => each.id === probeId);
        if (probe?.webhookId) {
            try {
                await deleteWebhook(
                    await c.var.getOnshapeApi(),
                    probe.webhookId
                );
            } catch (error) {
                // Already gone in Onshape is fine; anything else is worth seeing.
                if (
                    !(error instanceof OnshapeApiError) ||
                    error.status !== HttpStatus.NOT_FOUND
                ) {
                    throw error;
                }
            }
        }
        await probes.put(
            c.env.KV,
            PROBES_ID,
            all.filter((each) => each.id !== probeId)
        );
        await deliveries.delete(c.env.KV, probeId);
        return c.json({});
    }
);

/** POST /api/testbench/webhooks/deliveries?probe=&token=: Onshape's deliveries, pings included. */
webhookProbeRoutes.post(PROBE_DELIVERY_ROUTE, async (c) => {
    const { probe: probeId, token } = c.req.query();
    const all = (await probes.get(c.env.KV, PROBES_ID)) ?? [];
    const probe = all.find((each) => each.id === probeId);
    if (!probe || probe.token !== token) {
        throw forbiddenError("Unrecognized webhook probe");
    }
    const body: unknown = await c.req.json().catch(() => undefined);
    console.log("Webhook probe delivery", probeId, JSON.stringify(body));
    const received = (await deliveries.get(c.env.KV, probe.id)) ?? [];
    await deliveries.put(
        c.env.KV,
        probe.id,
        [{ receivedAt: new Date().toISOString(), body }, ...received].slice(
            0,
            MAX_DELIVERIES
        )
    );
    return c.json({});
});
