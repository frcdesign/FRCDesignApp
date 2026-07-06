export { LoadGroupWorkflow } from "./load-group-workflow/load-group";
import { createApp } from "./create-app";
import { productionServices } from "./services";

export default createApp(productionServices);
