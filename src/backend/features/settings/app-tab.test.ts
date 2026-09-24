import { describe, expect, it } from "vitest";
import { LibraryId } from "../library/library-id";
import { getTabPath, isLibraryTab, toAppTab, UtilityTab } from "./app-tab";

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

    it("falls back for a tab the app no longer knows", () => {
        expect(toAppTab("old-frc-lib", LibraryId.FRC_DESIGN_LIB)).toBe(
            LibraryId.FRC_DESIGN_LIB
        );
        expect(toAppTab(undefined, LibraryId.FRC_DESIGN_LIB)).toBe(
            LibraryId.FRC_DESIGN_LIB
        );
        expect(toAppTab(UtilityTab.VERSION_MANAGER, LibraryId.MKCAD)).toBe(
            UtilityTab.VERSION_MANAGER
        );
    });
});
