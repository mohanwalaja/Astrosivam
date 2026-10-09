import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * ASTRO SIVAM - staged "preview-exact" documents (Node backend).
 *
 * The admin panel renders reports and invoices in the browser with the same
 * high-resolution html2canvas + jsPDF pipeline as the live preview. A family
 * bundle of N devotees cannot reliably travel inside ONE JSON body, so each
 * document is staged separately; approval fails closed if any upload is missing.
 *
 * So every document is uploaded with its OWN request and staged on disk; the
 * approve / resend handlers then attach exactly those files to the single
 * consolidated email. This mirrors api/admin/family_docs.php (the cPanel PHP
 * backend) one-for-one.
 */

export interface StagedDocInput {
  kind?: 'report' | 'invoice' | string;
  orderId?: string;
  order_id?: string;
  orderNumber?: string;
  order_number?: string;
  fileName?: string;
  file_name?: string;
  pdfBase64?: string;
  pdf_base64?: string;
}

export interface StagedReport {
  orderId: string;
  orderNumber: string;
  fileName: string;
  content: Buffer;
}

export interface StagedInvoice {
  fileName: string;
  content: Buffer;
}

export interface StagedDocs {
  reports: StagedReport[];
  invoice: StagedInvoice | null;
}

export interface StageResult {
  success: boolean;
  message: string;
  staged?: boolean;
  docKey?: string;
  kind?: string;
  fileName?: string;
  sizeBytes?: number;
  stagedReports?: number;
  stagedInvoice?: boolean;
}

/** 40 MB per document - far above a 2 MB scale-2.5 render, small enough to be safe. */
export const MAX_DOC_BYTES = 40 * 1024 * 1024;
/** Every emailed A4 page must be a full-density browser preview raster. */
export const MIN_PREVIEW_PAGE_WIDTH_PX = 1900;
export const MIN_PREVIEW_PAGE_HEIGHT_PX = 2800;
/** Staged documents only need to survive the approve → email round trip. */
export const DOC_TTL_MS = 6 * 60 * 60 * 1000;

export function sanitizeDocKey(value: unknown): string {
  return String(value ?? '')
    .replace(/[^A-Za-z0-9_\-.]/g, '_')
    .replace(/^[_\-.]+|[_\-.]+$/g, '')
    .slice(0, 80);
}

export function stagingRoot(): string {
  const configuredDataDir = process.env.ASTROSIVAM_DATA_DIR?.trim();
  const persistentRoot = configuredDataDir
    ? path.join(path.resolve(configuredDataDir), 'family_docs')
    : path.join(process.cwd(), 'data', 'family_docs');
  const candidates = [persistentRoot, path.join(os.tmpdir(), 'astrosivam_family_docs')];
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      fs.chmodSync(dir, 0o700);
      const probe = path.join(dir, `.write_probe_${process.pid}`);
      fs.writeFileSync(probe, 'ok', { mode: 0o600 });
      fs.unlinkSync(probe);
      return dir;
    } catch {
      /* try the next candidate */
    }
  }
  // Never use the shared temp root itself: pruning under it could delete files
  // owned by unrelated processes. Returning this isolated path lets writes fail
  // safely if neither candidate is actually available.
  return path.join(os.tmpdir(), 'astrosivam_family_docs');
}

function scopeDir(scope: string, create = true): string {
  const key = sanitizeDocKey(scope) || 'unknown';
  const dir = path.join(stagingRoot(), key);
  // Read paths must not resurrect a directory that was just cleaned up.
  if (create) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.chmodSync(dir, 0o700);
  }
  return dir;
}

interface ManifestEntry {
  kind: string;
  orderId: string;
  orderNumber: string;
  fileName: string;
  sizeBytes: number;
  stagedAt: string;
}

function manifestPath(scope: string, create = true): string {
  return path.join(scopeDir(scope, create), 'manifest.json');
}

