import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import { HttpStatus } from "http-status-ts";
import type { ZodType } from "zod";
import { internalError } from "./api-error";

/**
 * `zValidator` with our error shape; its own body is the one that would not
 * match. A malformed request is our bug, so the detail is for the logs.
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
