import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import { CopyButton } from "./CopyButton";

interface CopyFieldProps {
  label: string;
  value: string;
  multiline?: boolean;
}

export function CopyField({ label, value, multiline }: CopyFieldProps) {
  return (
    <TextField
      label={label}
      value={value}
      fullWidth={true}
      size="small"
      multiline={multiline ?? false}
      InputProps={{
        readOnly: true,
        endAdornment: (
          <InputAdornment position="end" sx={{ alignSelf: "flex-start", mt: 1 }}>
            <CopyButton value={value} />
          </InputAdornment>
        ),
      }}
      sx={{ "& textarea": { resize: "vertical" } }}
    />
  );
}
