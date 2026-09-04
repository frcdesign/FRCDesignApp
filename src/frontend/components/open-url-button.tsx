import { Button } from "@mantine/core";
import { ArrowSquareOutIcon } from "@phosphor-icons/react";
import { IconSize } from "../lib/style-constants";
import { openUrlInNewTab } from "../lib/url";

interface UrlButtonProps {
    url: string;
    text: string;
}

export function OpenUrlButton(props: UrlButtonProps) {
    return (
        <Button
            leftSection={<ArrowSquareOutIcon size={IconSize.SMALL} />}
            onClick={() => openUrlInNewTab(props.url)}
            variant="light"
        >
            {props.text}
        </Button>
    );
}
