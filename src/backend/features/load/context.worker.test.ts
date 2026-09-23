import { describe, expect, it } from "vitest";
import { createLimiter } from "./context";

describe("createLimiter", () => {
    it("never runs more than `max` tasks at once", async () => {
        const limit = createLimiter(3);
        let active = 0;
        let peak = 0;

        await Promise.all(
            Array.from({ length: 20 }, () =>
                limit(async () => {
                    active++;
                    peak = Math.max(peak, active);
                    await new Promise((resolve) => setTimeout(resolve, 5));
                    active--;
                })
            )
        );

        expect(peak).toBe(3);
    });

    it("returns each task's result", async () => {
        const limit = createLimiter(2);
        const results = await Promise.all(
            [1, 2, 3, 4, 5].map((n) => limit(() => Promise.resolve(n * 2)))
        );
        expect(results).toEqual([2, 4, 6, 8, 10]);
    });

    it("keeps running after a task throws", async () => {
        const limit = createLimiter(1);
        await expect(
            limit(() => Promise.reject(new Error("boom")))
        ).rejects.toThrow("boom");
        await expect(limit(() => Promise.resolve("ok"))).resolves.toBe("ok");
    });
});
