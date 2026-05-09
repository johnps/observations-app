export interface PendingObservation {
  id: string;
  text: string;
  field_worker_name: string;
  village_name: string;
  block_lead_email: string;
  photo_uris: string[];
  gps_lat?: number;
  gps_lng?: number;
  submitted_at: string;
}

export interface FailedObservation {
  id: string;
  payload: string;    // JSON-serialized PendingObservation
  reason: string;
  failed_at: string;
}
