import {
    createFileRoute,
    Outlet,
    redirect,
    retainSearchParams,
    type SearchSchemaInput,
    useLoaderData,
    useSearch
} from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { BlueprintProvider } from "@blueprintjs/core";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { queryClient } from "../../query-client";
import {
    getFavoritesQuery,
    getContextDataQuery,
    getLibraryQuery,
    getSearchDbQuery
} from "../../queries";
import { type MenuParams } from "../../overlays/menu-params";
import {
    getBackgroundClass,
    getColorTheme,
    getThemeClass,
    OnshapeParams
} from "../../api-utils/onshape-params";
import { getUiState } from "../../api-utils/ui-state";
import { type PopupParams } from "../../overlays/popup-params";
import { AppNavbar } from "../../navbar/app-navbar";
import { AppPopups } from "../../overlays/app-popups";
import { AppMenus } from "../../overlays/app-menus";
import { useMessageListener } from "../../api-utils/messages";
import { RootAppError } from "../../app/root-error";
import { type AccessData, type Settings } from "../../../shared/types";

type SearchParams = OnshapeParams &
    MenuParams &
    PopupParams & { settings: Settings };

export const Route = createFileRoute("/app")({
    component: App,
    validateSearch: (search: Record<string, unknown> & SearchSchemaInput) => {
        search.systemTheme = search.theme;
        delete search.theme;
        return search as unknown as SearchParams;
    },
    search: {
        middlewares: [retainSearchParams(true)]
    },
    beforeLoad: async ({ location }) => {
        const contextData = await queryClient.ensureQueryData(
            getContextDataQuery()
        );
        const context = { accessData: contextData.accessData };
        if (location.pathname !== "/app") {
            return context;
        }

        const settings = { settings: contextData.settings };

        const uiState = getUiState();
        if (uiState.openDocumentId) {
            throw redirect({
                to: "/app/documents/$documentId",
                params: { documentId: uiState.openDocumentId },
                search: settings
            });
        }
        // must throw redirects here for type inference to work
        throw redirect({
            to: "/app/documents",
            search: settings
        });
    },
    loaderDeps: ({ search }) => ({
        library: search.settings?.library
    }),
    loader: async ({ context, deps }): Promise<AccessData> => {
        const accessData = context.accessData;
        await Promise.all([
            queryClient.prefetchQuery(
                getLibraryQuery(deps.library, accessData)
            ),
            queryClient.prefetchQuery(
                getSearchDbQuery(deps.library, accessData)
            ),
            queryClient.prefetchQuery(getFavoritesQuery(deps.library))
        ]);
        return accessData;
    },
    errorComponent: RootAppError
});

function App() {
    const search = useSearch({ from: "/app" });
    const loaderData = useLoaderData({ from: "/app" });
    const colorTheme = getColorTheme(
        search.settings?.theme,
        search.systemTheme
    );
    const themeClass = getThemeClass(colorTheme);
    void loaderData; // consumed by child components via useLoaderData

    useMessageListener();

    return (
        <QueryClientProvider client={queryClient}>
            <BlueprintProvider
                portalClassName={themeClass}
                // Very important, context menus do not work with the default container :(
                portalContainer={document.getElementById("root")!}
            >
                <div className={themeClass + " app-background"}>
                    <AppNavbar />
                    <div
                        className={
                            getBackgroundClass(colorTheme) + " app-content"
                        }
                    >
                        <Outlet />
                        <AppPopups />
                        <AppMenus />
                        <TanStackRouterDevtools />
                    </div>
                </div>
            </BlueprintProvider>
        </QueryClientProvider>
    );
}
