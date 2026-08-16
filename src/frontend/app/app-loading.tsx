import { ReactNode } from "react";

/**
 * Router-wide fallback while a match loads. Like {@link RootCrash} it renders
 * above the root component, so it must not use Mantine — no provider yet.
 * Once the shell has mounted, its own boundary catches pending children.
 */
export function AppLoading(): ReactNode {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100dvh"
            }}
        >
            <style>
                {`@keyframes app-loading-spin { to { transform: rotate(360deg); } }`}
            </style>
            <div
                style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    border: "3px solid rgba(128, 128, 128, 0.25)",
                    borderTopColor: "rgba(128, 128, 128, 0.9)",
                    animation: "app-loading-spin 0.8s linear infinite"
                }}
            />
        </div>
    );
}
