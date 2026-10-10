#!/usr/bin/env python3
"""
Collect the archive.org djvu.txt full text for Tamil sources listed in
knowledge/ai-astrologer/licence-audit.json.

Output goes OUTSIDE the git repository (default: ../astro-texts) so no
book text is committed. A manifest.json records the identifier, file name,
size and checksum for every item.

Usage:
  python3 fetch_archive_djvu.py --status open            # licence-verified only
  python3 fetch_archive_djvu.py --status readable        # also unlicensed archive items
  python3 fetch_archive_djvu.py --status open --dry-run  # list only, no download

Notes:
  * Only archive.org identifiers are fetched. Sites marked "not-open" are
    never fetched.
  * This script has NOT been run against the live archive.org API from the
    build sandbox (its outbound allowlist blocks archive.org). Test it with
    --dry-run first.
"""
import argparse
import hashlib
import json
import os
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIT = os.path.join(HERE, "..", "licence-audit.json")
DEFAULT_OUT = os.path.join(HERE, "..", "..", "..", "..", "astro-texts")
UA = "astro-sivam-ingest/1.0 (contact: site owner)"


def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def djvu_file(identifier):
    meta = get_json("https://archive.org/metadata/" + urllib.parse.quote(identifier, safe=""))
    for f in meta.get("files", []):
        if f.get("name", "").endswith("_djvu.txt") and f.get("source") == "derivative":
            return f["name"], int(f.get("size", 0)), f.get("md5")
    return None


def download(identifier, name, dest):
    url = "https://archive.org/download/%s/%s" % (
        urllib.parse.quote(identifier, safe=""), urllib.parse.quote(name))
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=300) as r, open(dest + ".part", "wb") as out:
        while True:
            chunk = r.read(65536)
            if not chunk:
                break
            out.write(chunk)
    os.replace(dest + ".part", dest)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--status", choices=["open", "readable"], default="open")
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--delay", type=float, default=2.0, help="seconds between items")
    args = ap.parse_args()

    audit = json.load(open(AUDIT, encoding="utf-8"))
    wanted = {"open"} if args.status == "open" else {"open", "not-open-no-licenseurl"}
    items = [r for r in audit["records"] if r.get("archiveIdentifier") and r["status"] in wanted]
    print("items to process:", len(items))

    os.makedirs(args.out, exist_ok=True)
    manifest_path = os.path.join(args.out, "manifest.json")
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}

    for rec in items:
        ident = rec["archiveIdentifier"]
        try:
            found = djvu_file(ident)
        except Exception as e:  # network or missing item
            print("SKIP (metadata failed):", ident, e, file=sys.stderr)
            continue
        if not found:
            print("SKIP (no djvu.txt):", ident)
            continue
        name, size, md5 = found
        safe = "".join(c if c.isalnum() or c in "-_." else "_" for c in ident)
        dest = os.path.join(args.out, safe + ".djvu.txt")
        print(("DRY " if args.dry_run else "GET ") + ident, name, size, "bytes")
        if args.dry_run:
            continue
        if os.path.exists(dest) and manifest.get(ident, {}).get("md5") == md5:
            continue
        download(ident, name, dest)
        h = hashlib.md5(open(dest, "rb").read()).hexdigest()
        manifest[ident] = {
            "sourceId": rec["id"], "file": os.path.basename(dest), "archiveFile": name,
            "bytes": os.path.getsize(dest), "md5": h, "licenseurl": rec.get("licenseurl"),
            "status": rec["status"], "fetchedOn": time.strftime("%Y-%m-%d"),
        }
        json.dump(manifest, open(manifest_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        time.sleep(args.delay)

    print("done. manifest:", manifest_path)


if __name__ == "__main__":
    main()
