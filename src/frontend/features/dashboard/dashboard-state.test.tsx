import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { renderWithProviders } from "../../../__test_utils__/render";
import { DashboardState } from "./dashboard-state";

interface SectionProps {
    load: () => Promise<number>;
    title?: string;
}

/** A section whose query answers with whatever `load` does. */
function Section(props: SectionProps): ReactNode {
    const query = useQuery({
        queryKey: ["section"],
        queryFn: props.load,
        retry: false,
        staleTime: 0
    });
    return query.data === undefined ? (
        <DashboardState query={query} title={props.title} />
    ) : (
        <p>Loaded {query.data}</p>
    );
}

describe("DashboardState", () => {
    it("offers to try again and to send a report when a section fails", async () => {
        const user = userEvent.setup();
        const load = vi
            .fn<() => Promise<number>>()
            .mockRejectedValueOnce(new Error("Internal Server Error"))
            .mockResolvedValueOnce(7);
        renderWithProviders(<Section load={load} />);

        expect(
            await screen.findByText("Failed to load analytics.")
        ).not.toBeNull();
        expect(screen.getByText("Send a report")).not.toBeNull();

        await user.click(screen.getByText("Try again"));

        expect(await screen.findByText("Loaded 7")).not.toBeNull();
        expect(load).toHaveBeenCalledTimes(2);
    });

    it("keeps the section's title over a failure", async () => {
        renderWithProviders(
            <Section
                load={() => Promise.reject(new Error("Internal Server Error"))}
                title="Version manager"
            />
        );

        expect(
            await screen.findByText("Failed to load analytics.")
        ).not.toBeNull();
        expect(screen.getByText("Version manager")).not.toBeNull();
    });

    it("shows no error while the section is still loading", () => {
        renderWithProviders(
            <Section load={() => new Promise<number>(() => undefined)} />
        );

        expect(screen.queryByText("Failed to load analytics.")).toBeNull();
        expect(screen.queryByText("Send a report")).toBeNull();
    });
});
