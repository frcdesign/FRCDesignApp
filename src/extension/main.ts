/** The extension's one script, run in Onshape's own page so it can reach the viewer. */
import { PreviewController, type PreviewMode } from "./preview";
import {
    APP_ORIGINS,
    parsePreviewRequest,
    PREVIEW_SOURCE,
    type PreviewPart,
    type PreviewReady,
    PROTOCOL_VERSION
} from "./protocol";

const INCH = 0.0254;

/** A #10-32 socket head screw through a quarter-inch plate at the origin, with its washer and nut. */
const DEMO_PARTS: PreviewPart[] = [
    {
        shape: {
            kind: "washer",
            innerDiameter: 0.203 * INCH,
            outerDiameter: 0.438 * INCH,
            thickness: 0.049 * INCH
        },
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    },
    {
        shape: {
            kind: "screw",
            diameter: 0.19 * INCH,
            length: 0.5 * INCH,
            headDiameter: 0.312 * INCH,
            headHeight: 0.19 * INCH
        },
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0.049 * INCH, 0, 0, 0, 1]
    },
    {
        shape: { kind: "nut", acrossFlats: 0.375 * INCH, height: 0.13 * INCH },
        // Turned over, under the plate.
        transform: [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, -0.25 * INCH, 0, 0, 0, 1]
    }
];

interface PreviewConsole {
    show: (parts: PreviewPart[]) => void;
    clear: () => void;
    demo: () => void;
    readonly mode: PreviewMode;
}

declare global {
    interface Window {
        /** For trying a preview from the browser console. */
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
                    version: PROTOCOL_VERSION
                };
                (event.source as Window | null)?.postMessage(
                    ready,
                    event.origin
                );
                return;
            }
            case "show":
                controller.show(request.parts);
                return;
            case "clear":
                controller.clear();
                return;
        }
    });

    window.frcDesignPreview = {
        show: (parts) => {
            controller.show(parts);
        },
        clear: () => {
            controller.clear();
        },
        demo: () => {
            controller.show(DEMO_PARTS);
        },
        get mode() {
            return controller.mode;
        }
    };
}

if (!window.frcDesignPreview) {
    start();
}
