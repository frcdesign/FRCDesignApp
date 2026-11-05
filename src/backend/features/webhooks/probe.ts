/**
 * Finds out which Onshape events fire, and for what: registers a webhook with
 * any events and params under the owner's token, and keeps what it is sent.
 * Owner only; a delivery is matched to its probe by a token in its url.
 */
import { HttpStatus } from "http-status-ts";
import { z } from "zod";
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

const PROBE_TTL_SECONDS = 24 * 3600;
const MAX_DELIVERIES = 50;
const PROBES_ID = "all";

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

interface Delivery {
    receivedAt: string;
    body: unknown;
}

const probes = kvStore<Probe[]>("webhook-probe", {
    ttlSeconds: PROBE_TTL_SECONDS
});
const deliveries = kvStore<Delivery[]>("webhook-probe-deliveries", {
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

/** GET /api/webhook-probe: the page that drives the routes below. */
webhookProbeRoutes.get("/webhook-probe", requireOwnerMiddleware, (c) =>
    c.html(PAGE)
);

/** GET /api/webhook-probe/state: every probe, newest first, with what it was sent. */
webhookProbeRoutes.get(
    "/webhook-probe/state",
    requireOwnerMiddleware,
    async (c) => {
        const all = (await probes.get(c.env.KV, PROBES_ID)) ?? [];
        const withDeliveries = await Promise.all(
            all.map(async (probe) => ({
                id: probe.id,
                params: probe.params,
                createdAt: probe.createdAt,
                webhookId: probe.webhookId,
                error: probe.error,
                deliveries: (await deliveries.get(c.env.KV, probe.id)) ?? []
            }))
        );
        return c.json(withDeliveries.reverse());
    }
);

const registerBody = z.object({
    events: z.array(z.string().min(1)).min(1),
    /** Anything else `POST /webhooks` takes: documentId, companyId, filter, isTransient… */
    params: z.record(z.string(), z.unknown()).default({})
});

/** POST /api/webhook-probe: registers one, answering with Onshape's reply or refusal. */
webhookProbeRoutes.post(
    "/webhook-probe",
    requireOwnerMiddleware,
    validate("json", registerBody),
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
        const url = new URL("/api/webhook-probe/deliveries", c.env.APP_URL);
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
        return c.json({
            id: probe.id,
            webhookId: probe.webhookId,
            error: probe.error
        });
    }
);

/** DELETE /api/webhook-probe/:probeId: unregisters it in Onshape and forgets it. */
webhookProbeRoutes.delete(
    "/webhook-probe/:probeId",
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

/** POST /api/webhook-probe/deliveries?probe=&token=: Onshape's deliveries, pings included. */
webhookProbeRoutes.post("/webhook-probe/deliveries", async (c) => {
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

/** The events worth trying, from Onshape's OpenAPI callbacks; any other can be typed. */
const SUGGESTED_EVENTS = [
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

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Webhook probe</title>
<style>
  body { font: 14px system-ui, sans-serif; margin: 16px; max-width: 900px; color: #ddd; background: #242424; }
  fieldset { border: 1px solid #444; margin-bottom: 12px; }
  label { display: block; margin: 4px 0; }
  input[type=text], textarea { width: 100%; box-sizing: border-box; background: #1a1a1a; color: #ddd; border: 1px solid #444; padding: 4px; }
  button { margin: 4px 4px 4px 0; }
  .probe { border: 1px solid #444; padding: 8px; margin: 8px 0; }
  .error { color: #ff8787; }
  pre { white-space: pre-wrap; word-break: break-all; background: #1a1a1a; padding: 6px; margin: 4px 0; }
  .muted { color: #999; }
</style>
</head>
<body>
<h1>Webhook probe</h1>
<p class="muted">Registers a webhook under your Onshape token, pointed back here, and lists what Onshape sends it. Deliveries are kept for a day; delete a probe to unregister it.</p>
<form id="register">
  <fieldset><legend>Events</legend>
    <div id="events"></div>
    <label>Others, comma separated <input type="text" name="other"></label>
  </fieldset>
  <fieldset><legend>Scope</legend>
    <label>documentId <input type="text" name="documentId"></label>
    <label>workspaceId <input type="text" name="workspaceId"></label>
    <label>companyId <input type="text" name="companyId"></label>
    <label>Other params, as JSON, e.g. {"filter": "…"} or {"isTransient": false} <textarea name="params" rows="2">{}</textarea></label>
  </fieldset>
  <button type="submit">Register</button>
  <span id="result"></span>
</form>
<h2>Probes</h2>
<div id="probes"></div>
<script>
const SUGGESTED = ${JSON.stringify(SUGGESTED_EVENTS)};
const eventsBox = document.getElementById("events");
for (const name of SUGGESTED) {
  const label = document.createElement("label");
  const box = document.createElement("input");
  box.type = "checkbox"; box.value = name;
  label.append(box, " " + name);
  eventsBox.append(label);
}
const form = document.getElementById("register");
const result = document.getElementById("result");
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const events = [...eventsBox.querySelectorAll("input:checked")].map((box) => box.value)
    .concat(String(data.get("other")).split(",").map((each) => each.trim()).filter(Boolean));
  let params;
  try { params = JSON.parse(String(data.get("params")) || "{}"); }
  catch { result.textContent = "Other params aren't valid JSON."; return; }
  for (const key of ["documentId", "workspaceId", "companyId"]) {
    const value = String(data.get(key)).trim();
    if (value) params[key] = value;
  }
  result.textContent = "Registering…";
  const response = await fetch("/api/webhook-probe", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events, params })
  });
  const answer = await response.json();
  result.textContent = answer.error ? "Onshape refused: " + answer.error
    : answer.webhookId ? "Registered " + answer.webhookId : JSON.stringify(answer);
  refresh();
});
function line(text, className) {
  const element = document.createElement("div");
  element.textContent = text;
  if (className) element.className = className;
  return element;
}
async function refresh() {
  const response = await fetch("/api/webhook-probe/state");
  if (!response.ok) return;
  const all = await response.json();
  const container = document.getElementById("probes");
  container.replaceChildren(...all.map((probe) => {
    const box = document.createElement("div");
    box.className = "probe";
    box.append(line(probe.createdAt + " — " + (probe.webhookId ? "webhook " + probe.webhookId : "not registered")));
    if (probe.error) box.append(line("Onshape refused: " + probe.error, "error"));
    const params = document.createElement("pre");
    params.textContent = JSON.stringify(probe.params, null, 2);
    box.append(params);
    const remove = document.createElement("button");
    remove.textContent = "Delete";
    remove.onclick = async () => { await fetch("/api/webhook-probe/" + probe.id, { method: "DELETE" }); refresh(); };
    box.append(remove);
    box.append(line(probe.deliveries.length + " deliveries", "muted"));
    for (const delivery of probe.deliveries) {
      const pre = document.createElement("pre");
      pre.textContent = delivery.receivedAt + "\\n" + JSON.stringify(delivery.body, null, 2);
      box.append(pre);
    }
    return box;
  }));
}
refresh();
setInterval(refresh, 3000);
</script>
</body>
</html>`;
