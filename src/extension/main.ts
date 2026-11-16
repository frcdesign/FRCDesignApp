/** The extension's one script, run in Onshape's own page so it can reach the viewer. */
import {
    APP_ORIGINS,
    parsePreviewRequest,
    PREVIEW_PROTOCOL_VERSION,
    PREVIEW_SOURCE,
    type PreviewReady
} from "@backend/features/previews/contract";
import { PreviewController, type PreviewMode } from "./preview";

interface PreviewConsole {
    clear: () => void;
    readonly mode: PreviewMode;
}

declare global {
    interface Window {
        /** For checking a preview from the browser console. */
        frcDesignPreview?: PreviewConsole;
    }
}

function start() {
    const controller = new PreviewController();

    window.addEventListener("message", (event: MessageEvent<unknown>) => {
        if (!APP_ORIGINS.includes(event.origin)) {
            return;
        }
        const request = parsePreviewRequest(event.data);
        if (!request) {
            return;
        }
        switch (request.type) {
            case "hello": {
                const ready: PreviewReady = {
                    source: PREVIEW_SOURCE,
                    type: "ready",
                    version: PREVIEW_PROTOCOL_VERSION
                };
                (event.source as Window | null)?.postMessage(
                    ready,
                    event.origin
                );
                return;
            }
            case "show":
                controller.show(request.meshes, request.parts);
                return;
            case "clear":
                controller.clear();
                return;
        }
    });

    window.frcDesignPreview = {
        clear: () => {
            controller.clear();
        },
        get mode() {
            return controller.mode;
        }
    };
}

if (!window.frcDesignPreview) {
    start();
}
