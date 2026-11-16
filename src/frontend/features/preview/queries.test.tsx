import { COMPANION_SOURCE } from "@backend/features/companion/contract";
import {
    previewMeshId,
    type PreviewPart
} from "@backend/features/previews/contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../__test_utils__/render";
import { useOnshapeLaunch } from "../../lib/onshape-params";
import { previewMeshQueryKey } from "../../lib/query-keys";
import { useCompanion } from "../companion/connection";
import { usePartPreview } from "./queries";

const SERVER = "https://cad.onshape.com";
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const SCREW: PreviewPart = {
    insertableId: "screw-row",
    microversionId: "screw-mv",
    configuration: "length=IN_1",
    transform: IDENTITY
};
const MOVED = [1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

interface PreviewerProps {
    parts?: PreviewPart[];
    isUpdating?: boolean;
}

function Previewer({ parts, isUpdating }: PreviewerProps) {
    usePartPreview(parts, isUpdating);
    return null;
}

let posted: ReturnType<typeof spyOnPost>;

const spyOnPost = () =>
    vi.spyOn(window, "postMessage").mockImplementation(() => undefined);

/** What reached the Onshape page; in jsdom, the panel is its own parent. */
const sent = (): Record<string, unknown>[] =>
    posted.mock.calls.map(
        ([message]: unknown[]) => message as Record<string, unknown>
    );

/** What the Companion was sent. */
const messages = () =>
    sent().filter((message) => message.source === COMPANION_SOURCE);

/** Onshape's own messages, which name the spinner. */
const spinner = () =>
    sent()
        .map((message) => message.messageName)
        .filter((name) => typeof name === "string");

function renderPreviewer(parts: PreviewPart[] | undefined) {
    const view = renderWithProviders(<Previewer parts={parts} />);
    view.queryClient.setQueryData(
        previewMeshQueryKey(previewMeshId(SCREW)),
        new ArrayBuffer(8)
    );
    return view;
}

beforeEach(() => {
    useOnshapeLaunch.setState({
        server: SERVER,
        documentId: "doc",
        instanceId: "ws",
        instanceType: "w",
        elementId: "asm",
        elementType: "ASSEMBLY" as never
    });
    posted = spyOnPost();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("usePartPreview", () => {
    it("shows each part with its mesh, sending a mesh two parts share once", async () => {
        useCompanion.setState({ isConnected: true });
        const parts = [SCREW, { ...SCREW, transform: MOVED }];

        const view = renderPreviewer(parts);
        view.rerender(<Previewer parts={parts} />);

        await vi.waitFor(() => {
            expect(messages()).toContainEqual(
                expect.objectContaining({ type: "show-preview" })
            );
        });
        const show = messages().find(
            (message) => message.type === "show-preview"
        );
        expect(Object.keys(show?.meshes as object)).toEqual([
            previewMeshId(SCREW)
        ]);
        expect(show?.parts).toEqual([
            { mesh: previewMeshId(SCREW), transform: IDENTITY },
            { mesh: previewMeshId(SCREW), transform: MOVED }
        ]);
        const toCompanion = posted.mock.calls.find(
            ([message]: unknown[]) =>
                (message as Record<string, unknown>).source === COMPANION_SOURCE
        );
        expect(toCompanion?.[1]).toBe(SERVER);
    });

    it("clears the preview once nothing is to be shown, and when it unmounts", async () => {
        useCompanion.setState({ isConnected: true });
        const parts = [SCREW];
        const view = renderPreviewer(parts);
        view.rerender(<Previewer parts={parts} />);
        await vi.waitFor(() => {
            expect(messages()).toHaveLength(1);
        });

        view.rerender(<Previewer parts={undefined} />);
        expect(messages().at(-1)).toEqual({
            source: COMPANION_SOURCE,
            type: "clear-preview"
        });

        view.rerender(<Previewer parts={parts} />);
        await vi.waitFor(() => {
            expect(messages().at(-1)?.type).toBe("show-preview");
        });
        view.unmount();
        expect(messages().at(-1)?.type).toBe("clear-preview");
    });

    it("turns Onshape's spinner while a check is going, and stops it after", async () => {
        useCompanion.setState({ isConnected: true });
        const parts = [SCREW];
        const view = renderPreviewer(parts);

        view.rerender(<Previewer parts={parts} isUpdating />);
        expect(spinner()).toEqual(["startWorkingSpinner"]);

        view.rerender(<Previewer parts={parts} />);
        await vi.waitFor(() => {
            expect(spinner()).toEqual([
                "startWorkingSpinner",
                "stopWorkingSpinner"
            ]);
        });
    });

    it("sends nothing without the extension", () => {
        const view = renderPreviewer([SCREW]);
        view.rerender(<Previewer parts={[SCREW]} isUpdating />);
        view.unmount();

        expect(posted).not.toHaveBeenCalled();
    });
});
