import { queryClient } from "../query-client";
import { AppNavbar } from "./app-navbar";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import {
    Navigate,
    Outlet,
    useMatchRoute,
    useSearch
} from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import {
    getThemeClass,
    saveOnshapeData,
    useOnshapeData
} from "../api/onshape-data";
import { BlueprintProvider, Section } from "@blueprintjs/core";

export function App() {
    const matchRoute = useMatchRoute();
    const search = useSearch({ from: "/app" });
    const onshapeData = useOnshapeData();

    if (matchRoute({ to: "/app" })) {
        saveOnshapeData(search);
        return <Navigate to="/app/documents" />;
    }

    return (
        <BlueprintProvider portalClassName={getThemeClass(onshapeData.theme)}>
            <QueryClientProvider client={queryClient}>
                <Section
                    className={
                        getThemeClass(onshapeData.theme) + " app-background"
                    }
                >
                    <AppNavbar />
                    <div className="app-content">
                        <Outlet />
                        <TanStackRouterDevtools />
                    </div>
                </Section>
            </QueryClientProvider>
        </BlueprintProvider>
    );
}
