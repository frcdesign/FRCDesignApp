import { createFileRoute } from "@tanstack/react-router";
import { Library } from "../../api-utils/client-models";
import { getLibrary } from "../../connect/library";
import { buildLibraryOut } from "../../api/library.server";
import { jsonResponse, errorResponse } from "../../api/_cache";

export const Route = createFileRoute("/api/library-data")({
    server: {
        handlers: {
            GET: async ({ request }) => {
                const library = new URL(request.url).searchParams.get("library") as Library | null;
                if (!library) return errorResponse("Missing library param", 400);
                try {
                    const data = await buildLibraryOut(getLibrary(library));
                    return jsonResponse(data, "public");
                } catch (e: any) {
                    return errorResponse(e?.message ?? "Internal server error");
                }
            }
        }
    }
});
