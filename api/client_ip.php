<?php
/**
 * ASTRO SIVAM - hardened client IP resolution (shared by every API router).
 *
 * WHY THIS EXISTS: X-Forwarded-For / CF-Connecting-IP are attacker-controlled
 * when the app is reached directly. Honouring them unconditionally lets any
 * client mint a fresh IP per request, which bypasses the FREE-BETA
 * 1-order-per-IP limit, the pending-order limit, IP bans and every IP-based
 * rate limit. Forwarding headers are therefore trusted ONLY when the direct
 * peer (REMOTE_ADDR) is a proxy we actually run behind: loopback / private
 * network, or a published Cloudflare edge range
 * (https://www.cloudflare.com/ips/).
 *
 * This file is deliberately dependency-free so requiring it from config.php
 * cannot create a circular include. Do not add require statements here.
 */

/** CIDR membership test for both IPv4 and IPv6 (no dependencies). */
function astro_ip_in_cidr($ip, $cidr) {
    $parts = explode('/', $cidr);
    if (count($parts) !== 2) return false;
    list($subnet, $bits) = $parts;
    $bits = (int)$bits;

    if (strpos($ip, ':') !== false || strpos($subnet, ':') !== false) {
        // IPv6
        $ipBin = @inet_pton($ip);
        $subnetBin = @inet_pton($subnet);
        if ($ipBin === false || $subnetBin === false || strlen($ipBin) !== strlen($subnetBin)) return false;
        $fullBytes = intdiv($bits, 8);
        $remBits = $bits % 8;
        if ($fullBytes > 0 && substr($ipBin, 0, $fullBytes) !== substr($subnetBin, 0, $fullBytes)) return false;
        if ($remBits === 0) return true;
        $mask = chr((0xFF << (8 - $remBits)) & 0xFF);
        return ((ord($ipBin[$fullBytes]) & ord($mask)) === (ord($subnetBin[$fullBytes]) & ord($mask)));
    }

    // IPv4
    $ipLong = ip2long($ip);
    $subnetLong = ip2long($subnet);
    if ($ipLong === false || $subnetLong === false) return false;
    $mask = $bits <= 0 ? 0 : (-1 << (32 - $bits));
    return (($ipLong & $mask) === ($subnetLong & $mask));
}

/** True when the direct TCP peer is a proxy we run behind (or Cloudflare). */
function astro_is_trusted_proxy_ip($ip) {
    $ip = trim((string)$ip);
    if ($ip === '') return false;
    if ($ip === '127.0.0.1' || $ip === '::1') return true;

    // Loopback / RFC1918 / link-local / CGNAT — proxies on our own infrastructure.
    $parsed = @inet_pton($ip);
    if ($parsed !== false && strpos($ip, ':') === false) {
        foreach (array('127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '169.254.0.0/16', '100.64.0.0/10') as $cidr) {
            if (astro_ip_in_cidr($ip, $cidr)) return true;
        }
    }
    if ($parsed !== false && strpos($ip, ':') !== false) {
        foreach (array('fc00::/7', 'fe80::/10') as $cidr) {
            if (astro_ip_in_cidr($ip, $cidr)) return true;
        }
    }

    // Published Cloudflare edge ranges.
    $cloudflare = array(
        '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '104.16.0.0/13',
        '104.24.0.0/14', '108.162.192.0/18', '131.0.72.0/22', '141.101.64.0/18',
        '162.158.0.0/15', '172.64.0.0/13', '173.245.48.0/20', '188.114.96.0/20',
        '190.93.240.0/20', '197.234.240.0/22', '198.41.128.0/17',
        '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32',
        '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32'
    );
    foreach ($cloudflare as $cidr) {
        if (astro_ip_in_cidr($ip, $cidr)) return true;
    }
    return false;
}

/** Reliably get the client IP address (spoof-resistant). */
function getClientIpAddress() {
    $remote = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    if (!astro_is_trusted_proxy_ip($remote)) {
        // Public peer talking to us directly — forwarding headers are spoofed.
        return $remote;
    }
    // Cloudflare sets this at the edge and strips any client-supplied copy.
    if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        $cf = trim($_SERVER['HTTP_CF_CONNECTING_IP']);
        if (filter_var($cf, FILTER_VALIDATE_IP)) return $cf;
    }
    // Our nearest proxy appends the real client, so the LAST valid hop is the
    // one it added (earlier hops may have been supplied by the client).
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $hops = array_reverse(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']));
        foreach ($hops as $hop) {
            $hop = trim($hop);
            if (filter_var($hop, FILTER_VALIDATE_IP)) return $hop;
        }
    }
    if (!empty($_SERVER['HTTP_X_REAL_IP'])) {
        $real = trim($_SERVER['HTTP_X_REAL_IP']);
        if (filter_var($real, FILTER_VALIDATE_IP)) return $real;
    }
    return $remote;
}
