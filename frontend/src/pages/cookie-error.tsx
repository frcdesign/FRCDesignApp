import { Icon, NonIdealState, NonIdealStateIconSize } from "@blueprintjs/core";

export function CookieError(): JSX.Element {
    return (
        <div style={{ height: "80vh" }}>
            <NonIdealState
                icon={
                    <Icon
                        icon="cross"
                        intent="danger"
                        size={NonIdealStateIconSize.STANDARD}
                    />
                }
                title="Cannot Set Authentication Cookie"
                description="The FRCDesignApp could not set an authentication cookie. Please try clearing your cookies and ensure your browser is set to allow cookies from third-party sites. If the problem persists, contact the FRCDesignApp developers."
            />
        </div>
    );
}
