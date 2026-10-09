# PDF delivery quality contract

Paid customers must receive only the report and invoice rendered from the same
browser HTML used by the approved preview. Email delivery does not substitute a
server-generated PDF when a browser render is missing, incomplete, or below the
minimum capture resolution.

## Customer approval and resend emails

- Single-order and family report/invoice PDFs are rendered from the shared
  report and invoice HTML builders with html2canvas + jsPDF.
- Desktop captures use 3× scale; phones and low-memory devices use 2.5×. Every
  A4 page must still be at least **1900 × 2800 pixels** (about 230–240 dpi) at
  JPEG quality 0.95. A capture that misses either dimension fails before
  upload/email; the email path never drops to the smaller download-only capture.
- Both PHP and Node email backends validate the PDF header and EOF marker,
  count its pages, and require one embedded raster of at least 1900 × 2800 pixels
  for every page. Missing, low-resolution, vector-only, truncated, or oversized
  documents are rejected before staging or mail dispatch.
- Every report and invoice must pass before approval/resend. If a capture or
  upload fails, the action returns an error and **no email is sent**.

The raster and page checks are a technical floor, not a replacement for visual
review. The browser tests also compare captured report text against preview
screenshots for English, Tamil, and Hindi.

## Server-side PDF exports

PHP server-side report and invoice exports use mPDF only. The former plain-PHP
writer (`AstroPdfReports` / `AstroPdfWriter`) has been removed. If mPDF is
missing or fails, the PHP endpoint returns an error and produces no substitute
PDF. Node's separate jsPDF renderer remains for direct server-side download
routes; it is not an email attachment fallback.

Deployments must install `mpdf/mpdf` under `public_html/vendor` before using
PHP server-side export endpoints. Customer email delivery continues to require
the validated browser-rendered documents described above.

## Verification

```bash
npm test
npm run lint
npm run build
npm run test:php # requires a PHP CLI; checks PHP PDF quality gates and fail-closed behavior
npm run test:pdf # browser capture / preview parity; requires Playwright Chromium
```
