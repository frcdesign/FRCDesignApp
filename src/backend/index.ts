/** Workflow and Durable Object classes must be exported here for wrangler.jsonc's `class_name`s to resolve. */
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
    /** The daily cron in wrangler.jsonc. */
    scheduled(_controller, env, ctx) {
        ctx.waitUntil(
            reconcileThumbnails(env.BLOB, getDb(env.DB)).then((result) => {
                console.log("Reconciled thumbnails", result);
            })
        );
    }
} satisfies ExportedHandler<AppBindings>;
