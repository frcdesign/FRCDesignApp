export {
    AddGroupWorkflow,
    LoadLibraryWorkflow
} from "./features/load/workflows";
export { ThumbnailWorkflow } from "./features/thumbnails/workflow";
import { createApp } from "./app";
import { productionAuth } from "./features/auth/request-auth";

export default createApp(productionAuth);
