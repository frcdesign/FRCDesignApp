/** Draws preview meshes translucent, in Onshape's WebGL context or one of our own. */
import { type PreviewMesh } from "@backend/features/previews/contract";
import { type Camera } from "./onshape-viewer";

/**
 * Depth is written by hand from the clip position. Onshape fits its near and
 * far planes to the model, so a preview outside them is clamped onto the
 * nearest plane where the fixed pipeline would clip it away.
 */
const VERTEX_SHADER = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
out vec3 vNormal;
out vec3 vViewPosition;
out vec2 vClipDepth;
void main() {
    mat4 modelView = uView * uModel;
    vec4 viewPosition = modelView * vec4(aPosition, 1.0);
    vViewPosition = viewPosition.xyz;
    vNormal = mat3(modelView) * aNormal;
    vec4 clip = uProjection * viewPosition;
    vClipDepth = clip.zw;
    clip.z = clamp(clip.z, -clip.w, clip.w);
    gl_Position = clip;
}`;

/** A headlight, a fill from above and a little specular, as a CAD viewer lights a part. */
const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vViewPosition;
in vec2 vClipDepth;
uniform vec4 uColor;
uniform vec2 uDepthRange;
uniform float uDepthBias;
uniform float uIsLit;
uniform float uIsPerspective;
out vec4 outColor;
void main() {
    float ndc = clamp(vClipDepth.x / vClipDepth.y, -1.0, 1.0);
    float depth = mix(uDepthRange.x, uDepthRange.y, ndc * 0.5 + 0.5);
    depth += uDepthBias * (max(abs(dFdx(depth)), abs(dFdy(depth))) + 2.4e-7);
    gl_FragDepth = clamp(depth, 0.0, 1.0);

    vec3 normal = normalize(vNormal);
    vec3 toEye = uIsPerspective > 0.5 ? normalize(-vViewPosition) : vec3(0.0, 0.0, 1.0);
    if (dot(normal, toEye) < 0.0) normal = -normal;
    float key = max(dot(normal, toEye), 0.0);
    float fill = max(dot(normal, normalize(vec3(-0.3, 0.8, 0.5))), 0.0);
    float specular = pow(max(dot(reflect(-toEye, normal), toEye), 0.0), 24.0);
    vec3 lit = uColor.rgb * (0.35 + 0.5 * key + 0.2 * fill) + 0.25 * specular;
    vec3 color = mix(uColor.rgb, min(lit, vec3(1.0)), uIsLit);
    outColor = vec4(color * uColor.a, uColor.a);
}`;

/** Green, apart from the blue Onshape selects in and the grays parts default to. */
const FACE_COLOR = [0.16, 0.8, 0.36] as const;
const EDGE_COLOR = [0.02, 0.33, 0.12] as const;

interface Uniforms {
    model: WebGLUniformLocation | null;
    view: WebGLUniformLocation | null;
    projection: WebGLUniformLocation | null;
    color: WebGLUniformLocation | null;
    depthRange: WebGLUniformLocation | null;
    depthBias: WebGLUniformLocation | null;
    isLit: WebGLUniformLocation | null;
    isPerspective: WebGLUniformLocation | null;
}

interface MeshBuffers {
    faces: WebGLVertexArrayObject;
    indexCount: number;
    edges: WebGLVertexArrayObject;
    edgePointCount: number;
    owned: WebGLBuffer[];
}

/** A mesh drawn once, where `model` puts it. */
export interface Instance {
    mesh: string;
    /** Column-major, as WebGL takes it. */
    model: Float32Array;
}

