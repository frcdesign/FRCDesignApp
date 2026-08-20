export {
    AddGroupWorkflow,
    LoadLibraryWorkflow,
    ThumbnailWorkflow
} from "./load/workflows";
import { createApp } from "./create-app";
import { productionServices } from "./services";

export default createApp(productionServices);
