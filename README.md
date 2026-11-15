# Deauxlection

A personal catalog for vinyl records, books and quotes.

- **Scan a barcode** with your phone camera. Records are looked up on Discogs and MusicBrainz, and books (ISBN barcodes) on Open Library and Google Books. The original cover, track list, label, catalog number, year and pressing details fill in. You pick your exact copy when a barcode matches several pressings.
- **No barcode?** Search by the catalog number on the spine or label (e.g. `CS 8163`), or by artist and album.
- **Covers are copied into your own storage**, so they keep working if the source link changes. You can also add your own photo.
- Records get a Goldmine condition grade for the record and the sleeve, a track list grouped by side, the date you got it and, optionally, what you paid. The Records page totals what you've spent on the records that have a price.
- Books get reading status, a rating, the date you got them, spines sized by page count, and a **reading journal**: dated notes with a page number and an optional photo of the page. Any note can be turned into a quote.
- Quotes can be linked to a book on your shelf.
- **Share links** (Settings): a read-only link to your records, books and/or quotes. Visitors can browse and search but can't change anything. Book pages show your notes and reading journal. Prices paid are hidden unless you include them. Switch a link off at any time.

Built with Next.js 15, Supabase (auth, Postgres, storage) and ZXing for barcode scanning.

## Set it up

You need free accounts on [Supabase](https://supabase.com), [Vercel](https://vercel.com) and, optionally, [Discogs](https://www.discogs.com).

### 1. Supabase

1. Create a project.
2. Open **SQL Editor**, paste in [`supabase/schema.sql`](supabase/schema.sql) and run it. This creates the `items` table, locks every row to its owner, and creates the `covers` storage bucket.
3. Go to **Authentication → URL Configuration**. Set **Site URL** to your Vercel address (for example `https://deauxlection.vercel.app`) and add `https://deauxlection.vercel.app/auth/callback` and `http://localhost:3000/auth/callback` under **Redirect URLs**.
4. Go to **Project Settings → API** and copy the **Project URL** and the **publishable key** (or the legacy anon key).

### 2. Discogs (recommended)

Discogs has the best vinyl data, down to the individual pressing. Create a personal access token at <https://www.discogs.com/settings/developers>. Without it, lookups use MusicBrainz only.

### 3. Vercel

1. **Add New → Project**, import `deaux28/deauxlection`.
2. Add these environment variables:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (or anon) key |
   | `ALLOWED_EMAILS` | The email address(es) allowed to sign in, comma-separated |
   | `DISCOGS_TOKEN` | Your Discogs token (optional) |
   | `NEXT_PUBLIC_CURRENCY` | Currency for prices paid, e.g. `USD`, `GBP`, `EUR` (optional, defaults to USD) |

3. Deploy. Open the site, enter your email, and click the link that arrives.

   Supabase's built-in email only sends a few messages an hour. To skip email, create a password for yourself in Supabase under **Authentication → Users → Add user → Create new user** (tick **Auto Confirm User**), then choose **Sign in with a password instead** on the sign-in page. If the user already exists, open it and use **Send password recovery** or set the password there.
4. Once you've signed in the first time, you can turn off **Authentication → Providers → Email → Allow new users to sign up** in Supabase for extra safety. `ALLOWED_EMAILS` already blocks anyone else.

The camera only works over HTTPS, which Vercel provides.

### Run it locally

```bash
cp .env.example .env.local   # then fill in the values
npm install
npm run dev
```

## Updating the database

New features sometimes need a database change. Each one is a file in [`supabase/migrations/`](supabase/migrations). Run any you haven't run yet in the Supabase SQL editor, oldest first. They're safe to run twice.

| File | Adds |
|---|---|
| `002_shares.sql` | Share links |

## Moving over from the claude.ai version

Open **Add → Import, export, sign out** and import a JSON export. Both this app's own export format and a list of documents from the earlier claude.ai version (objects with a `kind` field) are accepted. Quote-to-book links from the old page need re-picking after import, because item ids change.

## Data sources

Record data from [Discogs](https://www.discogs.com) and [MusicBrainz](https://musicbrainz.org), cover art from the [Cover Art Archive](https://coverartarchive.org), book data from [Open Library](https://openlibrary.org) and Google Books. This app is for personal use. Follow each service's terms if you open it up to others.