function compile(gl: WebGL2RenderingContext): WebGLProgram {
    const program = gl.createProgram();
    const shaders = [
        [gl.VERTEX_SHADER, VERTEX_SHADER] as const,
        [gl.FRAGMENT_SHADER, FRAGMENT_SHADER] as const
    ].map(([type, source]) => {
        const shader = gl.createShader(type);
        if (!shader) {
            throw new Error("No shader");
        }
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        gl.attachShader(program, shader);
        return shader;
    });
    gl.bindAttribLocation(program, 0, "aPosition");
    gl.bindAttribLocation(program, 1, "aNormal");
    gl.linkProgram(program);
    const isLinked = gl.getProgramParameter(program, gl.LINK_STATUS) as boolean;
    const log = isLinked ? "" : gl.getProgramInfoLog(program);
    shaders.forEach((shader) => {
        gl.detachShader(program, shader);
        gl.deleteShader(shader);
    });
    if (!isLinked) {
        gl.deleteProgram(program);
        throw new Error(`Preview shader failed to link: ${log}`);
    }
    return program;
}

/** Everything a draw changes in a context it doesn't own. */
function saveState(gl: WebGL2RenderingContext) {
    const get = (name: GLenum): unknown => gl.getParameter(name);
    return {
        program: get(gl.CURRENT_PROGRAM) as WebGLProgram | null,
        vertexArray: get(
            gl.VERTEX_ARRAY_BINDING
        ) as WebGLVertexArrayObject | null,
        arrayBuffer: get(gl.ARRAY_BUFFER_BINDING) as WebGLBuffer | null,
        depthTest: gl.isEnabled(gl.DEPTH_TEST),
        depthFunc: get(gl.DEPTH_FUNC) as GLenum,
        depthMask: get(gl.DEPTH_WRITEMASK) as boolean,
        blend: gl.isEnabled(gl.BLEND),
        blendSrcRgb: get(gl.BLEND_SRC_RGB) as GLenum,
        blendDstRgb: get(gl.BLEND_DST_RGB) as GLenum,
        blendSrcAlpha: get(gl.BLEND_SRC_ALPHA) as GLenum,
        blendDstAlpha: get(gl.BLEND_DST_ALPHA) as GLenum,
        blendEquationRgb: get(gl.BLEND_EQUATION_RGB) as GLenum,
        blendEquationAlpha: get(gl.BLEND_EQUATION_ALPHA) as GLenum,
        cullFace: gl.isEnabled(gl.CULL_FACE),
        stencilTest: gl.isEnabled(gl.STENCIL_TEST),
        alphaToCoverage: gl.isEnabled(gl.SAMPLE_ALPHA_TO_COVERAGE),
        polygonOffsetFill: gl.isEnabled(gl.POLYGON_OFFSET_FILL),
        colorMask: get(gl.COLOR_WRITEMASK) as boolean[]
    };
}

function restoreState(
    gl: WebGL2RenderingContext,
    state: ReturnType<typeof saveState>
) {
    const set = (capability: GLenum, isEnabled: boolean) => {
        if (isEnabled) {
            gl.enable(capability);
        } else {
            gl.disable(capability);
        }
    };
    gl.useProgram(state.program);
    gl.bindVertexArray(state.vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.arrayBuffer);
    set(gl.DEPTH_TEST, state.depthTest);
    gl.depthFunc(state.depthFunc);
    gl.depthMask(state.depthMask);
    set(gl.BLEND, state.blend);
    gl.blendFuncSeparate(
        state.blendSrcRgb,
        state.blendDstRgb,
        state.blendSrcAlpha,
        state.blendDstAlpha
    );
    gl.blendEquationSeparate(state.blendEquationRgb, state.blendEquationAlpha);
    set(gl.CULL_FACE, state.cullFace);
    set(gl.STENCIL_TEST, state.stencilTest);
    set(gl.SAMPLE_ALPHA_TO_COVERAGE, state.alphaToCoverage);
    set(gl.POLYGON_OFFSET_FILL, state.polygonOffsetFill);
    const [red, green, blue, alpha] = state.colorMask;
    gl.colorMask(red, green, blue, alpha);
}

export class GhostRenderer {
    private readonly program: WebGLProgram;
    private readonly uniforms: Uniforms;
    private readonly meshes = new Map<string, MeshBuffers>();
    private instances: Instance[] = [];
    private awayFromViewer = 1;

