/**
 * ASTRO SIVAM — SMTP attachment budgeting.
 *
 * WHY THIS EXISTS: a family bundle is N * ~2 MB of preview-quality PDF plus the
 * consolidated invoice. The admin panel used to warn about the total size but
 * still tried to send everything in ONE message, so a large family order could
 * be rejected by the mail provider (usually with a generic SMTP error) and the
 * customer received nothing at all.
 *
 * POLICY: the server now enforces a hard, configurable per-message budget and
 * splits the bundle across several emails when it does not fit. A single PDF
 * larger than the whole budget cannot be split, so it is isolated into its own
 * message and reported back to the admin instead of silently failing.
 *
 * Budgets are compared against the *encoded* size because SMTP transports the
 * body as MIME base64, which inflates binary payloads by roughly 4/3.
 */
export interface BatchableAttachment {
  filename: string;
  content: Buffer | Uint8Array;
  contentType?: string;
}

export interface AttachmentBatchPlan<T extends BatchableAttachment> {
  /** Attachment groups; each group fits the configured encoded budget (unless it is a single oversize file). */
  batches: T[][];
  /** File names that alone exceed the budget — each one ships in its own message. */
  oversizeFiles: string[];
  /** Raw (un-encoded) byte total of every attachment. */
  totalBytes: number;
  /** Encoded (base64 + MIME headers) byte total of every attachment. */
  totalEncodedBytes: number;
  /** The budget each batch was planned against. */
  maxEncodedBytes: number;
}

/** Default per-message attachment budget: 18 MB encoded (~13.5 MB of PDFs). */
export const DEFAULT_MAX_ATTACHMENT_ENCODED_BYTES = 18 * 1024 * 1024;

const MIN_ENCODED_BUDGET = 512 * 1024;
const MAX_ENCODED_BUDGET = 200 * 1024 * 1024;

/**
 * Resolve the per-message attachment budget from the environment.
 *
 * FAMILY_EMAIL_MAX_ATTACHMENT_MB  preferred, in megabytes (1–200)
 * FAMILY_EMAIL_MAX_ATTACHMENT_BYTES  legacy/explicit byte override
 */
export function resolveMaxAttachmentEncodedBytes(env: NodeJS.ProcessEnv = process.env): number {
  const asMb = Number(env.FAMILY_EMAIL_MAX_ATTACHMENT_MB);
  if (Number.isFinite(asMb) && asMb >= 1 && asMb <= 200) {
    return Math.round(asMb * 1024 * 1024);
  }
  const asBytes = Number(env.FAMILY_EMAIL_MAX_ATTACHMENT_BYTES);
  if (Number.isFinite(asBytes) && asBytes >= MIN_ENCODED_BUDGET && asBytes <= MAX_ENCODED_BUDGET) {
    return Math.round(asBytes);
  }
  return DEFAULT_MAX_ATTACHMENT_ENCODED_BYTES;
}

/** MIME base64 expands binary data by 4/3; allow a small constant for headers. */
export function mimeEncodedSize(rawBytes: number): number {
  const safe = Math.max(0, Math.floor(Number(rawBytes) || 0));
  return Math.ceil((safe + 2) / 3) * 4 + 512;
}

function rawSizeOf(attachment: BatchableAttachment): number {
  const content: any = attachment?.content;
  if (!content) return 0;
  if (typeof content.length === 'number') return content.length;
  if (ArrayBuffer.isView(content)) return content.byteLength;
  return 0;
}

/**
 * Split attachments, in order, into the fewest messages that respect the
 * budget. Order is preserved (reports first, invoice last) so the invoice
 * always arrives with the final part of a multi-part delivery.
 */
export function planAttachmentBatches<T extends BatchableAttachment>(
  attachments: T[],
  maxEncodedBytes: number = DEFAULT_MAX_ATTACHMENT_ENCODED_BYTES
): AttachmentBatchPlan<T> {
  const budget = Number.isFinite(maxEncodedBytes) && maxEncodedBytes >= MIN_ENCODED_BUDGET
    ? Math.floor(maxEncodedBytes)
    : DEFAULT_MAX_ATTACHMENT_ENCODED_BYTES;

  const list = Array.isArray(attachments) ? attachments.filter(Boolean) : [];
  const batches: T[][] = [];
  const oversizeFiles: string[] = [];
  let current: T[] = [];
  let currentSize = 0;
  let totalBytes = 0;
  let totalEncodedBytes = 0;

  for (const attachment of list) {
    const rawBytes = rawSizeOf(attachment);
    const encodedBytes = mimeEncodedSize(rawBytes);
    totalBytes += rawBytes;
    totalEncodedBytes += encodedBytes;

    if (encodedBytes > budget) {
      // A single document bigger than the whole budget: flush the current
      // batch, ship this file alone, and flag it for the admin.
      if (current.length > 0) {
        batches.push(current);
        current = [];
        currentSize = 0;
      }
      oversizeFiles.push(attachment.filename || 'unnamed-attachment');
      batches.push([attachment]);
      continue;
    }

    if (current.length > 0 && currentSize + encodedBytes > budget) {
      batches.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(attachment);
    currentSize += encodedBytes;
  }

  if (current.length > 0) batches.push(current);

  return { batches, oversizeFiles, totalBytes, totalEncodedBytes, maxEncodedBytes: budget };
}
