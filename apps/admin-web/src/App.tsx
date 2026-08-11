import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { useConfigQuery } from "./api/queries";
import { SetupPage } from "./pages/setup/SetupPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";

export function App() {
  const configQuery = useConfigQuery();

  let content = (
    <Box sx={{ display: "flex", justifyContent: "center", pt: 12 }}>
      <CircularProgress />
    </Box>
  );

  if (configQuery.isError) {
    content = (
      <Box sx={{ maxWidth: 560, mx: "auto", pt: 8, px: 2 }}>
        <Alert severity="error">
          Could not reach the config server. Start it with{" "}
          <code>yarn workspace config-server dev</code> and reload.
        </Alert>
      </Box>
    );
  } else if (configQuery.data) {
    content = configQuery.data.settings.initialized ? (
      <DashboardPage config={configQuery.data} />
    ) : (
      <SetupPage config={configQuery.data} />
    );
  }

  return content;
}
