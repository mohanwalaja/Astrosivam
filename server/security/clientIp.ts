/**
 * ASTRO SIVAM — hardened client IP resolution.
 *
 * WHY THIS EXISTS: `X-Forwarded-For` / `CF-Connecting-IP` are attacker-controlled
 * headers when the app is reached directly (shared hosting, VPS with an open
 * port). Trusting them blindly let anyone mint a fresh "client IP" per request
 * and bypass the FREE-BETA 1-order-per-IP limit, the pending-order limit and
 * IP bans — the exact controls the last hardening pass added.
 *
 * RULE: forwarding headers are honoured ONLY when the direct TCP peer
 * (REMOTE_ADDR / req.ip) is a proxy we actually run behind:
 *   • loopback / private-network addresses (our own LB or nginx), or
 *   • a published Cloudflare edge range (https://www.cloudflare.com/ips/),
 * which sets CF-Connecting-IP authoritatively.
 * A public, untrusted peer never gets to choose its own identity.
 */
import net from 'net';
import type { Request } from 'express';

/** Loopback, RFC1918, link-local and CGNAT — proxies on our own infrastructure. */
const privatePeers = new net.BlockList();
for (const [base, bits] of [
  ['127.0.0.0', 8],
  ['10.0.0.0', 8],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['169.254.0.0', 16],
  ['100.64.0.0', 10]
] as Array<[string, number]>) {
  privatePeers.addSubnet(base, bits, 'ipv4');
}
privatePeers.addSubnet('::1', 128, 'ipv6');
privatePeers.addSubnet('fc00::', 7, 'ipv6');
privatePeers.addSubnet('fe80::', 10, 'ipv6');

/** Published Cloudflare edge ranges (source: https://www.cloudflare.com/ips/). */
const cloudflareEdges = new net.BlockList();
for (const [base, bits] of [
  ['103.21.244.0', 22], ['103.22.200.0', 22], ['103.31.4.0', 22],
  ['104.16.0.0', 13], ['104.24.0.0', 14], ['108.162.192.0', 18],
  ['131.0.72.0', 22], ['141.101.64.0', 18], ['162.158.0.0', 15],
  ['172.64.0.0', 13], ['173.245.48.0', 20], ['188.114.96.0', 20],
  ['190.93.240.0', 20], ['197.234.240.0', 22], ['198.41.128.0', 17]
] as Array<[string, number]>) {
  cloudflareEdges.addSubnet(base, bits, 'ipv4');
}
for (const [base, bits] of [
  ['2400:cb00::', 32], ['2606:4700::', 32], ['2803:f800::', 32],
  ['2405:b500::', 32], ['2405:8100::', 32], ['2a06:98c0::', 29],
  ['2c0f:f248::', 32]
] as Array<[string, number]>) {
  cloudflareEdges.addSubnet(base, bits, 'ipv6');
}

/** Strips IPv4-mapped IPv6 wrappers and validates the result. */
export function normalizeIp(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().replace(/^::ffff:/i, '');
  if (!value) return null;
  return net.isIP(value) ? value : null;
}

/** True when the direct TCP peer is a proxy we run behind. */
export function isTrustedProxyPeer(ip: string): boolean {
  const value = normalizeIp(ip);
  if (!value) return false;
  if (net.isIPv4(value)) return privatePeers.check(value, 'ipv4') || cloudflareEdges.check(value, 'ipv4');
  return privatePeers.check(value, 'ipv6') || cloudflareEdges.check(value, 'ipv6');
}

function headerValue(req: Request, name: string): string | null {
  const raw = req.headers[name];
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return null;
}

/**
 * The client IP used for enforcement (beta limit, bans, pending limits,
 * login rate limiting). Never lets an untrusted peer pick its own identity.
 */
export function resolveClientIp(req: Request): string {
  const remote =
    normalizeIp(req.ip) ||
    normalizeIp(req.socket?.remoteAddress) ||
    '127.0.0.1';

  if (!isTrustedProxyPeer(remote)) {
    // Public peer talking to us directly — forwarding headers are spoofed.
    return remote;
  }

  // Cloudflare sets this at the edge and strips any client-supplied copy.
  const cf = normalizeIp(headerValue(req, 'cf-connecting-ip'));
  if (cf) return cf;

  // Our own nearest proxy appends the real client to X-Forwarded-For, so the
  // LAST valid hop is the one it added (earlier hops may be client-supplied).
  const xff = headerValue(req, 'x-forwarded-for');
  if (xff) {
    const hops = xff.split(',').map(h => normalizeIp(h)).filter((h): h is string => !!h);
    if (hops.length > 0) return hops[hops.length - 1];
  }

  const realIp = normalizeIp(headerValue(req, 'x-real-ip'));
  if (realIp) return realIp;

  return remote;
}
