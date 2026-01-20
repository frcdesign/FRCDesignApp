import { App } from "./app/app";
import { HomeList } from "./app/home-list";
import { GrantDenied } from "./pages/grant-denied";
import { License } from "./pages/license";
import {
    createRootRoute,
    createRoute,
    createRouter,
    redirect,
    retainSearchParams,
    SearchSchemaInput
} from "@tanstack/react-router";
import { queryClient } from "./query-client";
import { DocumentList } from "./app/document-list";
import {
    getUserDataQuery,
    getLibraryQuery,
    getContextDataQuery,
    getSearchDbQuery
} from "./queries";
import { ContextData } from "./api/models";
import { SafariError } from "./pages/safari-error";
import { MenuParams } from "./overlays/menu-params";
import { OnshapeParams } from "./api/onshape-params";
import { getUiState, updateUiState } from "./api/ui-state";
import { NotFoundError, RootAppError } from "./app/root-error";
import { AlertParams } from "./overlays/popup-params";
import { UserPath } from "./api/path";
import { BetaComplete } from "./pages/beta-complete";
import { CookieError } from "./pages/cookie-error";

type SearchParams = OnshapeParams & MenuParams & AlertParams & ContextData;

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
    beforeLoad: async ({ location }) => {
        if (location.pathname !== "/app") {
            return;
        }

        const search = location.search as OnshapeParams;
        const userPath: UserPath = { userId: search.userId };

        queryClient.prefetchQuery(getUserDataQuery(userPath));
        const contextData = await queryClient.ensureQueryData(
            getContextDataQuery(userPath)
        );

        const uiState = getUiState();
        if (uiState.openDocumentId) {
            return redirect({
                to: "/app/documents/$documentId",
                params: { documentId: uiState.openDocumentId },
                // Add contextData to search
                search: () => contextData
            });
        }

        return redirect({
            to: "/app/documents",
            // Add contextData to search
            search: () => contextData
        });
    },
    loaderDeps: ({ search }) => ({
        userId: search.userId,
        cacheOptions: {
            currentAccessLevel: search.currentAccessLevel,
            cacheVersion: search.cacheVersion
        }
    }),
    loader: async ({ deps }) => {
        const userData = await queryClient.ensureQueryData(
            getUserDataQuery(deps)
        );

        const library = userData.settings.library;

        // Don't return the promise since Tanstack will await it
        Promise.all([
            queryClient.prefetchQuery(
                getLibraryQuery(library, deps.cacheOptions)
            ),
            queryClient.prefetchQuery(
                getSearchDbQuery(library, deps.cacheOptions)
            )
        ]);

        return userData;
    },
    // Include it higher up in the hopes that accessLevel will be loaded for the escape hatch
    errorComponent: RootAppError
});

const homeRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "documents"
});

const homeListRoute = createRoute({
    getParentRoute: () => homeRoute,
    path: "/",
    component: HomeList,
    onEnter: () => {
        updateUiState({ openDocumentId: undefined });
    }
});

const documentListRoute = createRoute({
    getParentRoute: () => homeRoute,
    path: "$documentId",
    component: DocumentList,
    onEnter: (match) => {
        updateUiState({
            openDocumentId: match.params.documentId
        });
    }
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

const cookieErrorRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "cookie-error",
    component: CookieError
});

const betaCompleteRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "beta-complete",
    component: BetaComplete
});

const routeTree = rootRoute.addChildren([
    appRoute.addChildren([
        homeRoute.addChildren([homeListRoute, documentListRoute])
    ]),
    grantDeniedRoute,
    licenseRoute,
    safariErrorRoute,
    cookieErrorRoute,
    betaCompleteRoute
]);

export const router = createRouter({
    routeTree,
    defaultErrorComponent: () => <RootAppError isRoot />,
    defaultNotFoundComponent: () => <NotFoundError />
});
