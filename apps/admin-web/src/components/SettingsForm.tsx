import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { Settings } from "../api/types";
import { randomToken } from "../lib/generate";

interface SettingsFormProps {
  value: Settings;
  onChange: (next: Settings) => void;
}

export function SettingsForm({ value, onChange }: SettingsFormProps) {
  const set = <K extends keyof Settings>(key: K, next: Settings[K]) => {
    onChange({ ...value, [key]: next });
  };

  const number = (raw: string, fallback: number) => {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const regenerateAdornment = (key: keyof Settings, prefix: string) => (
    <InputAdornment position="end">
      <Button size="small" onClick={() => set(key, randomToken(prefix) as never)}>
        Regenerate
      </Button>
    </InputAdornment>
  );

  return (
    <Stack spacing={2.5}>
      <Typography variant="subtitle2" color="text.secondary">
        MCP server
      </Typography>
      <TextField
        label="MCP bearer token"
        value={value.mcpBearerToken}
        onChange={(event) => set("mcpBearerToken", event.target.value)}
        fullWidth={true}
        InputProps={{ endAdornment: regenerateAdornment("mcpBearerToken", "dev-mcp-bearer") }}
      />
      <Stack direction="row" spacing={2}>
        <TextField
          label="Access token audience"
          value={value.accessTokenAudience}
          onChange={(event) => set("accessTokenAudience", event.target.value)}
          fullWidth={true}
        />
        <TextField
          label="Required scope"
          value={value.requiredScope}
          onChange={(event) => set("requiredScope", event.target.value)}
          fullWidth={true}
          helperText="Empty disables the scope check"
        />
      </Stack>

      <Typography variant="subtitle2" color="text.secondary">
        Token lifetimes (seconds)
      </Typography>
      <Stack direction="row" spacing={2}>
        <TextField
          label="Access token TTL"
          type="number"
          value={value.accessTokenTtlSeconds}
          onChange={(event) =>
            set("accessTokenTtlSeconds", number(event.target.value, value.accessTokenTtlSeconds))
          }
          fullWidth={true}
        />
        <TextField
          label="Refresh token TTL"
          type="number"
          value={value.refreshTokenTtlSeconds}
          onChange={(event) =>
            set("refreshTokenTtlSeconds", number(event.target.value, value.refreshTokenTtlSeconds))
          }
          fullWidth={true}
        />
        <TextField
          label="Auth code TTL"
          type="number"
          value={value.authCodeTtlSeconds}
          onChange={(event) =>
            set("authCodeTtlSeconds", number(event.target.value, value.authCodeTtlSeconds))
          }
          fullWidth={true}
        />
      </Stack>

      <Typography variant="subtitle2" color="text.secondary">
        Authorization-code flow
      </Typography>
      <TextField
        label="Allowed redirect URIs (one per line)"
        value={value.allowedRedirectUris.join("\n")}
        onChange={(event) =>
          set(
            "allowedRedirectUris",
            event.target.value.split("\n").map((line) => line.trim()).filter(Boolean),
          )
        }
        fullWidth={true}
        multiline={true}
        minRows={3}
        sx={{ "& textarea": { resize: "vertical" } }}
      />

      <Typography variant="subtitle2" color="text.secondary">
        Protected resource API credentials
      </Typography>
      <TextField
        label="Static bearer token"
        value={value.apiStaticBearer}
        onChange={(event) => set("apiStaticBearer", event.target.value)}
        fullWidth={true}
        InputProps={{ endAdornment: regenerateAdornment("apiStaticBearer", "dev-api-static") }}
      />
      <Stack direction="row" spacing={2}>
        <TextField
          label="Basic auth user"
          value={value.apiBasicUser}
          onChange={(event) => set("apiBasicUser", event.target.value)}
          fullWidth={true}
        />
        <TextField
          label="Basic auth password"
          value={value.apiBasicPass}
          onChange={(event) => set("apiBasicPass", event.target.value)}
          fullWidth={true}
          InputProps={{ endAdornment: regenerateAdornment("apiBasicPass", "dev-api-pass") }}
        />
      </Stack>
    </Stack>
  );
}
