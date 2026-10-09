# PDF delivery quality contract

Paid customers receive the report and invoice rendered from the same browser HTML used by the approved preview. The PHP API does not substitute a server-generated PDF when a browser render is missing, incomplete, or below the minimum capture resolution.

## Customer approval and resend emails

- Single-order and family report/invoice PDFs are rendered in the browser from the shared report and invoice HTML builders with `html2canvas` + `jsPDF`.
- Desktop captures use 3× scale; phones and low-memory devices use 2.5×. Every A4 page must still be at least **1900 × 2800 pixels** (about 230–240 dpi) at JPEG quality 0.95. A capture that misses either dimension fails before upload/email; the email path never falls back to the smaller download-only capture.
- The PHP API validates each uploaded PDF's header and EOF marker, page count, and embedded raster resolution before staging or mail dispatch. Missing, low-resolution, vector-only, truncated, or oversized documents are rejected.
- Every report and invoice must pass before approval/resend. If a capture or upload fails, the action returns an error and **no email is sent**.

The raster and page checks are a technical floor, not a replacement for visual review. The browser tests also compare captured report text against preview screenshots for English, Tamil, and Hindi.

## PHP server-side PDF exports

PHP server-side report and invoice exports use mPDF only. The former plain-PHP writer (`AstroPdfReports` / `AstroPdfWriter`) has been removed. If mPDF is missing or fails, the PHP endpoint returns an error and produces no substitute PDF. The separate jsPDF exporter is browser-side code; there is no Node.js PDF server or Node route in the production application.

Deployments must install `mpdf/mpdf` under `public_html/vendor` before using PHP server-side export endpoints. Customer email delivery continues to require the validated browser-rendered documents described above.

## Verification

```bash
npm test
npm run lint
npm run build
npm run test:php # requires a PHP CLI; checks PHP PDF quality gates and fail-closed behavior
npm run test:pdf # browser capture / preview parity; requires Playwright Chromium
```
