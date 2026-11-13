/**
 * Onshape's own viewer, reached through its page. None of this is an API:
 * every name here is internal to Onshape's web client and can change in any
 * release, so each lookup answers `undefined` when it isn't there. See
 * "The web client's viewer" in docs/ONSHAPE.md.
 */

export interface Camera {
    /** Column-major, as WebGL takes them. */
    viewMatrix: Float32Array;
    projectionMatrix: Float32Array;
}

export interface DrawPass {
    draw: (this: DrawPass, ...args: unknown[]) => unknown;
    preDraw?: (...args: unknown[]) => unknown;
}

export interface OnshapeViewer {
    gl?: unknown;
    getCamera?: () => { viewMatrix?: unknown; projectionMatrix?: unknown };
    mainDrawPass?: { childPasses?: unknown };
    forceRequestDraw?: () => void;
    printingInProgress?: boolean;
}

interface AngularGlobal {
    element: (target: Document) => {
        injector?: () => { get: (name: string) => unknown } | undefined;
    };
}

export function findViewer(): OnshapeViewer | undefined {
    try {
        const { angular } = window as { angular?: AngularGlobal };
        const injector = angular?.element(document).injector?.();
        const service = injector?.get("CompatibilityChecksService") as
            | { viewer?: OnshapeViewer }
            | undefined;
        return service?.viewer ?? undefined;
    } catch {
        return undefined;
    }
}

const isMatrix = (value: unknown): value is ArrayLike<number> =>
    typeof value === "object" &&
    value !== null &&
    (value as ArrayLike<number>).length === 16;

export function readCamera(viewer: OnshapeViewer): Camera | undefined {
    try {
        const camera = viewer.getCamera?.();
        if (
            !camera ||
            !isMatrix(camera.viewMatrix) ||
            !isMatrix(camera.projectionMatrix)
        ) {
            return undefined;
        }
        return {
            viewMatrix: Float32Array.from(camera.viewMatrix),
            projectionMatrix: Float32Array.from(camera.projectionMatrix)
        };
    } catch {
        return undefined;
    }
}

export function viewerContext(
    viewer: OnshapeViewer
): WebGL2RenderingContext | undefined {
    const { gl } = viewer;
    return typeof WebGL2RenderingContext !== "undefined" &&
        gl instanceof WebGL2RenderingContext &&
        !gl.isContextLost()
        ? gl
        : undefined;
}

const DEPTH_ONLY_CLEAR = /\.clear\(\s*[\w$]+\.DEPTH_BUFFER_BIT\s*\)/;

/**
 * The pass that clears depth before Onshape draws what sits on top of the
 * model. Just before it runs, the depth buffer still holds the model, which is
 * when a preview can be drawn occluded by it. The pass has no name to go by,
 * so it is recognized by what its `preDraw` does.
 */
export function findDepthClearPass(
    viewer: OnshapeViewer
): DrawPass | undefined {
    const passes = viewer.mainDrawPass?.childPasses;
    if (!Array.isArray(passes)) {
        return undefined;
    }
    return (passes as Partial<DrawPass>[]).find((pass): pass is DrawPass => {
        if (
            !pass ||
            typeof pass.draw !== "function" ||
            typeof pass.preDraw !== "function"
        ) {
            return false;
        }
        const source = Function.prototype.toString.call(pass.preDraw);
        return DEPTH_ONLY_CLEAR.test(source);
    });
}

export function requestDraw(viewer: OnshapeViewer) {
    try {
        viewer.forceRequestDraw?.();
    } catch {
        // Onshape redraws on the next camera move regardless.
    }
}
