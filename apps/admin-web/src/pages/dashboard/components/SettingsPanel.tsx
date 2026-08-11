import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { CopyField } from "../../../components/CopyField";
import { IconEdit16 } from "../../../icons";
import { SettingsModal } from "./SettingsModal";
import type { Settings } from "../../../api/types";

interface SettingsPanelProps {
  settings: Settings;
}

export function SettingsPanel({ settings }: SettingsPanelProps) {
  const [editing, setEditing] = useState(false);

  return (
    <Card variant="outlined">
      <CardContent>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 2,
          }}
        >
          <Typography variant="h6">Settings</Typography>
          <Button
            size="small"
            startIcon={<IconEdit16 />}
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
        </Box>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2}>
            <CopyField
              label="Access token TTL (s)"
              value={String(settings.accessTokenTtlSeconds)}
            />
            <CopyField
              label="Refresh token TTL (s)"
              value={String(settings.refreshTokenTtlSeconds)}
            />
            <CopyField
              label="Auth code TTL (s)"
              value={String(settings.authCodeTtlSeconds)}
            />
          </Stack>
          <CopyField
            label="Allowed redirect URIs"
            value={settings.allowedRedirectUris.join("\n")}
            multiline={true}
          />
        </Stack>
      </CardContent>
      <SettingsModal
        open={editing}
        settings={settings}
        onClose={() => setEditing(false)}
      />
    </Card>
  );
}
