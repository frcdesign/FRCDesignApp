import { expect, it } from "vitest";
import { encodeQueryConfiguration } from "../features/configurations/utils";
import { toQueryString } from "./query-params";

// Onshape reads `+` literally, so a quantity sent that way is ignored.
it("sends a space as %20, which Onshape reads as one", () => {
    const configuration = encodeQueryConfiguration({ Length: "0.1524 m" });

    expect(toQueryString({ configuration })).toBe(
        "configuration=Length%3D0.1524%20m"
    );
});

it("keeps a literal plus distinct from a space", () => {
    expect(toQueryString({ value: "1+2 in" })).toBe("value=1%2B2%20in");
});
