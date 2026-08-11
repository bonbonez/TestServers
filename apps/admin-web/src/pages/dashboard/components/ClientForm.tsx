import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import FormLabel from "@mui/material/FormLabel";
import InputAdornment from "@mui/material/InputAdornment";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import type { Grant, OAuthClient } from "../../../api/types";
import { randomToken } from "../../../lib/generate";

interface ClientFormProps {
  value: OAuthClient;
  onChange: (next: OAuthClient) => void;
  lockId: boolean;
}

const GRANT_OPTIONS: Array<{ id: Grant; label: string }> = [
  { id: "authorization_code", label: "authorization_code" },
  { id: "client_credentials", label: "client_credentials" },
  { id: "refresh_token", label: "refresh_token" },
];

export function ClientForm({ value, onChange, lockId }: ClientFormProps) {
  const toggleGrant = (grant: Grant, checked: boolean) => {
    const grants = checked
      ? [...value.grants, grant]
      : value.grants.filter((existing) => existing !== grant);
    onChange({ ...value, grants });
  };

  return (
    <Stack spacing={2.5} sx={{ pt: 1 }}>
      <TextField
        label="Client ID *"
        value={value.clientId}
        onChange={(event) => onChange({ ...value, clientId: event.target.value })}
        fullWidth={true}
        disabled={lockId}
      />
      <TextField
        label="Client secret *"
        value={value.clientSecret}
        onChange={(event) => onChange({ ...value, clientSecret: event.target.value })}
        fullWidth={true}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <Button
                size="small"
                onClick={() =>
                  onChange({ ...value, clientSecret: randomToken("dev-secret") })
                }
              >
                Regenerate
              </Button>
            </InputAdornment>
          ),
        }}
      />
      <div>
        <FormLabel component="legend">Grants *</FormLabel>
        <FormGroup>
          {GRANT_OPTIONS.map((option) => (
            <FormControlLabel
              key={option.id}
              control={
                <Checkbox
                  checked={value.grants.includes(option.id)}
                  onChange={(event) => toggleGrant(option.id, event.target.checked)}
                />
              }
              label={option.label}
            />
          ))}
        </FormGroup>
      </div>
      <TextField
        label="Notes"
        value={value.notes}
        onChange={(event) => onChange({ ...value, notes: event.target.value })}
        fullWidth={true}
        multiline={true}
        minRows={2}
        sx={{ "& textarea": { resize: "vertical" } }}
      />
    </Stack>
  );
}
