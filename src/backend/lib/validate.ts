import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import { HttpStatus } from "http-status-ts";
import type { ZodType } from "zod";
import { internalError } from "./api-error";

/**
 * `zValidator` with our error shape. On its own it answers with a body of its
 * own design, which is the one response that would not look like every other
 * failure. A malformed request is our bug, so the detail is for the logs.
 */
export function validate<
    T extends ZodType,
    Target extends keyof ValidationTargets
>(target: Target, schema: T) {
    return zValidator(target, schema, (result) => {
        if (!result.success) {
            throw internalError(
                `Invalid ${target}: ${result.error.message}`,
                HttpStatus.BAD_REQUEST
            );
        }
    });
}
