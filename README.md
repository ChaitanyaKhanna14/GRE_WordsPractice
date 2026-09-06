# GRE Words Practice

A local-first website for learning GRE vocabulary from a cluster-based word list: listen to words with
their meanings and mnemonics, review them as spaced-repetition flashcards, and test yourself with
GRE-style quizzes. No server, no accounts, no build step. Everything runs in the browser.

The bundled list is the **GRE Vocabulary Handbook**: 15 days, 95 clusters, 1,102 word entries
(958 unique words; some words appear in more than one cluster with a different sense).

## Run it

Double-click `index.html`, or serve the folder:

```
python -m http.server 8765
```

and open http://127.0.0.1:8765/. Use **Chrome or Edge** for the best text-to-speech voices
(Edge's "Natural" voices are the most pleasant on Windows).

## What it does

| Screen | What you get |
|---|---|
| **Learn (home)** | A winding path of cluster nodes grouped into colour-coded units (one per day). Tap a node to listen, review, quiz or browse it. Side rail shows streak, XP, daily-goal ring and the last 7 days. |
| **Browse** | Days → clusters → word tables. Click any word for all its senses, its schedule, and your own note. |
| **Listen** | Auto-plays a playlist (a day, a cluster, weak words…). Script per word: cluster name, word ×N, spelling, meaning, mnemonic, word again. Speed, pause, gap, shuffle, loop. Space / ← / → keys. |
| **Review** | Flashcards with spaced repetition (SM-2 style). Rate Again / Hard / Good / Easy; the button shows when the word comes back. Keys: space flip, 1–4 rate, s speak. |
| **Quiz** | Word → meaning, meaning → word, odd-one-out, type-the-word. Hard mode draws wrong options from the same cluster (near-synonyms). Wrong answers push the word back to "due". |
| **Weak** | Words you keep missing, worst first. Listen / review / quiz just those. |
| **Settings** | Profiles (one per person on a shared laptop), new-words-per-day, voice, backup export/import, Anki export, import more words. |

**XP and goals.** Every action earns XP (10 per card rated Good or better, 5 for Again, 10 per correct
quiz answer, 2 per word listened). A daily goal (default 50 XP, editable in Settings) drives the ring on the
home page and the streak. Sessions end with a results screen, confetti and a short sound. Sounds can be
turned off in Settings.

Progress is stored per profile in the browser's localStorage. Use **Settings → Export progress**
to back it up or move it to another device.

## Adding or changing words

The word list lives in `data.js`, generated from `source/GRE_Vocab_Handbook.docx`:

```
pip install python-docx
python tools/convert_docx.py
```

The converter expects the handbook layout: `Heading 1` = "Day N", `Heading 2` = "Cluster #N — Name",
followed by a table with columns Word | Meaning | Mnemonic.

You can also add words from inside the site (Settings → Add more words) by uploading another
`.docx` in the same layout, or by pasting text:

```
# Cluster #101 — Praise
laud | to praise highly | "applaud" without the app
extol | to praise enthusiastically | ex-TOLL the bell to praise
```

## Deploying for both of you

Because the site is static, GitHub Pages hosts it for free: push to `main`, then in the repository
settings enable Pages from the `main` branch root. The service worker (`sw.js`) then makes it work
offline and installable on a phone. Progress stays per device; share it with the export/import
buttons until a sync backend is added.

## Files

```
index.html        page shell
styles.css        styling (light and dark)
app.js            all application logic
data.js           generated word data (do not edit by hand)
tools/convert_docx.py   handbook → data.js
source/           the original handbook
manifest.json, sw.js    PWA bits, only active when served over http(s)
```
