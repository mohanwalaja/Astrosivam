/**
 * html2canvas 1.4 measures a font's baseline in the calling document, even
 * when it is capturing an iframe. Its hidden probe is a div containing a span
 * and a 1px image; the image MUST stay inline for that measurement to work.
 *
 * Tailwind's preflight makes all images block-level. That moves the probe to
 * the next line, doubles the measured baseline and paints report text below
 * its line box. Muhurtham's clipped cells then lose the lower half of every
 * date, time and grade, although the real preview is perfectly legible.
 *
 * Reset ONLY the library's hidden font probes, ONLY while a capture runs.
 * Do not change report clipping or the display of any visible site images.
 */
export function installCanvasFontMetricsReset(doc: Document): () => void {
  const style = doc.createElement('style');
  style.setAttribute('data-astrosivam-capture', 'font-metrics');
  style.textContent = `
    body > div[style*="visibility: hidden"][style*="font-family:"][style*="white-space: nowrap"] > img {
      display: inline !important;
    }
  `;
  doc.head.appendChild(style);
  return () => style.remove();
}