function readManifest(scope: string): Record<string, ManifestEntry> {
  try {
    const raw = fs.readFileSync(manifestPath(scope, false), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeManifest(scope: string, manifest: Record<string, ManifestEntry>): void {
  const target = manifestPath(scope);
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 0), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, target);
  fs.chmodSync(target, 0o600);
}

/** Drop staged document sets older than the TTL (abandoned admin sessions). */
export function pruneStaleDocs(maxAgeMs: number = DOC_TTL_MS): number {
  let removed = 0;
  const root = stagingRoot();
  let scopes: string[] = [];
  try {
    scopes = fs.readdirSync(root, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
  } catch {
    return 0;
  }
  const cutoff = Date.now() - maxAgeMs;
  for (const scope of scopes) {
    const dir = path.join(root, scope);
    let newest = 0;
    try {
      for (const file of fs.readdirSync(dir)) {
        try {
          const mtime = fs.statSync(path.join(dir, file)).mtimeMs;
          if (mtime > newest) newest = mtime;
        } catch {
          /* ignore */
        }
      }
    } catch {
      continue;
    }
    if (newest > 0 && newest < cutoff) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        removed++;
      } catch {
        /* ignore */
      }
    }
  }
  return removed;
}

/**
 * Validate the high-resolution browser-rendered PDF contract used for email.
 * Each PDF page must have exactly one embedded A4 raster of at least
 * 1900 × 2800 px; low-resolution, vector-only, malformed or truncated files
 * fail closed instead of being attached to a customer email.
 */
export function isHighQualityPreviewPdf(buffer: Buffer): boolean {
  if (!Buffer.isBuffer(buffer) || buffer.length <= 512 || buffer.length > MAX_DOC_BYTES) return false;
  const pdf = buffer.toString('latin1');
  if (!pdf.slice(0, 1024).includes('%PDF-') || !pdf.slice(-2048).includes('%%EOF')) return false;

  const pages = [...pdf.matchAll(/\/Type\s*\/Page\b/g)].length;
  if (pages < 1 || pages > 100) return false;

  const imagePattern = /\/Subtype\s*\/Image\b/g;
  let imageCount = 0;
  let match: RegExpExecArray | null;
  while ((match = imagePattern.exec(pdf)) !== null) {
    const objectEnd = pdf.indexOf('endobj', match.index);
    if (objectEnd < 0) return false;
    const streamStart = pdf.indexOf('stream', match.index);
    const dictionaryEnd = streamStart >= 0 && streamStart < objectEnd ? streamStart : objectEnd;
    const dictionary = pdf.slice(match.index, dictionaryEnd);
    const width = dictionary.match(/\/Width\s+(\d+)\b/);
    const height = dictionary.match(/\/Height\s+(\d+)\b/);
    if (
      !width || !height ||
      Number(width[1]) < MIN_PREVIEW_PAGE_WIDTH_PX ||
      Number(height[1]) < MIN_PREVIEW_PAGE_HEIGHT_PX
    ) return false;

    imageCount++;
    if (imageCount > pages) return false;
    imagePattern.lastIndex = objectEnd + 'endobj'.length;
  }

  return imageCount === pages;
}

/** Decode + enforce minimum print density for a base64 PDF payload. */
export function decodePdfPayload(pdfBase64: unknown): Buffer | null {
  if (!pdfBase64 || typeof pdfBase64 !== 'string') return null;
  let value = pdfBase64;
  const commaIdx = value.slice(0, 64).toLowerCase().indexOf('base64,');
  if (commaIdx !== -1) {
    value = value.slice(value.indexOf(',') + 1);
  }
  value = value.replace(/\s+/g, '');
  let buf: Buffer;
  try {
    buf = Buffer.from(value, 'base64');
  } catch {
    return null;
  }
  return isHighQualityPreviewPdf(buf) ? buf : null;
}

/**
 * Store ONE preview-rendered document (a member report, or the consolidated
 * family invoice) for the given scope (family group id, or `order_<id>`).
 */
