/**
 * Re-exported because the runtime looks them up here: a Durable Object or
 * Workflow class has to be an export of the Worker's entrypoint for the
 * `class_name`s in wrangler.jsonc to resolve.
 */
export { LoadDocumentWorkflow } from "./features/load/workflows";
export { RenderThumbnailWorkflow } from "./features/thumbnails/render-workflow";
export { LiveUpdates } from "./features/live/live-updates";
import { createApp } from "./app";
import { productionAuth } from "./features/auth/request-auth";
import type { AppBindings } from "./lib/context";
import { getDb } from "./db/client";
import { reconcileThumbnails } from "./features/thumbnails/reconcile";

const app = createApp(productionAuth);

export default {
    fetch: app.fetch,
    /**
     * The daily cron in wrangler.jsonc. Thumbnails outlive what shows them, and
     * no load sees the whole library any more to clear them as it finishes.
     */
    scheduled(_controller, env, ctx) {
        ctx.waitUntil(
            reconcileThumbnails(env.BLOB, getDb(env.DB)).then((result) => {
                console.log("Reconciled thumbnails", result);
            })
        );
    }
} satisfies ExportedHandler<AppBindings>;
