# 🇺🇸 sayMerica

Convert any English text into relaxed, reduced **American-accent spelling** — written the way it
actually sounds (`going to → gonna`, `water → wader`, `nation → nashun`, `what are you → whatcha`).

- **Single file.** The whole app is `index.html`. Double-click it — no server, no build, no login.
- **100% offline & free.** All conversion runs in your browser. Nothing is sent anywhere, nothing is saved.
- **Hear it.** Built-in text-to-speech reads the converted text aloud in a US English voice.
- **Reference view.** Each original sentence (EN) sits right above its converted version (US).
- **Read-along samples.** 14 built-in passages you can load with one click — together they exercise
  every single baked word at least once.

## Run it

Just open the file:

```bash
open index.html        # macOS
# or drag index.html into any browser
```

To host it for free, drop `index.html` on GitHub Pages, Netlify, or any static host.

## How it works

The engine is a layered pipeline. Earlier layers are curated and exact; the last layer generalizes
to words nobody listed, so **any** input produces sensible output (graceful degradation):

```
normalize → phrases → connected speech → curated words → common words
          → (Full only: heavy reductions + slang) → generative phonetic rules
          → decoration (weak endings / stop-T) → re-capitalize sentences
```

### The layers (~340 baked entries)

| Layer | What it holds | Example |
|-------|---------------|---------|
| `PHRASES` | multi-word fixed spellings | `it is easy → sizzy` |
| `BLENDS` | connected-speech / cross-word slurs + contractions | `what are you → whatcha`, `do not → don't` |
| `BASE_WORDS` | curated single words (both intensities) | `definitely → defin-ly` |
| `COMMON_BASE` | frequent content words, schwa-drops (both intensities) | `government → guvment` |
| `FULL_WORDS` | heavy common-word reductions (Full only) | `it → ih`, `that → tha` |
| `COMMON_FULL` | frequent function-word reductions (Full only) | `the → thuh`, `you → ya` |
| `SLANG` | casual & contraction reductions (Full only) | `because → cuz` |

### Generative rules (for unlisted words)

These run after the dictionaries and are written to be **right by design**, not blind guesses:

- **Flat T** — `t`/`tt` between vowels → `d`: `water → wader`, `better → bedder` (doubling preserved).
- **SH / CH clusters** — turns the classic misfires into correct accent (Full): `nation → nashun`,
  `question → queschun`, `picture → piccher`, `natural → nachural`, `partial → parshul`.
- **`-ing → -in`** — only when there's a vowel earlier in the word, so `talking → talkin` but
  `ring`/`king`/`thing` are left alone.
- **`nt`-drop** — `winter → winer`, but guarded so `until`/`intend` keep their `t`.
- **T→CH / D→J onsets** — `tree → chree`, `dream → jream`, `children → chiljren`.

## Subtle vs Full

- **Subtle** — phrases, connected speech, ~250 common words, and flat-T. Clean and safe for any text.
- **Full** — adds heavy reductions (`it→ih`, `the→thuh`, `you→ya`), slang, H-dropping, `-ing→-in`,
  and the SH/CH + T→CH/D→J rules on unlisted words. The thickest accent.

## Extending the vocabulary

All the dictionaries live near the top of the `<script>` in `index.html`. To add or fix a word, add
one entry to the right layer — curated entries always win over the generative rules, so this is how
you pin any word the rules get wrong:

```js
const COMMON_BASE = {
  // ...
  "actual": "akchual",   // pins the spelling instead of letting rules produce "acchual"
};
```

Then add a matching line to the test suite (below) so it stays fixed.

## Tests

```bash
npm test        # or: node tests/engine.test.mjs
```

The test (`tests/engine.test.mjs`) **extracts the engine straight out of `index.html`** and runs it,
so the tests can never drift from the shipping app. 83 assertions cover the dictionaries, the
generative rules, the Subtle/Full boundary, layer ordering, sentence capitalization, and the
decoration markup.

## Project structure

```
sayMerica/
├── index.html            # the entire app (engine + UI)
├── package.json          # npm test script
├── tests/
│   └── engine.test.mjs   # 78 assertions, parsed from index.html
└── README.md
```

## Limitations

sayMerica is an **eye-dialect toy**, not a pronunciation dictionary. The ~340 curated entries plus
the generative rules nail the common cases, but rare words, proper nouns, and brand-new slang fall
back to the regex and can occasionally misfire. Fix any you spot by adding a dictionary entry.

For dictionary-grade accuracy on *every* word you'd go through phonemes (a bundled CMU pronunciation
dictionary) or an LLM fallback — see the in-repo notes. The current design deliberately trades that
for being tiny, instant, and fully offline.
