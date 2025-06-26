import { App } from "./app/app";
import { DocumentList } from "./app/document-list";
import { SearchParams } from "./api/search-params";
import { GrantDenied } from "./pages/grant-denied";
import { License } from "./pages/license";
import {
    createRootRoute,
    createRoute,
    createRouter,
    retainSearchParams,
    SearchSchemaInput
} from "@tanstack/react-router";
import { queryClient } from "./query-client";
import { ConfigurationResult, DocumentResult } from "./api/backend-types";
import { ConfigurationDialog } from "./app/insert-dialog";
import { queryOptions } from "@tanstack/react-query";
import { apiGet } from "./api/api";

const rootRoute = createRootRoute();

/**
 * When the app is first loaded by Onshape, Onshape provides search params indiciating the context the app is being accessed from.
 * This route saves those parameters off to a store for later.
 */
const appRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/app",
    component: App,
    // Add SearchSchemaInput so search parameters become optional
    validateSearch: (
        search: Record<string, unknown> & SearchSchemaInput
    ): SearchParams => {
        return search as unknown as SearchParams;
    },
    search: {
        middlewares: [retainSearchParams(true)]
    }
});

const documentsRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/documents",
    component: DocumentList,
    beforeLoad: ({ abortController }) => {
        const loadDocuments = queryOptions<DocumentResult>({
            queryKey: ["documents"],
            queryFn: () => apiGet("/documents", {}, abortController.signal)
        });
        return queryClient.ensureQueryData(loadDocuments);
    },
    loader: ({ context }) => {
        return context;
    }
});

const insertDialogRoute = createRoute({
    getParentRoute: () => documentsRoute,
    path: "/$elementId",
    component: ConfigurationDialog,
    loader: ({ params, abortController, context }) => {
        const element = context.elements[params.elementId];
        const configurationId = element?.configurationId;
        if (!configurationId) {
            return undefined;
        }
        const loadConfiguration = queryOptions<ConfigurationResult>({
            queryKey: ["configuration", configurationId],
            queryFn: () =>
                apiGet(
                    "/configuration/" + configurationId,
                    {},
                    abortController.signal
                )
        });
        return queryClient.ensureQueryData(loadConfiguration);
    }
});

const grantDeniedRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/grant-denied",
    component: GrantDenied
});

const licenseRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/license",
    component: License
});

const routeTree = rootRoute.addChildren([
    appRoute.addChildren([documentsRoute.addChildren([insertDialogRoute])]),
    grantDeniedRoute,
    licenseRoute
]);

export const router = createRouter({
    routeTree
    // Database is immutable, so no need to refetch things
    // defaultStaleTime: Infinity,
    // defaultPreloadStaleTime: Infinity
});
