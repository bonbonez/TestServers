import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { CopyField } from "../../../components/CopyField";
import type { Connections, Settings } from "../../../api/types";

interface ConnectionsPanelProps {
  connections: Connections;
  settings: Settings;
}

export function ConnectionsPanel({ connections, settings }: ConnectionsPanelProps) {
  return (
    <Stack spacing={2}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom={true}>
            MCP server
          </Typography>
          <Stack spacing={2}>
            <CopyField label="No auth — URL" value={connections.mcp.none} />
            <Box>
              <CopyField label="Bearer — URL" value={connections.mcp.bearer} />
              <Box sx={{ mt: 1.5 }}>
                <CopyField label="Bearer token" value={settings.mcpBearerToken} />
              </Box>
            </Box>
            <Box>
              <CopyField label="OAuth — URL" value={connections.mcp.oauth} />
              <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
                <CopyField label="Audience" value={settings.accessTokenAudience} />
                <CopyField label="Required scope" value={settings.requiredScope} />
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom={true}>
            OAuth server
          </Typography>
          <Stack spacing={2}>
            <CopyField label="Authorization URL" value={connections.oauth.authorize} />
            <CopyField label="Token URL" value={connections.oauth.token} />
            <CopyField label="JWKS URL" value={connections.oauth.jwks} />
            <CopyField label="Userinfo URL" value={connections.oauth.userinfo} />
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom={true}>
            Protected resource API
          </Typography>
          <Stack spacing={2}>
            <CopyField label="Profile URL" value={connections.resource.profile} />
            <CopyField label="Items URL" value={connections.resource.items} />
            <CopyField label="Static bearer token" value={settings.apiStaticBearer} />
            <Stack direction="row" spacing={2}>
              <CopyField label="Basic auth user" value={settings.apiBasicUser} />
              <CopyField label="Basic auth password" value={settings.apiBasicPass} />
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
