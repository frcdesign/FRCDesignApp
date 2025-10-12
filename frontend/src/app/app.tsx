import { queryClient } from "../query-client";
import { AppNavbar } from "../navbar/app-navbar";
import { Outlet, useSearch } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import {
    getBackgroundClass,
    getColorTheme,
    getThemeClass
} from "../search-params/onshape-params";
import { BlueprintProvider } from "@blueprintjs/core";
import { SettingsMenu } from "../navbar/settings-menu";
import { InsertMenu } from "../insert/insert-menu";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { AddDocumentMenu } from "./add-document-menu";
import { useUserData } from "../queries";
import { FavoriteMenu } from "../favorites/favorite-menu";
import { AppAlerts } from "../search-params/alerts";

export function App() {
    const search = useSearch({ from: "/app" });
    const userData = useUserData();
    const colorTheme = getColorTheme(
        userData.settings.theme,
        search.systemTheme
    );
    const themeClass = getThemeClass(colorTheme);

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
                        <AppAlerts />
                        <SettingsMenu />
                        <InsertMenu />
                        <AddDocumentMenu />
                        <FavoriteMenu />
                        <TanStackRouterDevtools />
                    </div>
                </div>
            </BlueprintProvider>
        </QueryClientProvider>
    );
}
