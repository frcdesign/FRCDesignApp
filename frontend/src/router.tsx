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
    getContextDataQuery,
    getDocumentOrderQuery,
    getDocumentsQuery,
    getElementsQuery,
    getFavoritesQuery,
    getSettingsQuery
} from "./queries";
import { ContextData } from "./api/models";
import { SafariError } from "./pages/safari-error";
import { MenuParams } from "./api/menu-params";
import { OnshapeParams } from "./api/onshape-params";
import { Vendor } from "./api/models";
import { AppError } from "./app/app-error";

interface BaseSearchParams {
    query?: string;
    vendors?: Vendor[];
}

type SearchParams = OnshapeParams & BaseSearchParams & MenuParams & ContextData;

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
        search.systemTheme = search.theme;
        delete search.theme;
        return search as unknown as SearchParams;
    },
    search: {
        middlewares: [retainSearchParams(true)]
    },
    loaderDeps: ({ search }) => ({
        userId: search.userId,
        currentAccessLevel: search.currentAccessLevel,
        cacheVersion: search.cacheVersion
    }),
    loader: async ({ deps }) => {
        queryClient.fetchQuery(getFavoritesQuery(deps));
        queryClient.fetchQuery(getDocumentOrderQuery(deps));
        queryClient.fetchQuery(getDocumentsQuery(deps));
        queryClient.fetchQuery(getElementsQuery(deps));

        return queryClient.ensureQueryData(getSettingsQuery(deps));
    }
});

const baseAppRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/",
    component: BaseApp,
    loaderDeps: ({ search }) => ({
        documentId: search.documentId,
        instanceId: search.instanceId,
        instanceType: search.instanceType
    }),
    loader: async ({ deps }) => {
        // Context data goes here since we only need them once
        return queryClient.ensureQueryData(getContextDataQuery(deps));
    }
});

const homeRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "documents",
    // loaderDeps: ({ search }) => ({ userId: search.userId }),
    // loader: async ({ deps }) => {
    //     // Everything else goes here since we only need them in Documents

    //     return [];
    // },
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
