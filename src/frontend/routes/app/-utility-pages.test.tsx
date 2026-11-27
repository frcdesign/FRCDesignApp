import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { type ComponentType } from "react";
import { ElementType } from "@backend/lib/onshape/element-type";
import { renderWithProviders } from "../../../__test_utils__/render";
import { useOnshapeLaunch } from "../../lib/onshape-params";
import { Route as AutoAssemblyRoute } from "./auto-assembly";
import { Route as MassAnalysisRoute } from "./mass-analysis";
import { Route as VersionManagerRoute } from "./version-manager";

vi.mock("../../features/auth/access-level", () => ({
    useNeedsSignIn: () => false,
    useAccessData: () => ({ seenHints: [], signedIn: true, isPending: false })
}));
vi.mock("../../lib/api-client", () => ({
    apiPost: vi.fn(() => Promise.resolve({}))
}));

const PAGES: [string, ComponentType][] = [
    ["Auto Assembly", AutoAssemblyRoute.options.component as ComponentType],
    ["Mass Analysis", MassAnalysisRoute.options.component as ComponentType],
    ["Version Manager", VersionManagerRoute.options.component as ComponentType]
];

beforeEach(() => {
    useOnshapeLaunch.setState({}, true);
});

describe("a utility page without what it acts on", () => {
    it.each(PAGES)("says %s needs Onshape, standalone", (name, Page) => {
        renderWithProviders(<Page />);

        expect(screen.getByText(`${name} is not available`)).toBeTruthy();
    });

    it.each(PAGES.slice(0, 2))(
        "says %s needs an assembly, in a Part Studio",
        (name, Page) => {
            useOnshapeLaunch.setState({
                documentId: "d",
                instanceType: "w",
                instanceId: "w",
                elementId: "e",
                elementType: ElementType.PART_STUDIO
            });
            renderWithProviders(<Page />);

            expect(screen.getByText(/^Open an assembly/)).toBeTruthy();
            expect(screen.queryByText(`${name} is not available`)).toBeNull();
        }
    );
});
