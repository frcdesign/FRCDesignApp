export {
    AddGroupWorkflow,
    LoadLibraryWorkflow
} from "./features/load/workflows";
export { ThumbnailWorkflow } from "./features/thumbnails/workflow";
import { createApp } from "./app";
import { productionServices } from "./features/auth/services";

export default createApp(productionServices);
