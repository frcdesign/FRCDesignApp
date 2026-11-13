/** Shows a preview in Onshape's graphics window: in its own frame when that works, over it otherwise. */
import { GhostRenderer } from "./ghost-renderer";
import {
    type DrawPass,
    findDepthClearPass,
    findViewer,
    type OnshapeViewer,
    readCamera,
    requestDraw,
    viewerContext
} from "./onshape-viewer";
import { type PreviewPart } from "./protocol";
import { buildPreviewMesh, type PreviewMesh } from "./shapes";

/** How long Onshape gets to draw a frame with the preview in it before the overlay takes over. */
const IN_SCENE_TIMEOUT = 1500;
const SYNC_INTERVAL = 400;
/** In-scene drawing that has failed this often stays off until the page reloads. */
const MAX_FAILURES = 3;
const OVERLAY_ATTRIBUTE = "data-frcdesign-preview";

export type PreviewMode = "scene" | "overlay" | "none";

interface Scene {
    viewer: OnshapeViewer;
    renderer: GhostRenderer;
    pass: DrawPass;
    hook: DrawPass["draw"];
    /** The pass's own `draw`, when it had one beside its prototype's. */
    ownDraw: DrawPass["draw"] | undefined;
    attachedAt: number;
    hasDrawn: boolean;
}

interface Overlay {
    canvas: HTMLCanvasElement;
    renderer: GhostRenderer;
    frame: number;
}

export class PreviewController {
    private mesh: PreviewMesh | undefined;
    private scene: Scene | undefined;
    private overlay: Overlay | undefined;
    private timer: number | undefined;
    private failures = 0;

    get mode(): PreviewMode {
        return this.scene ? "scene" : this.overlay ? "overlay" : "none";
    }

    show(parts: PreviewPart[]) {
        if (parts.length === 0) {
            this.clear();
            return;
        }
        this.mesh = buildPreviewMesh(parts);
        if (this.scene) {
            this.scene.renderer.setMesh(this.mesh);
            requestDraw(this.scene.viewer);
        } else if (this.overlay) {
            this.overlay.renderer.setMesh(this.mesh);
        }
        this.sync();
        this.timer ??= window.setInterval(() => {
            this.sync();
        }, SYNC_INTERVAL);
    }

    clear() {
        this.mesh = undefined;
        window.clearInterval(this.timer);
        this.timer = undefined;
        this.detachScene();
        this.stopOverlay();
    }

    /** Onshape swaps its viewer and passes as tabs change, so where the preview is drawn is checked over and over. */
    private sync() {
        const { scene } = this;
        if (scene) {
            const isCurrent =
                findViewer() === scene.viewer &&
                !scene.renderer.isLost &&
                findDepthClearPass(scene.viewer) === scene.pass &&
                scene.pass.draw === scene.hook;
            if (!isCurrent) {
                this.detachScene();
            } else if (
                !scene.hasDrawn &&
                Date.now() - scene.attachedAt > IN_SCENE_TIMEOUT
            ) {
                this.fail("Onshape drew no frame with the preview in it");
            }
        }
        if (!this.scene && this.failures < MAX_FAILURES) {
            this.attachScene();
        }
        if (this.scene) {
            this.stopOverlay();
        } else {
            this.startOverlay();
        }
    }

    private attachScene() {
        const viewer = findViewer();
        const gl = viewer && viewerContext(viewer);
        const pass = viewer && findDepthClearPass(viewer);
        if (!viewer || !gl || !pass || !this.mesh) {
            return;
        }
        let renderer: GhostRenderer | undefined;
        try {
            renderer = new GhostRenderer(gl);
            renderer.setMesh(this.mesh);
        } catch (error) {
            renderer?.dispose();
            this.fail(error);
            return;
        }
        const drawPreview = () => {
            this.drawScene();
        };
        const original = pass.draw;
        const hook: DrawPass["draw"] = function (this: DrawPass, ...args) {
            drawPreview();
            return original.apply(this, args);
        };
        this.scene = {
            viewer,
            renderer,
            pass,
            hook,
            ownDraw: Object.hasOwn(pass, "draw") ? original : undefined,
            attachedAt: Date.now(),
            hasDrawn: false
        };
        pass.draw = hook;
        requestDraw(viewer);
    }

    /** Runs inside Onshape's frame, so it must never throw into it. */
    private drawScene() {
        const { scene } = this;
        if (!scene) {
            return;
        }
        try {
            const gl = viewerContext(scene.viewer);
            const camera = readCamera(scene.viewer);
            if (
                !gl ||
                !camera ||
                scene.viewer.printingInProgress === true ||
                // Anything but the screen is a pick or an export, not the frame someone looks at.
                gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING) !== null
            ) {
                return;
            }
            scene.renderer.drawInScene(camera);
            scene.hasDrawn = true;
        } catch (error) {
            window.setTimeout(() => {
                this.fail(error);
            }, 0);
        }
    }

    private detachScene() {
        const { scene } = this;
        if (!scene) {
            return;
        }
        this.scene = undefined;
        if (scene.pass.draw === scene.hook) {
            if (scene.ownDraw) {
                scene.pass.draw = scene.ownDraw;
            } else {
                delete (scene.pass as Partial<DrawPass>).draw;
            }
        }
        try {
            scene.renderer.dispose();
        } catch {
            // The context went with the tab.
        }
        requestDraw(scene.viewer);
    }

    private fail(reason: unknown) {
        this.failures++;
        console.warn(
            "[FRCDesign preview] Drawing in Onshape's view failed; drawing over it instead.",
            reason
        );
        this.detachScene();
        this.startOverlay();
    }

    private startOverlay() {
        if (this.overlay || !this.mesh) {
            return;
        }
        const canvas = document.createElement("canvas");
        canvas.setAttribute(OVERLAY_ATTRIBUTE, "");
        Object.assign(canvas.style, {
            position: "fixed",
            pointerEvents: "none",
            zIndex: "1"
        });
        const gl = canvas.getContext("webgl2", {
            alpha: true,
            premultipliedAlpha: true,
            antialias: true,
            depth: true
        });
        if (!gl) {
            return;
        }
        const renderer = new GhostRenderer(gl);
        renderer.setMesh(this.mesh);
        document.documentElement.append(canvas);
        const overlay: Overlay = { canvas, renderer, frame: 0 };
        const draw = () => {
            this.drawOverlay(overlay);
            overlay.frame = requestAnimationFrame(draw);
        };
        overlay.frame = requestAnimationFrame(draw);
        this.overlay = overlay;
    }

    private drawOverlay({ canvas, renderer }: Overlay) {
        const viewer = findViewer();
        const camera = viewer && readCamera(viewer);
        const target = viewer && viewerContext(viewer)?.canvas;
        if (!camera || !(target instanceof HTMLCanvasElement)) {
            canvas.style.display = "none";
            return;
        }
        const rect = target.getBoundingClientRect();
        const scale = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.round(rect.width * scale));
        const height = Math.max(1, Math.round(rect.height * scale));
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        Object.assign(canvas.style, {
            display: "block",
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`
        });
        renderer.drawOverlay(camera);
    }

    private stopOverlay() {
        const { overlay } = this;
        if (!overlay) {
            return;
        }
        this.overlay = undefined;
        cancelAnimationFrame(overlay.frame);
        overlay.renderer.dispose();
        overlay.canvas.remove();
    }
}
