import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

const OAUTH_SERVER_URL =
  import.meta.env.VITE_OAUTH_SERVER_URL ?? "http://127.0.0.1:7200";

interface AuthorizeParams {
  clientId: string;
  redirectUri: string;
  state: string;
  scope: string;
}

function readParams(): AuthorizeParams {
  const query = new URLSearchParams(window.location.search);
  return {
    clientId: query.get("client_id") ?? "",
    redirectUri: query.get("redirect_uri") ?? "",
    state: query.get("state") ?? "",
    scope: query.get("scope") ?? "read",
  };
}

export function App() {
  const params = useMemo(readParams, []);
  const scopes = useMemo(
    () => params.scope.split(" ").filter(Boolean),
    [params.scope],
  );
  const [username, setUsername] = useState("ada");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (allow: boolean) => {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(
        `${OAUTH_SERVER_URL}/oauth/authorize/consent`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            username,
            allow,
            client_id: params.clientId,
            redirect_uri: params.redirectUri,
            state: params.state,
            scope: params.scope,
          }),
        },
      );
      const data = await response.json();
      if (data.redirectTo) {
        window.location.assign(data.redirectTo);
        return;
      }
      setError(data.error_description ?? data.error ?? "Unexpected response.");
    } catch {
      setError("Could not reach the authorization server.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#F4F5F9",
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 460, width: "100%" }} elevation={3}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6" component="h1">
              Test OAuth — DEV login
            </Typography>
            <Alert severity="warning">
              Not a real login. This dev stub accepts any username, checks no password, and
              imitates no real service. Never enter real credentials.
            </Alert>

            <Typography variant="body2" color="text.secondary">
              Client <strong>{params.clientId || "(unknown)"}</strong> is requesting access.
            </Typography>

            {scopes.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Requested scopes
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap">
                  {scopes.map((scope) => (
                    <Chip key={scope} label={scope} size="small" />
                  ))}
                </Stack>
              </Box>
            )}

            <TextField
              label="Username (becomes the token subject)"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              fullWidth={true}
              autoFocus={true}
            />

            {error && <Alert severity="error">{error}</Alert>}

            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                color="inherit"
                onClick={() => submit(false)}
                disabled={submitting}
              >
                Deny
              </Button>
              <Button
                variant="contained"
                onClick={() => submit(true)}
                disabled={submitting || !username}
              >
                Allow
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
