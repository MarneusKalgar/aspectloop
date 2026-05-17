import { Button, Table, TableBody, TableCell, TableRow } from '@mui/material';

import type { CorrectionSessionListItem } from '../types';

import { SessionStatusChip } from '../SessionStatusChip';
import {
  CorrectionSessionsHeaderCell,
  CorrectionSessionsTableHead,
  CorrectionSessionsTableRoot,
} from './CorrectionSessionsTable.style';

interface CorrectionSessionsTableProps {
  documentIdLabel: string;
  documentTypeLabel: string;
  openSessionLabel: string;
  sessions: CorrectionSessionListItem[];
  statusLabel: string;
  updatedAtLabel: string;
  versionLabel: string;
}

export function CorrectionSessionsTable({
  documentIdLabel,
  documentTypeLabel,
  openSessionLabel,
  sessions,
  statusLabel,
  updatedAtLabel,
  versionLabel,
}: CorrectionSessionsTableProps) {
  return (
    <CorrectionSessionsTableRoot variant="outlined">
      <Table>
        <CorrectionSessionsTableHead>
          <TableRow>
            <CorrectionSessionsHeaderCell>{documentIdLabel}</CorrectionSessionsHeaderCell>
            <CorrectionSessionsHeaderCell>{documentTypeLabel}</CorrectionSessionsHeaderCell>
            <CorrectionSessionsHeaderCell>{statusLabel}</CorrectionSessionsHeaderCell>
            <CorrectionSessionsHeaderCell>{versionLabel}</CorrectionSessionsHeaderCell>
            <CorrectionSessionsHeaderCell>{updatedAtLabel}</CorrectionSessionsHeaderCell>
            <CorrectionSessionsHeaderCell align="right">&nbsp;</CorrectionSessionsHeaderCell>
          </TableRow>
        </CorrectionSessionsTableHead>
        <TableBody>
          {sessions.map((session) => (
            <TableRow hover key={session.id}>
              <TableCell>{session.documentId}</TableCell>
              <TableCell>{session.documentType}</TableCell>
              <TableCell>
                <SessionStatusChip status={session.status} />
              </TableCell>
              <TableCell>{session.version}</TableCell>
              <TableCell>{formatUpdatedAt(session.updatedAt)}</TableCell>
              <TableCell align="right">
                <Button disabled variant="text">
                  {openSessionLabel}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CorrectionSessionsTableRoot>
  );
}

function formatUpdatedAt(value: string) {
  return new Date(value).toLocaleString();
}
