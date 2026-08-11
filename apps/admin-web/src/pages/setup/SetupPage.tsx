import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { SettingsForm } from "../../components/SettingsForm";
import { useUpdateSettingsMutation } from "../../api/queries";
import type { ConfigResponse, Settings } from "../../api/types";

interface SetupPageProps {
  config: ConfigResponse;
}

export function SetupPage({ config }: SetupPageProps) {
  const [settings, setSettings] = useState<Settings>(config.settings);
  const mutation = useUpdateSettingsMutation();

  return (
    <Box sx={{ maxWidth: 760, mx: "auto", py: 6, px: 2 }}>
      <Card elevation={2}>
        <CardContent>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h5" component="h1">
                Initialize test-server credentials
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                These values are prefilled with dev defaults. Review or change them, then
                save — they become the source of truth every app reads.
              </Typography>
            </Box>

            <Alert severity="warning">
              Dummy dev values only. Never enter real secrets or credentials here.
            </Alert>

            <SettingsForm value={settings} onChange={setSettings} />

            {mutation.isError && (
              <Alert severity="error">Could not save. Is the config server running?</Alert>
            )}

            <Stack direction="row" justifyContent="flex-end">
              <Button
                variant="contained"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ ...settings, initialized: true })}
              >
                Save &amp; continue
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
