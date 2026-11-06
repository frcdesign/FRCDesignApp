import { afterEach, describe, expect, it } from "vitest";
import { useOnshapeLaunch } from "../../lib/onshape-params";
import { collectDiagnostics } from "./diagnostics";

const DOCUMENT = "0123456789abcdef01234567";
const USER = "66f0ab4a55b9ff2109681766";

describe("collectDiagnostics", () => {
    afterEach(() => {
        useOnshapeLaunch.setState({}, true);
        window.history.replaceState(null, "", "/");
    });

    it("keeps the app's own page but not the document Onshape launched it in", () => {
        window.history.replaceState(
            null,
            "",
            `/app/library/frc-design-lib?documentId=${DOCUMENT}&instanceType=w&instanceId=${DOCUMENT}&elementId=${DOCUMENT}&elementType=ASSEMBLY&sessionCompanyId=${DOCUMENT}&server=https%3A%2F%2Fschool.onshape.com&userId=${USER}&clientId=client&insertable=ins`
        );

        const diagnostics = collectDiagnostics();

        expect(diagnostics.url).toBe(
            "/app/library/frc-design-lib?insertable=ins"
        );
        expect(diagnostics.launch).toEqual({
            elementType: "ASSEMBLY",
            instanceType: "w",
            enterprise: true
        });
        expect(JSON.stringify(diagnostics)).not.toContain(DOCUMENT);
        expect(JSON.stringify(diagnostics)).not.toContain("school");
        expect(JSON.stringify(diagnostics)).not.toContain(USER);
    });

    it("reads a personal account as no Enterprise", () => {
        useOnshapeLaunch.setState({
            documentId: DOCUMENT,
            sessionCompanyId: "cad",
            elementType: undefined
        });

        expect(collectDiagnostics().launch?.enterprise).toBe(false);
    });
});
