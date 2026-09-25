/** Workflow and Durable Object classes must be exported here for wrangler.jsonc's `class_name`s to resolve. */
export { LoadDocumentWorkflow } from "./features/load/workflows";
export { RenderThumbnailWorkflow } from "./features/thumbnails/render-workflow";
export { PushHub } from "./features/push/push-hub";
import { createApp } from "./app";
import { productionAuth } from "./features/auth/request-auth";
import type { AppBindings } from "./lib/context";

const app = createApp(productionAuth);

export default {
    fetch: app.fetch
} satisfies ExportedHandler<AppBindings>;
