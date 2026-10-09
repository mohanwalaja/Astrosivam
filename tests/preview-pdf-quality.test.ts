import assert from 'node:assert/strict';
import {
  decodePdfPayload,
  isHighQualityPreviewPdf,
  MIN_PREVIEW_PAGE_HEIGHT_PX,
  MIN_PREVIEW_PAGE_WIDTH_PX
} from '../server/services/stagedDocs.js';

function previewPdf(
  pageCount: number,
  imageDimensions: Array<{ width: number; height: number }>,
  includeEof = true
): Buffer {
  let pdf = '%PDF-1.7\n';
  const pageIds = Array.from({ length: pageCount }, (_, index) => 3 + index * 2);
  pdf += `1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n`;
  pdf += `2 0 obj << /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageCount} >> endobj\n`;

  for (let index = 0; index < pageCount; index++) {
    const pageId = pageIds[index];
    const imageId = pageId + 1;
    const image = imageDimensions[index];
    const imageResources = image ? `/Resources << /XObject << /Im${index} ${imageId} 0 R >> >>` : '';
    pdf += `${pageId} 0 obj << /Type /Page /Parent 2 0 R ${imageResources} >> endobj\n`;
    if (image) {
      const stream = 'A'.repeat(1024);
      pdf += `${imageId} 0 obj << /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`;
    }
  }

  return Buffer.from(pdf + (includeEof ? '%%EOF\n' : ''), 'latin1');
}

const good = previewPdf(1, [{ width: 1985, height: 2808 }]);
assert.equal(MIN_PREVIEW_PAGE_WIDTH_PX, 1900);
assert.equal(MIN_PREVIEW_PAGE_HEIGHT_PX, 2800);
assert.equal(isHighQualityPreviewPdf(good), true, 'a print-density A4 browser capture passes');
assert.deepEqual(decodePdfPayload(good.toString('base64')), good);
assert.deepEqual(decodePdfPayload(`data:application/pdf;base64,${good.toString('base64')}`), good);
console.log('  [PASS] High-resolution A4 browser-rendered PDFs are accepted');

const lowResolution = previewPdf(1, [{ width: 1800, height: 2700 }]);
assert.equal(isHighQualityPreviewPdf(lowResolution), false);
assert.equal(decodePdfPayload(lowResolution.toString('base64')), null);
console.log('  [PASS] Low-resolution PDFs are rejected before staging or email');

const missingPageImage = previewPdf(1, []);
assert.equal(isHighQualityPreviewPdf(missingPageImage), false);
console.log('  [PASS] Vector-only or image-missing PDFs cannot pass the email quality gate');

const oneLowResolutionPage = previewPdf(2, [
  { width: 1985, height: 2808 },
  { width: 1985, height: 2700 }
]);
assert.equal(isHighQualityPreviewPdf(oneLowResolutionPage), false);
console.log('  [PASS] Every page in a multi-page PDF must meet the resolution minimum');

const completeTwoPageCapture = previewPdf(2, [
  { width: 2382, height: 3369 },
  { width: 1985, height: 2808 }
]);
assert.equal(isHighQualityPreviewPdf(completeTwoPageCapture), true);
console.log('  [PASS] Multi-page PDFs pass only when every page carries a high-resolution raster');

const truncated = previewPdf(1, [{ width: 1985, height: 2808 }], false);
assert.equal(isHighQualityPreviewPdf(truncated), false);
assert.equal(decodePdfPayload(truncated.toString('base64')), null);
console.log('  [PASS] Truncated PDFs without an EOF marker fail closed');

console.log('\nPreview PDF quality checks passed.');
