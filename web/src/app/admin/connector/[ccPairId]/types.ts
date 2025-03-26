import { Connector } from "@/lib/connectors/connectors";
import { Credential } from "@/lib/connectors/credentials";
import {
  DeletionAttemptSnapshot,
  IndexAttemptSnapshot,
  ValidStatuses,
  AccessType,
} from "@/lib/types";
import { UUID } from "crypto";

export enum ConnectorCredentialPairStatus {
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  DELETING = "DELETING",
  INVALID = "INVALID",
}

/**
 * Returns true if the status is not currently active (i.e. paused or invalid), but not deleting
 */
export function statusIsNotCurrentlyActive(
  status: ConnectorCredentialPairStatus
): boolean {
  return (
    status === ConnectorCredentialPairStatus.PAUSED ||
    status === ConnectorCredentialPairStatus.INVALID
  );
}

export interface CCPairFullInfo {
  id: number;
  name: string;
  status: ConnectorCredentialPairStatus;
  num_docs_indexed: number;
  connector: Connector<any>;
  credential: Credential<any>;
  number_of_index_attempts: number;
  last_index_attempt_status: ValidStatuses | null;
  latest_deletion_attempt: DeletionAttemptSnapshot | null;
  access_type: AccessType;
  is_editable_for_current_user: boolean;
  deletion_failure_message: string | null;
  indexing: boolean;
  creator: UUID | null;
  creator_email: string | null;
  last_time_perm_sync: string | null;
}

export interface PaginatedIndexAttempts {
  index_attempts: IndexAttemptSnapshot[];
  page: number;
  total_pages: number;
}

export interface IndexAttemptError {
  id: number;
  index_attempt_id: number;
  document_id: string;
  error_type: string;
  error_message: string;
  resolved: boolean;
  time_created: string;
  time_updated: string;
}

export interface PaginatedIndexAttemptErrors {
  items: IndexAttemptError[];
  total_items: number;
}

export interface SyncRecord {
  id: number;
  entity_id: number;
  sync_type: string;
  created_at: string;
  num_docs_synced: number;
  sync_status: ValidStatuses;
}
