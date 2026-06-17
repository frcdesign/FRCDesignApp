import { env } from "cloudflare:workers";
import { type Hono } from "hono";
import { type AppBindings, type AppContextEnv, getApp } from "../backend/app";
import { type Db, getDb } from "../backend/db";
import { type AccessLevel } from "../shared/types";
import { MockOnshapeApi } from "./mock-onshape-api";

type Routes = Hono<AppContextEnv>;

export interface TestHarnessOptions {
    /** The route module under test, e.g. `favoriteRoutes`. */
    routes: Routes;
    /** Current user id (default `"test-user"`); answered from `users/sessioninfo`. */
    userId?: string;
    /** Sets `ACCESS_LEVEL_OVERRIDE` so admin-gated routes resolve without Onshape. */
    accessLevel?: AccessLevel;
    /** Overrides the admin team binding (defaults to the wrangler value). */
    adminTeam?: string;
    /** Path the routes are mounted under (default `"/api"`). */
    basePath?: string;
    /** A pre-configured Onshape mock (e.g. with extra stubbed endpoints). */
    onshapeApi?: MockOnshapeApi;
}

export interface TestRequestInit {
    query?: Record<string, string>;
    body?: unknown;
    headers?: Record<string, string>;
}

export interface TestHarness {
    /** Drizzle client over the (real, isolated) test D1 database for seeding/asserting. */
    db: Db;
    /** The bindings passed to each request. */
    env: AppBindings;
    /** The mock Onshape API injected into the context. */
    onshapeApi: MockOnshapeApi;
    /** Issues a request against the mounted routes. */
    request: (
        method: string,
        path: string,
        init?: TestRequestInit
    ) => Promise<Response>;
}

/**
 * Builds a fresh Hono app with the routes under test mounted, backed by the real
 * (per-test isolated) Cloudflare bindings.
 *
 * A middleware injects a {@link MockOnshapeApi} into the context before the
 * routes run, so the app's real auth middleware (`getOnshapeApi`/`getUserId`)
 * resolves the test identity from the mock instead of hitting the session/KV.
 */
export function createTestHarness(options: TestHarnessOptions): TestHarness {
    const basePath = options.basePath ?? "/api";
    const onshapeApi =
        options.onshapeApi ?? new MockOnshapeApi({ userId: options.userId });
    if (options.userId !== undefined) {
        onshapeApi.userId = options.userId;
    }

    const testEnv = {
        ...env,
        ADMIN_TEAM: options.adminTeam ?? env.ADMIN_TEAM,
        ACCESS_LEVEL_OVERRIDE: options.accessLevel ?? ""
    } as unknown as AppBindings;

    const app = getApp();
    app.use("*", async (c, next) => {
        c.set("onshapeApi", onshapeApi.asOAuthApi());
        await next();
    });
    app.route(basePath, options.routes);

    const request: TestHarness["request"] = async (method, path, init = {}) => {
        const url = new URL(path, "http://localhost");
        for (const [key, value] of Object.entries(init.query ?? {})) {
            url.searchParams.set(key, value);
        }
        const headers = new Headers(init.headers);
        let body: BodyInit | undefined;
        if (init.body !== undefined) {
            body = JSON.stringify(init.body);
            if (!headers.has("Content-Type")) {
                headers.set("Content-Type", "application/json");
            }
        }
        return app.request(url.toString(), { method, headers, body }, testEnv);
    };

    return { db: getDb(env.DB), env: testEnv, onshapeApi, request };
}
