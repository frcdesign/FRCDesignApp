import { queryClient } from "../query-client";
import { AppNavbar } from "./app-navbar";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Navigate, Outlet, useMatchRoute } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { getThemeClass, useOnshapeData } from "../api/onshape-data";
import { BlueprintProvider, Section } from "@blueprintjs/core";
import { AdminPanel } from "./admin-panel";
import { InsertMenu } from "./insert-menu";

export function App() {
    const matchRoute = useMatchRoute();
    const onshapeData = useOnshapeData();

    if (matchRoute({ to: "/app" })) {
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
                        <AdminPanel />
                        <InsertMenu />
                        <TanStackRouterDevtools />
                    </div>
                </Section>
            </QueryClientProvider>
        </BlueprintProvider>
    );
}
