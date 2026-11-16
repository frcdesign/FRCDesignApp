/** The Companion's one script, run in Onshape's own page so it can reach the viewer. */
import {
    APP_ORIGINS,
    COMPANION_PROTOCOL_VERSION,
    COMPANION_SOURCE,
    type CompanionReady,
    parseCompanionRequest
} from "@backend/features/companion/contract";
import { PreviewController, type PreviewMode } from "./preview";

interface CompanionConsole {
    clearPreview: () => void;
    readonly previewMode: PreviewMode;
}

declare global {
    interface Window {
        /** For checking a preview from the browser console. */
        frcDesignCompanion?: CompanionConsole;
    }
}

function start() {
    const controller = new PreviewController();

    window.addEventListener("message", (event: MessageEvent<unknown>) => {
        if (!APP_ORIGINS.includes(event.origin)) {
            return;
        }
        const request = parseCompanionRequest(event.data);
        if (!request) {
            return;
        }
        switch (request.type) {
            case "hello": {
                const ready: CompanionReady = {
                    source: COMPANION_SOURCE,
                    type: "ready",
                    version: COMPANION_PROTOCOL_VERSION
                };
                (event.source as Window | null)?.postMessage(
                    ready,
                    event.origin
                );
                return;
            }
            case "show-preview":
                controller.show(request.meshes, request.parts);
                return;
            case "clear-preview":
                controller.clear();
                return;
        }
    });

    window.frcDesignCompanion = {
        clearPreview: () => {
            controller.clear();
        },
        get previewMode() {
            return controller.mode;
        }
    };
}

if (!window.frcDesignCompanion) {
    start();
}
