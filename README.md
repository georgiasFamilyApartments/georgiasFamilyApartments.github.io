# Georgia's Family Apartments — website

Static, bilingual (English / Ελληνικά) website for the three apartments in Heraklion,
published with GitHub Pages at **www.creteimages.eu**.

No frameworks, no database: plain HTML/CSS/JS built by Jekyll (which GitHub runs for you).
Photos are served as responsive WebP and lazy-loaded, so pages stay light as the gallery grows.

## One-time setup

1. **Publish with GitHub Actions** — repo *Settings → Pages → Build and deployment → Source: GitHub Actions*.
   Keep the custom domain `www.creteimages.eu` there and tick *Enforce HTTPS*.
2. **Receive booking requests by email** — get a free access key at <https://web3forms.com>
   (enter the email address that should receive requests), then paste it into `_config.yml`:
   ```yaml
   booking:
     web3forms_key: "your-key-here"
   ```
   Until a key is set, the "Send booking request" button opens the guest's own email app
   with the request filled in, so the form already works — just less smoothly.
3. **Show booked dates on the calendars** — in the Booking.com extranet open
   *Rates & Availability → Sync calendars* and copy the **export** link of each apartment
   (Airbnb: *Listing → Availability → Connect calendars → Export*). Add them in
   *Settings → Secrets and variables → Actions → New repository secret*:

   | Secret          | Value                                   |
   |-----------------|-----------------------------------------|
   | `ICAL_STANDARD` | export link(s) for the Standard Apartment |
   | `ICAL_NATURAL`  | export link(s) for the Natural Apartment  |
   | `ICAL_GARDEN`   | export link(s) for the Garden Apartment   |

   Several links for one apartment (e.g. Booking.com + Airbnb) can be separated with spaces.
   The site checks them every 30 minutes and republishes only when something changed.

## How booking works

Guests pick an apartment and free dates on the calendar and send a **booking request**.
You receive it by email, confirm availability and price with the guest, and then
**block those dates on Booking.com** (so Booking.com — and from there the website — stays in sync).
No payment is taken on the website.

If you later want instant booking with online payment, connect a channel manager
(e.g. Beds24, Smoobu, Lodgify) to Booking.com and replace the form with its booking widget.

## Everyday edits

| What                                  | Where |
|---------------------------------------|-------|
| Phone, email, address                 | `_config.yml` → `contact` |
| Direct-booking discount, climate fee  | `_config.yml` → `booking` |
| Apartment texts, beds, amenities, prices | `_data/apartments.yml` (`price_from` shows "from €X / night") |
| All other texts (both languages)      | `_data/i18n.yml` |

### Adding photos

```bash
tools/optimize-images.sh ~/Pictures/new-natural-photos assets/img/natural
```
This creates small/medium/large `.webp` versions of each picture (location data removed).
Then list each new file in `_data/apartments.yml` under that apartment's `photos`
(file name without `-960.webp`). The first photo is the cover. Requires ImageMagick.

## Preview locally

```bash
gem install jekyll -v 3.10.0 webrick   # once
jekyll serve                           # → http://localhost:4000
```

## Structure

```
_config.yml              site settings
_data/apartments.yml     the three apartments
_data/i18n.yml           all texts, English + Greek
_layouts/                page templates (home, apartment, book)
_includes/               shared pieces (header/footer live in _layouts/default.html)
apartments/, el/         page stubs (English at /, Greek at /el/)
assets/css, assets/js    one stylesheet, two small scripts (site.js, booking.js)
assets/data/availability.json   booked dates, filled in by the workflow
tools/                   image optimizer and calendar sync
.github/workflows/deploy.yml    build + deploy + calendar sync
```
