import { describe, expect, it } from "vitest";
import { sign, verify } from "./signed";

describe("signing", () => {
    it("verifies what it signed", async () => {
        const signature = await sign("secret", "doc:ws");
        expect(await verify("secret", "doc:ws", signature)).toBe(true);
    });

    it.each([
        ["another value", "secret", "doc:other"],
        ["another secret", "guess", "doc:ws"]
    ])("rejects %s", async (_, secret, value) => {
        const signature = await sign("secret", "doc:ws");
        expect(await verify(secret, value, signature)).toBe(false);
    });

    it("rejects a signature that is not hex", async () => {
        expect(await verify("secret", "doc:ws", "not-hex")).toBe(false);
    });
});
