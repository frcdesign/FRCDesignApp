/** Shows a preview in Onshape's graphics window, drawn into its own frame. */
import {
    decodePreviewMesh,
    type PreviewInstance,
    type PreviewMesh
} from "@backend/features/previews/contract";
import { GhostRenderer, type Instance } from "./ghost-renderer";
import {
    type DrawPass,
    findDepthClearPass,
    findViewer,
    type OnshapeViewer,
    readCamera,
    requestDraw,
    viewerContext
} from "./onshape-viewer";

/** How long Onshape gets to draw a frame with the preview in it before it counts as a failure. */
const IN_SCENE_TIMEOUT = 1500;
const SYNC_INTERVAL = 400;
/** Drawing that has failed this often stays off until the page reloads. */
const MAX_FAILURES = 3;

export type PreviewMode = "scene" | "none";

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

interface Content {
    meshes: Map<string, PreviewMesh>;
    instances: Instance[];
}

/** Onshape's API writes a transform row-major; WebGL takes it column-major. */
function toColumnMajor(transform: number[]): Float32Array {
    const matrix = new Float32Array(16);
    for (let row = 0; row < 4; row++) {
        for (let column = 0; column < 4; column++) {
            matrix[column * 4 + row] = transform[row * 4 + column];
        }
    }
    return matrix;
}

export class PreviewController {
    private content: Content | undefined;
    private scene: Scene | undefined;
    private timer: number | undefined;
    private failures = 0;

    get mode(): PreviewMode {
        return this.scene ? "scene" : "none";
    }

    /** A mesh this version can't read is left out, with the parts drawn with it. */
    show(meshes: Record<string, ArrayBuffer>, parts: PreviewInstance[]) {
        const decoded = new Map<string, PreviewMesh>();
        for (const [id, buffer] of Object.entries(meshes)) {
            const mesh = decodePreviewMesh(buffer);
            if (mesh) {
                decoded.set(id, mesh);
            }
        }
        const instances = parts
            .filter((part) => decoded.has(part.mesh))
            .map((part) => ({
                mesh: part.mesh,
                model: toColumnMajor(part.transform)
            }));
        if (instances.length === 0) {
            this.clear();
            return;
        }
        this.content = { meshes: decoded, instances };
        if (this.scene) {
            this.scene.renderer.setScene(decoded, instances);
            requestDraw(this.scene.viewer);
        }
        this.sync();
        this.timer ??= window.setInterval(() => {
            this.sync();
        }, SYNC_INTERVAL);
    }

    clear() {
        this.content = undefined;
        window.clearInterval(this.timer);
        this.timer = undefined;
        this.detachScene();
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
    }

    private attachScene() {
        const viewer = findViewer();
        const gl = viewer && viewerContext(viewer);
        const pass = viewer && findDepthClearPass(viewer);
        const { content } = this;
        if (!viewer || !gl || !pass || !content) {
            return;
        }
        let renderer: GhostRenderer | undefined;
        try {
            renderer = new GhostRenderer(gl);
            renderer.setScene(content.meshes, content.instances);
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
            "[FRCDesignApp Companion] Drawing in Onshape's view failed.",
            reason
        );
        this.detachScene();
    }
}
