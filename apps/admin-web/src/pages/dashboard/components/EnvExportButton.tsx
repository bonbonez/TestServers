import { useState } from "react";
import Button from "@mui/material/Button";
import { fetchEnvFile } from "../../../api/client";
import { IconCheck16, IconCopy16 } from "../../../icons";

export function EnvExportButton() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      const text = await fetchEnvFile();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore clipboard/network failures on a dev console.
    }
  };

  return (
    <Button
      color="inherit"
      variant="outlined"
      startIcon={copied ? <IconCheck16 /> : <IconCopy16 />}
      onClick={copy}
    >
      {copied ? "Copied .env" : "Copy .env"}
    </Button>
  );
}
