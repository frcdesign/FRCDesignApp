import {
  createFileRoute,
  Outlet,
  redirect,
  retainSearchParams,
  type SearchSchemaInput,
  useSearch,
} from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { BlueprintProvider } from "@blueprintjs/core";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { queryClient } from "../../query-client";
import {
  getUserDataQuery,
  getLibraryQuery,
  getContextDataQuery,
  getSearchDbQuery,
  useUserData,
} from "../../queries";
import { type MenuParams } from "../../overlays/menu-params";
import {
  getBackgroundClass,
  getColorTheme,
  getThemeClass,
  type OnshapeParams,
} from "../../api-utils/onshape-params";
import { getUiState } from "../../api-utils/ui-state";
import { type AlertParams } from "../../overlays/popup-params";
import { AppNavbar } from "../../navbar/app-navbar";
import { AppAlerts } from "../../overlays/app-popups";
import { AppMenus } from "../../overlays/app-menus";
import { useMessageListener } from "../../api-utils/messages";
import { RootAppError } from "../../app/root-error";
import { ContextData } from "../../../shared/types";

type SearchParams = OnshapeParams & MenuParams & AlertParams & ContextData;

export const Route = createFileRoute("/app")({
  component: App,
  validateSearch: (search: Record<string, unknown> & SearchSchemaInput) => {
    search.systemTheme = search.theme;
    delete search.theme;
    return search as unknown as SearchParams;
  },
  search: {
    middlewares: [retainSearchParams(true)],
  },
  beforeLoad: async ({ location }) => {
    if (location.pathname !== "/app") {
      return;
    }

    const userData = await queryClient.ensureQueryData(getUserDataQuery());
    const library = userData.settings.library;

    const contextData = await queryClient.ensureQueryData(
      getContextDataQuery(library),
    );

    const uiState = getUiState();
    if (uiState.openDocumentId) {
      return redirect({
        to: "/app/documents/$documentId",
        params: { documentId: uiState.openDocumentId },
        search: () => contextData,
      });
    }

    return redirect({
      to: "/app/documents",
      search: () => contextData,
    });
  },
  loaderDeps: ({ search }) => ({
    userId: search.userId,
    cacheOptions: {
      currentAccessLevel: search.currentAccessLevel,
      cacheVersion: search.cacheVersion,
    },
  }),
  loader: async ({ deps }) => {
    const userData = await queryClient.ensureQueryData(getUserDataQuery());
    const library = userData.settings.library;
    Promise.all([
      queryClient.prefetchQuery(getLibraryQuery(library, deps.cacheOptions)),
      queryClient.prefetchQuery(getSearchDbQuery(library, deps.cacheOptions)),
    ]);
    return userData;
  },
  errorComponent: RootAppError,
});

function App() {
  const search = useSearch({ from: "/app" });
  const settings = useUserData().settings;
  const colorTheme = getColorTheme(settings.theme, search.systemTheme);
  const themeClass = getThemeClass(colorTheme);

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
          <div className={getBackgroundClass(colorTheme) + " app-content"}>
            <Outlet />
            <AppAlerts />
            <AppMenus />
            <TanStackRouterDevtools />
          </div>
        </div>
      </BlueprintProvider>
    </QueryClientProvider>
  );
}
