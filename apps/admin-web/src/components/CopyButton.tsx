import { useState } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { IconCheck16, IconCopy16 } from "../icons";

interface CopyButtonProps {
  value: string;
  size?: "small" | "medium";
}

export function CopyButton({ value, size }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard may be unavailable outside a secure context; ignore.
    }
  };

  return (
    <Tooltip title={copied ? "Copied" : "Copy"}>
      <IconButton
        onClick={copy}
        size={size ?? "small"}
        sx={{ color: copied ? "#2E7D32" : "inherit" }}
      >
        {copied ? <IconCheck16 /> : <IconCopy16 />}
      </IconButton>
    </Tooltip>
  );
}
