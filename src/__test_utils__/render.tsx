/** Themed, with a query cache that never fetches: seed what a component reads. */
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
