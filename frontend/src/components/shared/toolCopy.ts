/**
 * User-facing wording about where files go and how long results live.
 * ONE source of truth. Never write your own variant on a page, and never claim files
 * stay on the user's device: every tool uploads the file to our server.
 *
 * Facts (backend, FILE_EXPIRY_MINUTES=2): a result is kept for 2 minutes after it is
 * created and then deleted, whether or not it was downloaded. It can be downloaded
 * more than once inside those 2 minutes. `ResultCard` shows this as a live countdown.
 */

/** How long a result can be downloaded, in seconds. Must match the backend's FILE_EXPIRY_MINUTES. */
export const RESULT_LIFETIME_SECONDS = 120;

export const RETENTION_SHORT =
  'Your file is processed on our server and deleted automatically 2 minutes after it is ready.';

export const RETENTION_FULL =
  'Your file is uploaded to our server over a secure connection to be processed. ' +
  'The result is kept for only 2 minutes and then deleted automatically, so download it right away. ' +
  'You can download it again within those 2 minutes.';

/** Shown under the Download button on a result (next to the live countdown). */
export const RETENTION_RESULT =
  'For your privacy we keep files for only 2 minutes. You can download again until the timer runs out.';

/** Shown when the countdown reaches zero. */
export const RETENTION_EXPIRED =
  'This file has been deleted. We keep files for only 2 minutes. Process your file again to get a new download.';

export const TRUST_ITEMS = [
  { key: 'secure', label: 'Secure upload (HTTPS)' },
  { key: 'server', label: 'Processed on our server' },
  { key: 'delete', label: 'Deleted after 2 minutes' },
] as const;
