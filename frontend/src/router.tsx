import { App, BaseApp } from "./app/app";
import { HomeList } from "./app/home-list";
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
import { DocumentList } from "./document/document-list";
import {
    getDocumentOrderQuery,
    getDocumentsQuery,
    getElementsQuery,
    getFavoritesQuery
} from "./queries";
import { SafariError } from "./pages/safari-error";
import { MenuParams } from "./api/menu-params";
import { OnshapeParams } from "./api/onshape-params";
import { AccessLevel, AccessLevelResult, Vendor } from "./api/backend-types";
import { AppError } from "./app/app-error";
import { queryOptions } from "@tanstack/react-query";
import { apiGet } from "./api/api";

interface BaseSearchParams {
    /**
     * The maximum access level the user can have.
     */
    maxAccessLevel: AccessLevel;
    /**
     * The access level the user is currently using.
     */
    accessLevel: AccessLevel;
    query?: string;
    vendors?: Vendor[];
}

type SearchParams = OnshapeParams & BaseSearchParams & MenuParams;

const rootRoute = createRootRoute();

/**
 * When the app is first loaded by Onshape, Onshape provides search params indiciating the context the app is being accessed from.
 * This route saves those parameters off to a store for later.
 */
const appRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "app",
    component: App,
    // Add SearchSchemaInput so search parameters become optional
    validateSearch: (search: Record<string, unknown> & SearchSchemaInput) => {
        return search as unknown as SearchParams;
    },
    search: {
        middlewares: [retainSearchParams(true)]
    }
});

const baseAppRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/",
    component: BaseApp,
    loader: () => {
        return queryClient.ensureQueryData(
            queryOptions<AccessLevelResult>({
                queryKey: ["access-level"],
                queryFn: () => apiGet("/access-level")
            })
        );
    }
});

const homeRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "documents",
    loaderDeps: ({ search }) => ({ userId: search.userId }),
    loader: async ({ deps }) => {
        const loadDocuments = getDocumentsQuery();
        const loadDocumentOrder = getDocumentOrderQuery();
        const loadElements = getElementsQuery();
        const loadFavorites = getFavoritesQuery(deps);

        return [
            queryClient.fetchQuery(loadDocuments),
            queryClient.fetchQuery(loadDocumentOrder),
            queryClient.fetchQuery(loadElements),
            queryClient.fetchQuery(loadFavorites)
        ];
    },
    errorComponent: AppError
});

const homeListRoute = createRoute({
    getParentRoute: () => homeRoute,
    path: "/",
    component: HomeList
});

const documentListRoute = createRoute({
    getParentRoute: () => homeRoute,
    path: "$documentId",
    component: DocumentList
});

const grantDeniedRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "grant-denied",
    component: GrantDenied
});

const licenseRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "license",
    component: License
});

const safariErrorRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "safari-error",
    component: SafariError
});

const routeTree = rootRoute.addChildren([
    appRoute.addChildren([
        baseAppRoute,
        homeRoute.addChildren([homeListRoute, documentListRoute])
    ]),
    grantDeniedRoute,
    licenseRoute,
    safariErrorRoute
]);

export const router = createRouter({
    routeTree,
    defaultStaleTime: Infinity,
    defaultGcTime: 6 * 1000
});
