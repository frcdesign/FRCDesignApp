export {
    AddGroupWorkflow,
    LoadLibraryWorkflow
} from "./features/load/workflows";
export { ThumbnailWorkflow } from "./features/thumbnails/workflow";
import { createApp } from "./app";
import { productionCaller } from "./features/auth/caller";

export default createApp(productionCaller);
