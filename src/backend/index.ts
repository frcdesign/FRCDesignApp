export { LoadDocumentWorkflow } from "./parse/load-document";
import { createApp } from "./create-app";
import { productionServices } from "./services";

export default createApp(productionServices);
