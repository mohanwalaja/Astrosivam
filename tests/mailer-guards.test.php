<?php
/**
 * ASTRO SIVAM — PHP mailer guard regressions.
 *
 * Runs with plain `php tests/mailer-guards.test.php` (no SMTP, no database, no
 * network) and is executed by CI (`npm run test:php`).
 *
 * Every case here asserts a guard that runs BEFORE the transport is touched, so
 * a failure is always safe: the message is refused instead of half-sent.
 */

// The mailer resolves branding/config values lazily; pin the signing key so no
// environment-specific behaviour leaks into the assertions.
putenv('APP_SECRET_KEY=test-only-app-secret-key-0123456789abcdef');

require_once __DIR__ . '/../api/mailer.php';

function checkMailer($condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
    echo "[PASS] " . $message . "\n";
}

// ---------------------------------------------------------------------------
// 1. Header injection cannot reach the MIME headers
// ---------------------------------------------------------------------------
$safeConfig = [
    'senderEmail' => 'admin@astrosivam.com',
    'replyToEmail' => 'admin@astrosivam.com'
];

$injectedRecipient = AstroMailer::sendEmailWithAttachments(
    "victim@example.com\r\nBcc: attacker@evil.example",
    'Victim',
    'Subject',
    '<p>hello</p>',
    [],
    $safeConfig
);
checkMailer($injectedRecipient['success'] === false, 'A recipient containing CRLF is refused before any transport is used');
checkMailer(strpos((string)$injectedRecipient['message'], 'Invalid recipient or sender email address') !== false, 'The refusal explains that an address is invalid');

$injectedReplyTo = AstroMailer::sendEmailWithAttachments(
    'victim@example.com',
    'Victim',
    'Subject',
    '<p>hello</p>',
    [],
    ['senderEmail' => 'admin@astrosivam.com', 'replyToEmail' => "reply@astrosivam.com\r\nBcc: attacker@evil.example"]
);
checkMailer($injectedReplyTo['success'] === false, 'A Reply-To containing CRLF is refused');

$injectedSender = AstroMailer::sendEmailWithAttachments(
    'victim@example.com',
    'Victim',
    'Subject',
    '<p>hello</p>',
    [],
    ['senderEmail' => "attacker@evil.example\r\nBcc: another@evil.example"]
);
checkMailer($injectedSender['success'] === false, 'A sender address containing CRLF is refused');

checkMailer(filter_var("a@b.co\r\nBcc: x@y.example", FILTER_VALIDATE_EMAIL) === false, 'FILTER_VALIDATE_EMAIL rejects the CRLF form used above (the guard is not vacuous)');

// ---------------------------------------------------------------------------
// 2. Attachment file names are stripped of quotes and line breaks
// ---------------------------------------------------------------------------
$buildMimeBody = new ReflectionMethod('AstroMailer', 'buildMimeBody');
if (PHP_VERSION_ID < 80100) {
    $buildMimeBody->setAccessible(true);
}
$mimeBody = $buildMimeBody->invoke(
    null,
    '<p>body</p>',
    [['name' => "report\"\r\nX-Injected: 1", 'content' => 'PDFDATA', 'mime' => 'application/pdf']],
    [['cid' => ASTRO_LOGO_CID, 'name' => 'logo.png', 'content' => 'PNGDATA', 'mime' => 'image/png']],
    'OUTERBOUNDARY',
    'INNERBOUNDARY'
);
checkMailer(is_string($mimeBody) && $mimeBody !== '', 'The MIME body builder returns a message body');
checkMailer(preg_match('/^X-Injected:/mi', $mimeBody) === 0, 'Injected CRLF never becomes its own header line');
checkMailer(strpos($mimeBody, 'X-Injected') !== false, 'The injected text stays inside the attachment file name, sanitised');
checkMailer(strpos($mimeBody, "\r\nContent-ID: <" . ASTRO_LOGO_CID . ">") !== false, 'The inline logo is emitted with its Content-ID');
checkMailer(substr_count($mimeBody, 'Content-Disposition: attachment') === 1, 'Exactly one attachment part is emitted for one attachment');
checkMailer(strpos($mimeBody, base64_encode('PDFDATA')) !== false, 'Attachment payloads are base64 encoded');

