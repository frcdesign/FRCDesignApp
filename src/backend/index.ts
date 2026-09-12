export {
    AddGroupWorkflow,
    LoadLibraryWorkflow
} from "./features/load/workflows";
export { ThumbnailRenderer } from "./features/thumbnails/renderer";
import { createApp } from "./app";
import { productionAuth } from "./features/auth/request-auth";

export default createApp(productionAuth);
