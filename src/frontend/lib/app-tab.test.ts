import { describe, expect, it } from "vitest";
import { LibraryId } from "@backend/features/library/library-id";
import { getTabPath, isLibraryTab, UtilityTab } from "./app-tab";

describe("app tabs", () => {
    it("gives each kind of tab its own path", () => {
        expect(getTabPath(LibraryId.FTC_DESIGN_LIB)).toBe(
            "/app/library/ftc-design-lib"
        );
        expect(getTabPath(UtilityTab.VERSION_MANAGER)).toBe(
            "/app/version-manager"
        );
    });

    it("tells a library from a utility", () => {
        expect(isLibraryTab(LibraryId.MKCAD)).toBe(true);
        expect(isLibraryTab(UtilityTab.VERSION_MANAGER)).toBe(false);
    });
});
