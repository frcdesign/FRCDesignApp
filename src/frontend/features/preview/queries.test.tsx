import {
    PREVIEW_SOURCE,
    previewMeshId,
    type PreviewPart
} from "@backend/features/previews/contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../__test_utils__/render";
import { useOnshapeLaunch } from "../../lib/onshape-params";
import { previewMeshQueryKey } from "../../lib/query-keys";
import { usePreviewExtension } from "./extension";
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
}

function Previewer({ parts }: PreviewerProps) {
    usePartPreview(parts);
    return null;
}

let posted: ReturnType<typeof spyOnPost>;

const spyOnPost = () =>
    vi.spyOn(window, "postMessage").mockImplementation(() => undefined);

/** What reached the Onshape page; in jsdom, the panel is its own parent. */
const messages = (): Record<string, unknown>[] =>
    posted.mock.calls.map(
        ([message]: unknown[]) => message as Record<string, unknown>
    );

function renderPreviewer(parts: PreviewPart[] | undefined) {
    const view = renderWithProviders(<Previewer parts={parts} />);
    view.queryClient.setQueryData(
        previewMeshQueryKey(previewMeshId(SCREW)),
        new ArrayBuffer(8)
    );
    return view;
}

beforeEach(() => {
    useOnshapeLaunch.setState({ server: SERVER });
    posted = spyOnPost();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("usePartPreview", () => {
    it("shows each part with its mesh, sending a mesh two parts share once", async () => {
        usePreviewExtension.setState({ isReady: true });
        const parts = [SCREW, { ...SCREW, transform: MOVED }];

        const view = renderPreviewer(parts);
        view.rerender(<Previewer parts={parts} />);

        await vi.waitFor(() => {
            expect(messages()).toContainEqual(
                expect.objectContaining({ type: "show" })
            );
        });
        const show = messages().find((message) => message.type === "show");
        expect(Object.keys(show?.meshes as object)).toEqual([
            previewMeshId(SCREW)
        ]);
        expect(show?.parts).toEqual([
            { mesh: previewMeshId(SCREW), transform: IDENTITY },
            { mesh: previewMeshId(SCREW), transform: MOVED }
        ]);
        expect(posted.mock.calls[0][1]).toBe(SERVER);
    });

    it("clears the preview once nothing is to be shown, and when it unmounts", async () => {
        usePreviewExtension.setState({ isReady: true });
        const parts = [SCREW];
        const view = renderPreviewer(parts);
        view.rerender(<Previewer parts={parts} />);
        await vi.waitFor(() => {
            expect(messages()).toHaveLength(1);
        });

        view.rerender(<Previewer parts={undefined} />);
        expect(messages().at(-1)).toEqual({
            source: PREVIEW_SOURCE,
            type: "clear"
        });

        view.rerender(<Previewer parts={parts} />);
        await vi.waitFor(() => {
            expect(messages().at(-1)?.type).toBe("show");
        });
        view.unmount();
        expect(messages().at(-1)?.type).toBe("clear");
    });

    it("sends nothing without the extension", () => {
        const view = renderPreviewer([SCREW]);
        view.rerender(<Previewer parts={[SCREW]} />);
        view.unmount();

        expect(posted).not.toHaveBeenCalled();
    });
});