// ---------------------------------------------------------------------------
// 3. The per-message hard cap refuses oversize messages before sending
// ---------------------------------------------------------------------------
putenv('FAMILY_EMAIL_MAX_ATTACHMENT_MB=1');
$oversize = AstroMailer::sendEmailWithAttachments(
    'victim@example.com',
    'Victim',
    'Subject',
    '<p>hello</p>',
    [['name' => 'huge.pdf', 'content' => str_repeat('A', 2 * 1048576), 'mime' => 'application/pdf']],
    $safeConfig
);
checkMailer($oversize['success'] === false, 'An oversize message is refused instead of being handed to the transport');
checkMailer(strpos((string)$oversize['message'], 'per-message limit') !== false, 'The refusal names the per-message limit');
checkMailer(strpos((string)$oversize['message'], 'Nothing was sent') !== false, 'The refusal states that nothing was sent');

// ---------------------------------------------------------------------------
// 4. Budget configuration: MB wins, byte override works, junk falls back
// ---------------------------------------------------------------------------
checkMailer(astro_max_attachment_encoded_bytes() === 1048576, 'FAMILY_EMAIL_MAX_ATTACHMENT_MB sets the per-message budget');
putenv('FAMILY_EMAIL_MAX_ATTACHMENT_BYTES=2097152');
checkMailer(astro_max_attachment_encoded_bytes() === 1048576, 'The MB value still wins when both are set');
putenv('FAMILY_EMAIL_MAX_ATTACHMENT_MB');
checkMailer(astro_max_attachment_encoded_bytes() === 2097152, 'The byte override applies once the MB value is unset');
putenv('FAMILY_EMAIL_MAX_ATTACHMENT_BYTES=1000');
checkMailer(astro_max_attachment_encoded_bytes() === 25 * 1048576, 'A byte budget below the 512 KB floor falls back to the 25 MiB default');
putenv('FAMILY_EMAIL_MAX_ATTACHMENT_MB=0.5');
checkMailer(astro_max_attachment_encoded_bytes() === 25 * 1048576, 'A sub-1 MiB budget is ignored rather than shrinking delivery to nothing');
putenv('FAMILY_EMAIL_MAX_ATTACHMENT_MB');
putenv('FAMILY_EMAIL_MAX_ATTACHMENT_BYTES');

// ---------------------------------------------------------------------------
// 5. Contact-inquiry recipient resolution
// ---------------------------------------------------------------------------
checkMailer(
    astro_resolve_contact_recipient('env@astrosivam.com', 'admin@astrosivam.com', 'site@astrosivam.com', 'fallback@astrosivam.com') === 'env@astrosivam.com',
    'CONTACT_INQUIRY_TO wins over every stored setting'
);
checkMailer(
    astro_resolve_contact_recipient('', 'admin@astrosivam.com', 'site@astrosivam.com', 'fallback@astrosivam.com') === 'admin@astrosivam.com',
    'The admin notification address is used when the env override is empty'
);
checkMailer(
    astro_resolve_contact_recipient('', '', 'site@astrosivam.com', 'fallback@astrosivam.com') === 'site@astrosivam.com',
    'The site contact address is used when nothing else is configured'
);
checkMailer(
    astro_resolve_contact_recipient('not-an-email', '', '', 'fallback@astrosivam.com') === 'fallback@astrosivam.com',
    'An invalid env value is skipped instead of being used as the recipient'
);
checkMailer(
    astro_resolve_contact_recipient("admin@astrosivam.com\r\nBcc: attacker@evil.example", '', '', 'fallback@astrosivam.com') === 'fallback@astrosivam.com',
    'A CRLF-laden configured address is skipped'
);
checkMailer(
    astro_resolve_contact_recipient('', '', '', '') === '',
    'With no valid address anywhere the resolver reports that nothing is configured'
);
checkMailer(
    astro_resolve_contact_recipient('  spaced@astrosivam.com  ', '', '', '') === 'spaced@astrosivam.com',
    'Surrounding whitespace in a configured address is tolerated'
);

// ---------------------------------------------------------------------------
// 6. The inline brand logo is always attachable (branding regression guard)
// ---------------------------------------------------------------------------
$logo = astro_inline_logo_attachment();
checkMailer(is_array($logo) && count($logo) === 1, 'The inline logo attachment resolves to a single part');
checkMailer($logo[0]['cid'] === ASTRO_LOGO_CID, 'The inline logo part carries the cid: used by the email templates');
checkMailer($logo[0]['mime'] === 'image/png', 'The inline logo is sent as image/png');
checkMailer(strlen((string)$logo[0]['content']) > 1024, 'The inline logo payload is a real image, not an empty placeholder');

echo "\nPHP mailer guard tests passed.\n";
