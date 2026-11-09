import type {
    OnshapeCallBody,
    OnshapeMethod
} from "@backend/features/testbench/contract";
import { ONSHAPE_API_VERSION } from "@backend/lib/onshape/client";

/** The form as typed: query and body are JSON text until sent. */
export interface CallDraft {
    method: OnshapeMethod;
    version: number;
    path: string;
    query: string;
    body: string;
}

export const DEFAULT_DRAFT: CallDraft = {
    method: "GET",
    version: ONSHAPE_API_VERSION,
    path: "/users/sessioninfo",
    query: "{}",
    body: ""
};

/** Undefined when the query or body isn't valid JSON. */
export function toCallBody(draft: CallDraft): OnshapeCallBody | undefined {
    try {
        return {
            method: draft.method,
            version: draft.version,
            path: draft.path.trim(),
            query: draft.query.trim()
                ? (JSON.parse(draft.query) as Record<string, string>)
                : {},
            body: draft.body.trim()
                ? (JSON.parse(draft.body) as unknown)
                : undefined
        };
    } catch {
        return undefined;
    }
}
