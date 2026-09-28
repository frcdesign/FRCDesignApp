import { Button } from "@mantine/core";
import { ArrowSquareOutIcon } from "@phosphor-icons/react";
import { openUrlInNewTab } from "../lib/url";

interface UrlButtonProps {
    url: string;
    text: string;
}

export function OpenUrlButton(props: UrlButtonProps) {
    return (
        <Button
            leftSection={<ArrowSquareOutIcon />}
            onClick={() => openUrlInNewTab(props.url)}
        >
            {props.text}
        </Button>
    );
}
