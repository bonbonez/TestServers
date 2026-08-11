import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { useDeleteClientMutation } from "../../../api/queries";

interface DeleteClientDialogProps {
  clientId: string;
  onClose: () => void;
}

export function DeleteClientDialog({ clientId, onClose }: DeleteClientDialogProps) {
  const mutation = useDeleteClientMutation(onClose);

  return (
    <Dialog open={true} onClose={onClose} maxWidth="xs" fullWidth={true}>
      <DialogTitle>Delete client?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          The client <strong>{clientId}</strong> will be removed. Any integration using it
          will stop authenticating.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Cancel
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(clientId)}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}
