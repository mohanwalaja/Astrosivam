import fs from 'fs';
import path from 'path';

export const EMBEDDED_LOGO_BASE64 = "data:image/png;base64,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";

let cachedLogoBase64 = '';
let cachedLogoPath = '';

const MODULE_DIR: string = typeof __dirname !== 'undefined' ? __dirname : '';

function logoCandidatePaths(): string[] {
  const cwdCandidates = [
    path.resolve(process.cwd(), 'api/assets/astrosivam_logo.png'),
    path.resolve(process.cwd(), 'public/astrosivam_logo.png'),
    path.resolve(process.cwd(), 'dist/astrosivam_logo.png'),
    path.resolve(process.cwd(), 'src/assets/astrosivam_logo.png'),
  ];

  if (!MODULE_DIR) {
    return cwdCandidates;
  }

  return [
    ...cwdCandidates,
    path.resolve(MODULE_DIR, '../../api/assets/astrosivam_logo.png'),
    path.resolve(MODULE_DIR, '../../public/astrosivam_logo.png'),
    path.resolve(MODULE_DIR, '../public/astrosivam_logo.png'),
  ];
}

export function getLogoFilePath(): string {
  if (cachedLogoPath) return cachedLogoPath;
  for (const p of logoCandidatePaths()) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).size > 0) {
        cachedLogoPath = p;
        return cachedLogoPath;
      }
    } catch (e) {
      // ignore unreadable candidate
    }
  }
  return '';
}

export function loadLogo(): string {
  if (cachedLogoBase64) return cachedLogoBase64;
  try {
    const p = getLogoFilePath();
    if (p) {
      const data = fs.readFileSync(p);
      const mime = p.endsWith('.png') ? 'image/png' : 'image/jpeg';
      cachedLogoBase64 = `data:${mime};base64,${data.toString('base64')}`;
      return cachedLogoBase64;
    }
  } catch (e) {
    // Return embedded fallback if running in environment without fs
  }
  return EMBEDDED_LOGO_BASE64;
}

export const ASTRO_LOGO_BASE64 = loadLogo();
export const ASTRO_SIVAM_LOGO_BASE64 = ASTRO_LOGO_BASE64 || EMBEDDED_LOGO_BASE64;

/** Content-ID used when the logo is embedded inline in outbound emails. */
export const ASTRO_LOGO_CID = 'astrosivamlogo';

/**
 * Raw logo bytes + the nodemailer attachment descriptor that embeds it inline,
 * so the brand mark is visible in Gmail/Outlook without 'display images'.
 */
export function getLogoEmailAttachment(): { filename: string; content: Buffer; contentType: string; cid: string; contentDisposition: string } | null {
  const p = getLogoFilePath();
  let content: Buffer | null = null;
  let contentType = 'image/png';

  if (p) {
    try {
      content = fs.readFileSync(p);
      contentType = p.endsWith('.png') ? 'image/png' : 'image/jpeg';
    } catch (e) {}
  }

  if (!content || !content.length) {
    try {
      const rawBase64 = EMBEDDED_LOGO_BASE64.replace(/^data:image\/[a-z]+;base64,/, '');
      content = Buffer.from(rawBase64, 'base64');
    } catch (e) {}
  }

  if (!content || !content.length) return null;

  return {
    filename: 'astrosivam_logo.png',
    content,
    contentType,
    cid: ASTRO_LOGO_CID,
    contentDisposition: 'inline'
  };
}

export default ASTRO_SIVAM_LOGO_BASE64;
