import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { SettingsForm } from "../../../components/SettingsForm";
import { useUpdateSettingsMutation } from "../../../api/queries";
import type { Settings } from "../../../api/types";

interface SettingsModalProps {
  open: boolean;
  settings: Settings;
  onClose: () => void;
}

export function SettingsModal({ open, settings, onClose }: SettingsModalProps) {
  const [draft, setDraft] = useState<Settings>(settings);
  const mutation = useUpdateSettingsMutation(onClose);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth={true}>
      <DialogTitle>Edit settings</DialogTitle>
      <DialogContent dividers={true}>
        <SettingsForm value={draft} onChange={setDraft} />
        {mutation.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Could not save changes.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(draft)}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
