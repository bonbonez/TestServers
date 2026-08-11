import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { ClientForm } from "./ClientForm";
import { useSaveClientMutation } from "../../../api/queries";
import type { OAuthClient } from "../../../api/types";

interface ClientModalProps {
  client: OAuthClient | null;
  onClose: () => void;
}

const BLANK_CLIENT: OAuthClient = {
  clientId: "",
  clientSecret: "",
  grants: [],
  notes: "",
};

export function ClientModal({ client, onClose }: ClientModalProps) {
  const [draft, setDraft] = useState<OAuthClient>(client ?? BLANK_CLIENT);
  const mutation = useSaveClientMutation(onClose);

  const isValid =
    draft.clientId.trim() !== "" &&
    draft.clientSecret.trim() !== "" &&
    draft.grants.length > 0;

  return (
    <Dialog open={true} onClose={onClose} maxWidth="sm" fullWidth={true}>
      <DialogTitle>{client ? "Edit client" : "Add client"}</DialogTitle>
      <DialogContent dividers={true}>
        <ClientForm value={draft} onChange={setDraft} lockId={false} />
        {mutation.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Could not save the client. The client ID may already exist.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!isValid || mutation.isPending}
          onClick={() =>
            mutation.mutate({ client: draft, originalId: client?.clientId })
          }
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
