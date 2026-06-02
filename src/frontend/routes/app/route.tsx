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
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { ContextMenuProvider } from "mantine-contextmenu";
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
import { AppNavbar } from "../../navbar/app-navbar";
import { AppMenus } from "../../overlays/app-menus";
import { useMessageListener } from "../../api-utils/messages";
import { RootAppError } from "../../app/root-error";
import { type AccessData, type Settings } from "../../../shared/types";

type SearchParams = OnshapeParams & MenuParams & { settings: Settings };

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
    void loaderData; // consumed by child components via useLoaderData
    // The app runs inside an Onshape iframe; portals (modals, context menus,
    // notifications) must mount inside #root so they pick up Mantine styles.
    // eslint-disable-next-line react-x/purity
    const portalContainer = document.getElementById("root")!;

    useMessageListener();

    return (
        <QueryClientProvider client={queryClient}>
            <MantineProvider
                forceColorScheme={getThemeClass(colorTheme)}
                getRootElement={() => portalContainer}
                cssVariablesSelector="#root"
            >
                <ContextMenuProvider>
                    <ModalsProvider
                        labels={{ confirm: "Confirm", cancel: "Cancel" }}
                    >
                        <Notifications
                            position="bottom-center"
                            limit={3}
                            portalProps={{ target: portalContainer }}
                        />
                        <div className="app-background">
                            <AppNavbar />
                            <div
                                className={
                                    getBackgroundClass(colorTheme) +
                                    " app-content"
                                }
                            >
                                <Outlet />
                                <AppMenus />
                                <TanStackRouterDevtools />
                            </div>
                        </div>
                    </ModalsProvider>
                </ContextMenuProvider>
            </MantineProvider>
        </QueryClientProvider>
    );
}
