#!/usr/bin/env python3
"""Build assets/data/availability.json from the apartments' iCal calendar feeds.

For every apartment id in _data/apartments.yml, the environment variable
ICAL_<ID> (e.g. ICAL_NATURAL) may hold one or more iCal export URLs
(Booking.com, Airbnb, Google Calendar…), separated by spaces, commas or newlines.
Booked nights from all feeds are merged.

Optional: LIVE_URL = URL of the currently published availability.json. When set,
the script reports (via $GITHUB_OUTPUT) whether the booked dates changed, so the
workflow only redeploys the site when needed.

Only the Python standard library is used.
"""
import datetime as dt
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "data" / "availability.json"
APARTMENTS = ROOT / "_data" / "apartments.yml"


def apartment_ids():
    return re.findall(r"^- id:\s*([\w-]+)", APARTMENTS.read_text(encoding="utf-8"), re.M)


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "georgias-apartments-sync/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


def parse_date(value):
    # DTSTART;VALUE=DATE:20261101  or  DTSTART:20261101T140000Z
    m = re.search(r"(\d{4})(\d{2})(\d{2})", value)
    return dt.date(int(m[1]), int(m[2]), int(m[3])) if m else None


def parse_ics(text):
    """Return [(start, end)] date ranges; end is the check-out day (exclusive)."""
    text = re.sub(r"\r?\n[ \t]", "", text)  # unfold continuation lines
    ranges = []
    for block in re.findall(r"BEGIN:VEVENT(.*?)END:VEVENT", text, re.S):
        fields = {}
        for line in block.splitlines():
            if ":" in line:
                key, value = line.split(":", 1)
                fields.setdefault(key.split(";")[0].upper(), value.strip())
        if fields.get("STATUS", "").upper() == "CANCELLED":
            continue
        start = parse_date(fields.get("DTSTART", ""))
        if not start:
            continue
        end = parse_date(fields.get("DTEND", "")) or start + dt.timedelta(days=1)
        if end > start:
            ranges.append((start, end))
    return ranges


def merge(ranges, today):
    merged = []
    for start, end in sorted(r for r in ranges if r[1] > today):
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return [[s.isoformat(), e.isoformat()] for s, e in merged]


def main():
    today = dt.date.today()
    previous = {}
    if OUT.exists():
        previous = json.loads(OUT.read_text(encoding="utf-8")).get("apartments", {})

    result, failed = {}, False
    for apt in apartment_ids():
        urls = re.split(r"[\s,]+", os.environ.get(f"ICAL_{apt.upper().replace('-', '_')}", "").strip())
        urls = [u for u in urls if u]
        if not urls:
            print(f"· {apt}: no calendar feed configured")
            result[apt] = previous.get(apt, [])
            continue
        ranges = []
        try:
            for url in urls:
                ranges += parse_ics(fetch(url))
        except Exception as exc:  # keep last known data rather than showing everything free
            print(f"✗ {apt}: could not read calendar ({exc}); keeping previous data", file=sys.stderr)
            result[apt] = previous.get(apt, [])
            failed = True
            continue
        result[apt] = merge(ranges, today)
        print(f"✓ {apt}: {len(result[apt])} booked period(s)")

    data = {"updated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "apartments": result}
    OUT.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

    live_url = os.environ.get("LIVE_URL")
    if live_url and os.environ.get("GITHUB_OUTPUT"):
        try:
            live = json.loads(fetch(live_url)).get("apartments")
        except Exception:
            live = None
        changed = live != result
        print(f"Booked dates changed since last deploy: {changed}")
        with open(os.environ["GITHUB_OUTPUT"], "a") as fh:
            fh.write(f"changed={'true' if changed else 'false'}\n")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
