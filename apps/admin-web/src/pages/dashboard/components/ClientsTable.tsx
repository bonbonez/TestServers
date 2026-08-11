import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { CopyButton } from "../../../components/CopyButton";
import { IconEdit16, IconPlus16, IconTrash16 } from "../../../icons";
import { useLocalStorage } from "../../../hooks/useLocalStorage";
import { ClientModal } from "./ClientModal";
import { DeleteClientDialog } from "./DeleteClientDialog";
import type { OAuthClient } from "../../../api/types";

interface ClientsTableProps {
  clients: Array<OAuthClient>;
}

type SortColumn = "clientId" | "notes";

interface SortState {
  column: SortColumn;
  direction: "asc" | "desc";
}

export function ClientsTable({ clients }: ClientsTableProps) {
  const [sort, setSort] = useLocalStorage<SortState>("admin.clients.sort", {
    column: "clientId",
    direction: "asc",
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalClient, setModalClient] = useState<OAuthClient | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sorted = [...clients].sort((a, b) => {
    const compared = a[sort.column].localeCompare(b[sort.column]);
    return sort.direction === "asc" ? compared : -compared;
  });

  const toggleSort = (column: SortColumn) => {
    const direction =
      sort.column === column && sort.direction === "asc" ? "desc" : "asc";
    setSort({ column, direction });
  };

  const openAdd = () => {
    setModalClient(null);
    setModalOpen(true);
  };

  const openEdit = (client: OAuthClient) => {
    setModalClient(client);
    setModalOpen(true);
  };

  return (
    <Card variant="outlined">
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 2,
        }}
      >
        <Typography variant="h6">OAuth clients</Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<IconPlus16 />}
          onClick={openAdd}
        >
          Add client
        </Button>
      </Box>
      <TableContainer sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sortDirection={sort.column === "clientId" ? sort.direction : false}>
                <TableSortLabel
                  active={sort.column === "clientId"}
                  direction={sort.column === "clientId" ? sort.direction : "asc"}
                  onClick={() => toggleSort("clientId")}
                >
                  Client ID
                </TableSortLabel>
              </TableCell>
              <TableCell>Secret</TableCell>
              <TableCell>Grants</TableCell>
              <TableCell sortDirection={sort.column === "notes" ? sort.direction : false}>
                <TableSortLabel
                  active={sort.column === "notes"}
                  direction={sort.column === "notes" ? sort.direction : "asc"}
                  onClick={() => toggleSort("notes")}
                >
                  Notes
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((client) => (
              <TableRow key={client.clientId} hover={true}>
                <TableCell sx={{ fontFamily: "monospace", whiteSpace: "nowrap" }}>
                  {client.clientId}
                  <CopyButton value={client.clientId} />
                </TableCell>
                <TableCell sx={{ fontFamily: "monospace", whiteSpace: "nowrap" }}>
                  {client.clientSecret}
                  <CopyButton value={client.clientSecret} />
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap={true}>
                    {client.grants.map((grant) => (
                      <Chip key={grant} label={grant} size="small" />
                    ))}
                  </Stack>
                </TableCell>
                <TableCell
                  sx={{
                    maxWidth: 220,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {client.notes}
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => openEdit(client)}>
                      <IconEdit16 />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" onClick={() => setDeletingId(client.clientId)}>
                      <IconTrash16 />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {modalOpen && (
        <ClientModal
          key={modalClient?.clientId ?? "__new__"}
          client={modalClient}
          onClose={() => setModalOpen(false)}
        />
      )}
      {deletingId && (
        <DeleteClientDialog
          clientId={deletingId}
          onClose={() => setDeletingId(null)}
        />
      )}
    </Card>
  );
}
