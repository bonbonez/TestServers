import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { ConnectionsPanel } from "./components/ConnectionsPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { ClientsTable } from "./components/ClientsTable";
import { EnvExportButton } from "./components/EnvExportButton";
import type { ConfigResponse } from "../../api/types";

interface DashboardPageProps {
  config: ConfigResponse;
}

export function DashboardPage({ config }: DashboardPageProps) {
  return (
    <Box sx={{ pb: 6 }}>
      <AppBar position="static" color="primary">
        <Toolbar>
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
            Test Servers — Credentials
          </Typography>
          <EnvExportButton />
        </Toolbar>
      </AppBar>
      <Container maxWidth="md" sx={{ pt: 3 }}>
        <Stack spacing={3}>
          <ConnectionsPanel
            connections={config.connections}
            settings={config.settings}
          />
          <SettingsPanel settings={config.settings} />
          <ClientsTable clients={config.clients} />
        </Stack>
      </Container>
    </Box>
  );
}
