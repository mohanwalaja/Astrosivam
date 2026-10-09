<?php
/**
 * ASTRO SIVAM - Central Branding / Logo Resolution Helper
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The ASTRO SIVAM logo was previously referenced in three different, fragile
 * ways across the codebase:
 *
 *   1. A hard-coded remote URL  -> https://astrosivam.com/astrosivam_logo.png
 *      (emails: blocked by most mail clients by default / slow / fails when
 *       the host cannot reach itself, and mPDF then renders nothing.)
 *   2. A hard-coded filesystem path that only exists in the local repo
 *      (__DIR__ . '/../../public/...') which does NOT exist on cPanel, where
 *      the deployed layout is public_html/api/... and the logo sits in
 *      public_html/ root. Result: no logo in generated report PDFs.
 *   3. A raw absolute server path inside HTML that is also served to a browser
 *      (admin "preview HTML"), which a browser can never load.
 *
 * This helper resolves the logo ONCE, from a priority-ordered list of
 * candidate locations (including the copy bundled inside /api/assets, which is
 * always deployed together with the PHP API), and exposes it in the three
 * shapes the app needs: filesystem path (PDF engines), root-relative URL
 * (browser HTML/preview) and Content-ID tag (inline email image).
 */

if (!defined('ASTRO_LOGO_FILENAME')) {
    define('ASTRO_LOGO_FILENAME', 'astrosivam_logo.png');
}

/** Content-ID used to inline the logo inside outbound emails. */
if (!defined('ASTRO_LOGO_CID')) {
    define('ASTRO_LOGO_CID', 'astrosivamlogo');
}

if (!function_exists('astro_logo_candidates')) {
    /**
     * Priority-ordered list of every place the logo may live.
     * The first entry that exists wins.
     *
     * NOTE: __DIR__ here is the /api directory (this file lives at
     * /api/branding.php), so ".." always means "the site document root"
     * on cPanel (public_html) and the repo root in local development.
     */
    function astro_logo_candidates(): array
    {
        $name = ASTRO_LOGO_FILENAME;

        $candidates = [
            __DIR__ . '/assets/' . $name,            // bundled with the API (always deployed)
            __DIR__ . '/../' . $name,                // site root / public_html (vite build output)
            __DIR__ . '/../public/' . $name,         // repo public/ (local dev)
            __DIR__ . '/../dist/' . $name,           // repo dist/ (local dev build)
            __DIR__ . '/../src/assets/' . $name,     // repo source asset
            __DIR__ . '/../public_html/' . $name,    // alternate cPanel layout
        ];

        // Extra safety net: derive from DOCUMENT_ROOT when available.
        if (!empty($_SERVER['DOCUMENT_ROOT'])) {
            $docRoot = rtrim((string) $_SERVER['DOCUMENT_ROOT'], '/');
            $candidates[] = $docRoot . '/' . $name;
            $candidates[] = $docRoot . '/public/' . $name;
            $candidates[] = $docRoot . '/dist/' . $name;
        }

        return $candidates;
    }
}

if (!function_exists('astro_logo_path')) {
    /**
     * Absolute filesystem path to the logo, or '' when it cannot be located.
     * Used by mPDF / PDF writers, which cannot fetch remote images reliably.
     */
    function astro_logo_path(): string
    {
        static $cached = null;
        if ($cached !== null) {
            return $cached;
        }

        foreach (astro_logo_candidates() as $candidate) {
            $real = @realpath($candidate);
            if ($real && is_file($real) && @filesize($real) > 0) {
                $cached = $real;
                return $cached;
            }
        }

        $cached = '';
        return $cached;
    }
}

if (!function_exists('astro_site_base_path')) {
    /**
     * URL base path of the site: '' when installed at the domain root,
     * '/subdir' when installed in a sub-directory. Derived from the requested
     * script name so it stays correct on cPanel, sub-folders and local dev.
     */
    function astro_site_base_path(): string
    {
        $scriptName = (string) ($_SERVER['SCRIPT_NAME'] ?? '');
        $pos = strpos($scriptName, '/api/');
        if ($pos !== false) {
            return substr($scriptName, 0, $pos);
        }
        return '';
    }
}

if (!function_exists('astro_logo_url')) {
    /**
     * Root-relative URL for the logo, safe to emit inside HTML that is
     * rendered by a browser (admin preview) and later rewritten to a
     * filesystem path by the PDF converters.
     */
    function astro_logo_url(): string
    {
        return astro_site_base_path() . '/' . ASTRO_LOGO_FILENAME;
    }
}

if (!function_exists('astro_logo_absolute_url')) {
    /** Fully-qualified https://host/... URL for the logo (fallback use only). */
    function astro_logo_absolute_url(): string
    {
        $host = (string) ($_SERVER['HTTP_HOST'] ?? '');
        if ($host === '') {
            return 'https://astrosivam.com/' . ASTRO_LOGO_FILENAME;
        }
        $scheme = 'https';
        if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
            $scheme = 'https';
        } elseif (!empty($_SERVER['REQUEST_SCHEME'])) {
            $scheme = (string) $_SERVER['REQUEST_SCHEME'];
        }
        return $scheme . '://' . $host . astro_logo_url();
    }
}

if (!function_exists('astro_email_logo_tag')) {
    /**
     * <img> tag for outbound emails.
     *
     * The logo is attached to the message with Content-ID `astrosivamlogo`
     * (see astro_inline_logo_attachment()), so it renders immediately in
     * Gmail / Outlook / Apple Mail without the recipient having to click
     * "display images" - and it never depends on the public website being
     * reachable from the mail client.
     */
    function astro_email_logo_tag(int $size = 56, string $borderColor = '#c9962c'): string
    {
        return '<img src="cid:' . ASTRO_LOGO_CID . '" alt="ASTRO SIVAM" width="' . $size . '" height="' . $size . '" '
            . 'style="width:' . $size . 'px; height:' . $size . 'px; border-radius:50%; border:1.5px solid ' . $borderColor . '; display:block; margin:0 auto 10px;" />';
    }
}

if (!function_exists('astro_inline_logo_attachment')) {
    /**
     * Inline (Content-ID) attachment descriptor for AstroMailer.
     * Returns an empty array when the logo file cannot be found, in which
     * case the mailer simply omits the inline image.
     */
    function astro_inline_logo_attachment(): array
    {
        static $cached = null;
        if ($cached !== null) {
            return $cached;
        }

        $path = astro_logo_path();
        if ($path === '') {
            $cached = [];
            return $cached;
        }

        $binary = @file_get_contents($path);
        if ($binary === false || $binary === '') {
            $cached = [];
            return $cached;
        }

        $cached = [[
            'cid' => ASTRO_LOGO_CID,
            'name' => ASTRO_LOGO_FILENAME,
            'mime' => 'image/png',
            'content' => $binary,
        ]];

        return $cached;
    }
}
