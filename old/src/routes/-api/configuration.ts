import { createFileRoute } from "@tanstack/react-router";
import { Library } from "../../api-utils/client-models";
import { getLibrary } from "../../connect/library";
import { jsonResponse, errorResponse } from "../../api/_cache";

export const Route = createFileRoute("/api/configuration")({
    server: {
        handlers: {
            GET: async ({ request }) => {
                const params = new URL(request.url).searchParams;
                const library = params.get("library") as Library | null;
                const documentId = params.get("documentId");
                const configurationId = params.get("configurationId");

                if (!library || !documentId || !configurationId)
                    return errorResponse("Missing required query params", 400);

                try {
                    const config = await getLibrary(library)
                        .documents.document(documentId)
                        .configurations.configuration(configurationId)
                        .get();
                    if (!config) return errorResponse("Configuration not found", 404);
                    return jsonResponse(config, "public");
                } catch (e: any) {
                    return errorResponse(e?.message ?? "Internal server error");
                }
            }
        }
    }
});