    constructor(private readonly gl: WebGL2RenderingContext) {
        const previous = gl.getParameter(
            gl.CURRENT_PROGRAM
        ) as WebGLProgram | null;
        try {
            this.program = compile(gl);
            const uniform = (name: string) =>
                gl.getUniformLocation(this.program, name);
            this.uniforms = {
                model: uniform("uModel"),
                view: uniform("uView"),
                projection: uniform("uProjection"),
                color: uniform("uColor"),
                depthRange: uniform("uDepthRange"),
                depthBias: uniform("uDepthBias"),
                isLit: uniform("uIsLit"),
                isPerspective: uniform("uIsPerspective")
            };
        } finally {
            gl.useProgram(previous);
        }
    }

    get isLost(): boolean {
        return this.gl.isContextLost();
    }

    /** Uploads each mesh not already uploaded, and drops those no longer named. */
    setScene(meshes: Map<string, PreviewMesh>, instances: Instance[]) {
        const { gl } = this;
        const vertexArray = gl.getParameter(
            gl.VERTEX_ARRAY_BINDING
        ) as WebGLVertexArrayObject | null;
        const arrayBuffer = gl.getParameter(
            gl.ARRAY_BUFFER_BINDING
        ) as WebGLBuffer | null;
        try {
            for (const [id, buffers] of this.meshes) {
                if (!meshes.has(id)) {
                    this.deleteMesh(buffers);
                    this.meshes.delete(id);
                }
            }
            for (const [id, mesh] of meshes) {
                if (!this.meshes.has(id)) {
                    this.meshes.set(id, this.upload(mesh));
                }
            }
        } finally {
            gl.bindVertexArray(vertexArray);
            gl.bindBuffer(gl.ARRAY_BUFFER, arrayBuffer);
        }
        this.instances = instances.filter((instance) =>
            this.meshes.has(instance.mesh)
        );
    }

    /**
     * Into the frame Onshape is drawing, against the model's depth: what the
     * model hides shows faintly, as through it, and the rest shows solid.
     */
    drawInScene(camera: Camera) {
        const { gl } = this;
        if (this.instances.length === 0 || gl.isContextLost()) {
            return;
        }
        const state = saveState(gl);
        try {
            const isReversed =
                (gl.getParameter(gl.DEPTH_CLEAR_VALUE) as number) < 0.5;
            const depthRange = gl.getParameter(gl.DEPTH_RANGE) as Float32Array;
            this.begin(camera, depthRange, isReversed);
            gl.disable(gl.STENCIL_TEST);
            gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
            gl.disable(gl.POLYGON_OFFSET_FILL);

            gl.depthMask(false);
            gl.depthFunc(isReversed ? gl.LESS : gl.GREATER);
            this.faces(0.2);
            this.edges(0.55);

            gl.depthFunc(isReversed ? gl.GEQUAL : gl.LEQUAL);
            this.visible();
        } finally {
            restoreState(gl, state);
        }
    }

    /** Onto our own canvas over the viewport, where nothing of the model can hide it. */
    drawOverlay(camera: Camera) {
        const { gl } = this;
        if (gl.isContextLost()) {
            return;
        }
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.clearColor(0, 0, 0, 0);
        gl.clearDepth(1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        if (this.instances.length === 0) {
            return;
        }
        this.begin(camera, [0, 1], false);
        gl.depthFunc(gl.LEQUAL);
        this.visible();
        gl.bindVertexArray(null);
    }

    dispose() {
        const { gl } = this;
        if (gl.isContextLost()) {
            return;
        }
        const vertexArray = gl.getParameter(
            gl.VERTEX_ARRAY_BINDING
        ) as WebGLVertexArrayObject | null;
        this.meshes.forEach((buffers) => {
            this.deleteMesh(buffers);
        });
        this.meshes.clear();
        this.instances = [];
        gl.deleteProgram(this.program);
        gl.bindVertexArray(vertexArray);
    }

    private upload(mesh: PreviewMesh): MeshBuffers {
        const { gl } = this;
        const owned: WebGLBuffer[] = [];
        const buffer = (target: GLenum, data: ArrayBufferView) => {
            const created = gl.createBuffer();
            owned.push(created);
            gl.bindBuffer(target, created);
            gl.bufferData(target, data, gl.STATIC_DRAW);
        };
        const attribute = (index: number, data: Float32Array) => {
            buffer(gl.ARRAY_BUFFER, data);
            gl.enableVertexAttribArray(index);
            gl.vertexAttribPointer(index, 3, gl.FLOAT, false, 0, 0);
        };
        const faces = gl.createVertexArray();
        gl.bindVertexArray(faces);
        attribute(0, mesh.positions);
        attribute(1, mesh.normals);
        buffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indices);
        const edges = gl.createVertexArray();
        gl.bindVertexArray(edges);
        attribute(0, mesh.edges);
        gl.bindVertexArray(null);
        return {
            faces,
            indexCount: mesh.indices.length,
            edges,
            edgePointCount: mesh.edges.length / 3,
            owned
        };
    }

