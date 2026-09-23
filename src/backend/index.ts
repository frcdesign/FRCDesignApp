/**
 * Re-exported because the runtime looks them up here: a Durable Object or
 * Workflow class has to be an export of the Worker's entrypoint for the
 * `class_name`s in wrangler.jsonc to resolve.
 */
export {
    AddGroupWorkflow,
    LoadLibraryWorkflow
} from "./features/load/workflows";
export { RenderThumbnailWorkflow } from "./features/thumbnails/render-workflow";
import { createApp } from "./app";
import { productionAuth } from "./features/auth/request-auth";

export default createApp(productionAuth);