export function stageDoc(scope: string, body: StagedDocInput): StageResult {
  const cleanScope = sanitizeDocKey(scope);
  if (!cleanScope) {
    return { success: false, message: 'Missing family group id / order id.' };
  }

  pruneStaleDocs();

  const rawKind = String(body.kind ?? 'report').toLowerCase().trim();
  const kind = rawKind === 'invoice' ? 'invoice' : 'report';
  const orderId = sanitizeDocKey(body.orderId ?? body.order_id);
  const orderNumber = sanitizeDocKey(body.orderNumber ?? body.order_number);

  if (kind === 'report' && !orderId && !orderNumber) {
    return { success: false, message: 'A staged report needs orderId or orderNumber.' };
  }

  const buffer = decodePdfPayload(body.pdfBase64 ?? body.pdf_base64);
  if (!buffer) {
    return {
      success: false,
      message: `The uploaded document is invalid, below the required ${MIN_PREVIEW_PAGE_WIDTH_PX} × ${MIN_PREVIEW_PAGE_HEIGHT_PX}px per-page preview resolution, or exceeds the ${Math.round(
        MAX_DOC_BYTES / 1048576
      )} MB per-document limit.`
    };
  }

  const docKey = kind === 'invoice' ? 'invoice' : `report__${orderId || `num_${orderNumber}`}`;
  const dir = scopeDir(cleanScope);
  const target = path.join(dir, `${docKey}.pdf`);

  try {
    fs.writeFileSync(target, buffer, { mode: 0o600 });
  } catch (err: any) {
    return {
      success: false,
      message: `Server staging area is not writable: ${err?.message || 'unknown error'}`
    };
  }

  let fileName = String(body.fileName ?? body.file_name ?? '').trim();
  if (!fileName) {
    fileName = kind === 'invoice'
      ? `ASTRO_SIVAM_Family_Invoice_${cleanScope}.pdf`
      : `ASTRO_SIVAM_Report_${orderNumber}.pdf`;
  }
  fileName = fileName.replace(/[^A-Za-z0-9_\-.() ]/g, '_').slice(0, 150);
  if (!/\.pdf$/i.test(fileName)) fileName += '.pdf';

  const manifest = readManifest(cleanScope);
  manifest[docKey] = {
    kind,
    orderId,
    orderNumber,
    fileName,
    sizeBytes: buffer.length,
    stagedAt: new Date().toISOString()
  };
  writeManifest(cleanScope, manifest);

  const entries = Object.values(manifest);
  const stagedReports = entries.filter(e => e.kind !== 'invoice').length;
  const stagedInvoice = entries.some(e => e.kind === 'invoice');

  return {
    success: true,
    staged: true,
    docKey,
    kind,
    fileName,
    sizeBytes: buffer.length,
    stagedReports,
    stagedInvoice,
    message: `Preview-quality ${kind} staged for ${cleanScope} (${stagedReports} report(s)${
      stagedInvoice ? ' + invoice' : ''
    }).`
  };
}

/** Read every staged document for a scope back into memory. */
export function loadStagedDocs(scope: string): StagedDocs {
  const cleanScope = sanitizeDocKey(scope);
  if (!cleanScope) return { reports: [], invoice: null };

  const manifest = readManifest(cleanScope);
  const keys = Object.keys(manifest);
  if (keys.length === 0) return { reports: [], invoice: null };

  const dir = scopeDir(cleanScope, false);
  const reports: StagedReport[] = [];
  let invoice: StagedInvoice | null = null;

  for (const key of keys) {
    const entry = manifest[key];
    const file = path.join(dir, `${sanitizeDocKey(key)}.pdf`);
    let content: Buffer;
    try {
      content = fs.readFileSync(file);
    } catch {
      continue;
    }
    if (!isHighQualityPreviewPdf(content)) {
      continue;
    }
    if (entry.kind === 'invoice') {
      invoice = { fileName: entry.fileName, content };
    } else {
      reports.push({
        orderId: entry.orderId,
        orderNumber: entry.orderNumber,
        fileName: entry.fileName,
        content
      });
    }
  }

  return { reports, invoice };
}

/** Delete every staged document for a scope (called once the email is sent). */
export function clearStagedDocs(scope: string): number {
  const cleanScope = sanitizeDocKey(scope);
  if (!cleanScope) return 0;
  try {
    const dir = path.join(stagingRoot(), cleanScope);
    const count = fs.existsSync(dir) ? fs.readdirSync(dir).length : 0;
    fs.rmSync(dir, { recursive: true, force: true });
    return count;
  } catch {
    return 0;
  }
}