    private begin(
        camera: Camera,
        depthRange: ArrayLike<number>,
        isReversed: boolean
    ) {
        const { gl, uniforms } = this;
        gl.useProgram(this.program);
        gl.uniformMatrix4fv(uniforms.view, false, camera.viewMatrix);
        gl.uniformMatrix4fv(
            uniforms.projection,
            false,
            camera.projectionMatrix
        );
        gl.uniform2f(uniforms.depthRange, depthRange[0], depthRange[1]);
        // A perspective projection's last row is (0, 0, -1, 0); an orthographic one's (0, 0, 0, 1)
        gl.uniform1f(
            uniforms.isPerspective,
            camera.projectionMatrix[15] === 0 ? 1 : 0
        );
        this.awayFromViewer = isReversed ? -1 : 1;
        gl.disable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.colorMask(true, true, true, true);
    }

    /** Its nearest surface only, so the far side doesn't show through, then its edges on top. */
    private visible() {
        const { gl } = this;
        gl.depthMask(true);
        gl.colorMask(false, false, false, false);
        this.faces(1);
        gl.colorMask(true, true, true, true);
        gl.depthMask(false);
        this.faces(0.85);
        this.edges(1);
    }

    private faces(alpha: number) {
        const { gl, uniforms } = this;
        gl.uniform4f(uniforms.color, ...FACE_COLOR, alpha);
        // Behind their own edges, which would otherwise flicker against them.
        gl.uniform1f(uniforms.depthBias, this.awayFromViewer);
        gl.uniform1f(uniforms.isLit, 1);
        for (const instance of this.instances) {
            const buffers = this.meshes.get(instance.mesh);
            if (!buffers) {
                continue;
            }
            gl.uniformMatrix4fv(uniforms.model, false, instance.model);
            gl.bindVertexArray(buffers.faces);
            gl.drawElements(
                gl.TRIANGLES,
                buffers.indexCount,
                gl.UNSIGNED_INT,
                0
            );
        }
    }

    private edges(alpha: number) {
        const { gl, uniforms } = this;
        gl.uniform4f(uniforms.color, ...EDGE_COLOR, alpha);
        gl.uniform1f(uniforms.depthBias, 0);
        gl.uniform1f(uniforms.isLit, 0);
        for (const instance of this.instances) {
            const buffers = this.meshes.get(instance.mesh);
            if (!buffers || buffers.edgePointCount === 0) {
                continue;
            }
            gl.uniformMatrix4fv(uniforms.model, false, instance.model);
            gl.bindVertexArray(buffers.edges);
            gl.drawArrays(gl.LINES, 0, buffers.edgePointCount);
        }
    }

    private deleteMesh(buffers: MeshBuffers) {
        const { gl } = this;
        gl.deleteVertexArray(buffers.faces);
        gl.deleteVertexArray(buffers.edges);
        buffers.owned.forEach((buffer) => {
            gl.deleteBuffer(buffer);
        });
    }
}
