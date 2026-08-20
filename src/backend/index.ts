export {
    AddGroupWorkflow,
    LoadLibraryWorkflow,
    ThumbnailWorkflow
} from "./features/library/workflows";
import { createApp } from "./app";
import { productionServices } from "./features/auth/services";

export default createApp(productionServices);
