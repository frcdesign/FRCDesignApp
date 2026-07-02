export { LoadDocumentWorkflow } from "./load-document-workflow/load-document";
import { createApp } from "./create-app";
import { productionServices } from "./services";

export default createApp(productionServices);
