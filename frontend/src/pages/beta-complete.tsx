import { Icon, NonIdealState, NonIdealStateIconSize } from "@blueprintjs/core";
import { OpenUrlButton } from "../common/open-url-button";

const URL =
    "https://cad.onshape.com/appstore/apps/Manufacturers%20Models/6004ec5e83c40b107c183347";

export function BetaComplete(): JSX.Element {
    const frcDesignAppButton = <OpenUrlButton text="FRCDesignApp" url={URL} />;

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
                title="The FRCDesignApp Beta has concluded."
                description="The Beta is now over, and the FRCDesignApp has replaced the existing MKCad app. If you don't have the MKCad app, you can get it from the Onshape App Store. Thank you for participating!"
                action={frcDesignAppButton}
            />
        </div>
    );
}
