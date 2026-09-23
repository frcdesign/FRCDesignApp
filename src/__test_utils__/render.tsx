/**
 * Renders a component the way the app does — themed, with a query cache —
 * for the dom project's tests. The cache never refetches on its own, so a test
 * seeds what a component reads rather than serving it over a network.
 */
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { type ReactNode } from "react";
import { createAppTheme } from "@frontend/theme";

export function createTestQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity }
        }
    });
}

export function renderWithProviders(
    ui: ReactNode,
    queryClient: QueryClient = createTestQueryClient()
) {
    return {
        queryClient,
        ...render(
            <QueryClientProvider client={queryClient}>
                {/* `test` turns off transitions and portals, which jsdom
                    cannot run, and which would hide a dropdown's options. */}
                <MantineProvider
                    theme={createAppTheme("frc-design-lib")}
                    env="test"
                >
                    {ui}
                </MantineProvider>
            </QueryClientProvider>
        )
    };
}
