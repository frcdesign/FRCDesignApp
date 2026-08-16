import { ReactNode } from "react";

/**
 * Router-wide fallback while a match loads. Like RootCrash it renders above the
 * root component, so it must not use Mantine — there is no provider yet.
 */
export function RootAppSpinner(): ReactNode {
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
                {`@keyframes root-spinner-spin { to { transform: rotate(360deg); } }`}
            </style>
            <div
                style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    border: "3px solid rgba(128, 128, 128, 0.25)",
                    borderTopColor: "rgba(128, 128, 128, 0.9)",
                    animation: "root-spinner-spin 0.8s linear infinite"
                }}
            />
        </div>
    );
}
