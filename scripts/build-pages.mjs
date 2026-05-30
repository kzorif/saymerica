/**
 * sayMerica — programmatic page generator
 *
 * Builds static long-tail SEO pages at /how-americans-say/<word>/ plus a hub
 * index and a sitemap. Each page is fully pre-rendered HTML (best for crawling).
 *
 * The conversion engine is EXTRACTED from index.html (same trick as the tests)
 * so generated content can never drift from the live app.
 *
 *   Run:  node scripts/build-pages.mjs   (or: npm run build:pages)
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SITE = "https://kzorif.github.io/saymerica";   // ← change if you move to a custom domain
const TODAY = new Date().toISOString().slice(0, 10);

/* ---- pull the engine out of index.html ---- */
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const engineSrc = html.split("<script>")[1].split("</script>")[0].split("/* ----------------------------- UI")[0];
const E = new Function(engineSrc + "\n return { convert, PHRASES, BLENDS, BASE_WORDS, COMMON_BASE, FULL_WORDS, COMMON_FULL, SLANG, POST_WORDS };")();

const stripTags = s => s.replace(/<[^>]+>/g, "").replace(/ʼ/g, "").replace(/[\[\]]/g, "");
const convFull = w => stripTags(E.convert(w, { level: "full", weak: false, stops: false })).trim();
const escHtml = s => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const escAttr = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const slugify = s => s.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const lc1 = s => s.charAt(0).toLowerCase() + s.slice(1);

/* ---- candidate words (filtered to ones that actually change) ---- */
const WORDS = [
  // flap-T
  "water","better","butter","city","pretty","little","bottle","matter","letter","latter","daughter",
  "computer","later","writer","writing","getting","meeting","waiting","sitting","putting","setting",
  "beautiful","total","metal","data","photo","auto","motor","native","positive","negative","relative",
  "creative","sensitive","competitive","gratitude","party","dirty","thirty","forty","twenty","ninety",
  "eighty","seventy","hundred","quality","ability","university","community","security","activity",
  "identity","celebrity","reality","society","liberty","duty","item","atom","title","cattle","pretty",
  // -ity / -ation share patterns above; -tion words
  "nation","station","information","education","vacation","attention","question","situation","population",
  "generation","organization","condition","position","function","action","motion","section","fiction",
  "addition","tradition","definition","competition","intention","direction","election","collection",
  "protection","connection","conversation","celebration","operation","application","presentation",
  // -ture / -tual
  "picture","nature","future","culture","mixture","feature","adventure","temperature","actual","mutual",
  "spiritual","natural","century","saturday",
  // -ing
  "going","doing","nothing","something","anything","everything","talking","walking","making","taking",
  "looking","running","coming","eating","reading","working","playing","saying","trying","thinking",
  "feeling","morning","evening","building","during","amazing","interesting",
  // tr / dr
  "tree","try","train","travel","country","control","trip","true","track","trust","dream","drive",
  "driver","dragon","dress","drink","drop","drama","address","children","laundry","bedroom","hundred",
  // nt-drop
  "winter","center","internet","plenty","interview","international","advantage","printer","hunter",
  "painter","counter","enter","gigantic","twenty",
  // dropped-H function words
  "him","her","his","have","had","here",
  // reductions / elisions
  "probably","definitely","family","favorite","comfortable","restaurant","vegetable","library",
  "february","wednesday","government","different","separate","chocolate","average","general","several",
  "remember","introduce","recognize","actually","literally","basically","usually",
  // connected-speech phrases
  "going to","want to","got to","kind of","sort of","a lot of","out of","have to","used to","supposed to",
  "what are you","what do you","don't you","did you","would you","could you","let me","give me",
  "i don't know","how about","because of","in front of","trying to","what's up","how is it going",
];

/* ---- explain which rule fired ---- */
const LABELS = {
  flapT: "Flap T (t → d)", tion: "The “‑shun” ending", ture: "T → CH before U", tial: "“sh” sounds",
  rt: "T after R", nt: "The disappearing NT", ing: "Dropped G (‑ing)", tr: "TR → CHR", dr: "DR → JR",
  hdrop: "Dropped H", reduce: "Swallowed syllables", blend: "Words that blur together", same: "Said the same",
};
function classify(word) {
  const w = word.toLowerCase();
  const conv = convFull(word);
  const changed = conv.toLowerCase() !== w;
  if (w.includes(" ")) {
    return { conv, changed, primary: "blend", cards: [{
      rule: "Words blur together",
      detail: "In fast American speech these words run into one another and collapse into a single relaxed chunk.",
      eg: "going to → gonna" }] };
  }
  const cards = [], tags = [];
  const add = (tag, rule, detail, eg) => { tags.push(tag); cards.push({ rule, detail, eg }); };
  if (/s?tion/.test(w)) add("tion", "The ‑TION “sh” ending", "The letters “ti” in ‑tion are pronounced “sh”, so the word ends in a relaxed “‑shun”.", "nation → nashun");
  if (/ture|[a-z]tur|tual/.test(w)) add("ture", "“T” becomes “CH” before U", "Before “ure” or “u”, the “t” turns into a “ch” sound.", "picture → piccher");
  if (/tial|tious/.test(w)) add("tial", "The ‑TIAL / ‑TIOUS “sh” sound", "The “ti” here is pronounced “sh”.", "partial → parshul");
  if (/[aeiou]tt?(?!i[aeiouy]|u)[aeiouy]/.test(w)) add("flapT", "Flap T", "A “t” between two vowels softens into a quick “d” — the single most recognizable feature of the American accent.", "water → wader");
  if (/[aeiou]rt[aeioy]/.test(w)) add("rt", "T after R flaps to D", "Following an “r”, a “t” before a vowel also flaps to a “d”.", "party → pardy");
  if (/[aeiou]nt(er|y$|o$|ing)/.test(w)) add("nt", "The disappearing “NT”", "After an “n”, the “t” is usually dropped entirely.", "winter → winer");
  if (/[a-z]*[aeiou][a-z]*ing$/.test(w) && w.length > 4) add("ing", "Dropped G (‑ing → ‑in)", "The hard “g” on “‑ing” endings disappears in casual speech.", "talking → talkin");
  if (/tr/.test(w)) add("tr", "“TR” sounds like “CHR”", "An American “tr” at the start of a syllable comes out close to “chr”.", "tree → chree");
  if (/dr/.test(w)) add("dr", "“DR” sounds like “JR”", "A “dr” cluster softens toward “jr”.", "dream → jream");
  if (["him", "her", "his", "have", "had", "here"].includes(w)) add("hdrop", "Dropped H", "Small function words lose their “h” when unstressed and leaning on the word before them.", "him → im");
  if (changed && cards.length === 0) add("reduce", "Swallowed syllables", "Unstressed syllables get squeezed out in fast speech, dropping sounds entirely.", "definitely → defin‑ly");
  if (!changed) cards.push({ rule: "Said the same", detail: "This one is already pronounced about the same in a relaxed American accent.", eg: "" });
  return { conv, changed, primary: tags[0] || "same", cards };
}

/* ---- compact, self-contained page CSS (on-brand) ---- */
const CSS = `
*{box-sizing:border-box}html,body{margin:0}
body{background:radial-gradient(1000px 500px at 50% -160px,rgba(43,47,99,.07),transparent 70%),repeating-linear-gradient(180deg,rgba(178,34,52,.045) 0 18px,transparent 18px 36px),#f3eee1;background-attachment:fixed;color:#16263f;font-family:ui-sans-serif,-apple-system,"Helvetica Neue",Segoe UI,Roboto,Arial,sans-serif;line-height:1.55;-webkit-font-smoothing:antialiased;min-height:100vh}
.wrap{max-width:680px;margin:0 auto;padding:40px 22px 80px}
a{color:#2b2f63}
.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:30px}
.brand{font-weight:700;letter-spacing:2px;text-transform:uppercase;font-size:12px;color:#2b2f63;text-decoration:none}
.brandcta{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#b22234;text-decoration:none}
.crumb{font-size:12px;color:#9a8d73;margin-bottom:14px}.crumb a{color:#586577;text-decoration:none}
h1{font-family:"Hoefler Text",Didot,"Iowan Old Style",Georgia,serif;font-size:clamp(28px,5vw,40px);font-weight:600;line-height:1.1;margin:0 0 6px;letter-spacing:-.4px}
h1 em{color:#b22234;font-style:italic}
.card{background:#fcf9f2;border:1px solid rgba(22,38,63,.22);border-radius:6px;box-shadow:0 22px 50px -34px rgba(22,38,63,.45);padding:26px 24px;margin:22px 0;text-align:center}
.xform{font-family:"Hoefler Text",Didot,Georgia,serif;font-size:clamp(30px,6vw,46px);line-height:1.2}
.xform .en{color:#16263f}.xform .ar{color:#9a8d73;margin:0 .35em}.xform .us{color:#b22234;font-style:italic}
.hear{margin-top:18px;border:0;background:#b22234;color:#fff;font-weight:700;letter-spacing:.5px;text-transform:uppercase;font-size:12.5px;padding:11px 22px;border-radius:4px;cursor:pointer}
.hear:hover{filter:brightness(1.08)}
h2{font-size:12px;text-transform:uppercase;letter-spacing:1.4px;color:#2b2f63;margin:34px 0 12px}
.rulecard{background:#fcf9f2;border:1px solid rgba(22,38,63,.12);border-left:3px solid #b22234;border-radius:4px;padding:14px 16px;margin:10px 0}
.rulecard .r{font-weight:700;color:#16263f;margin-bottom:4px}
.rulecard .d{font-size:15px;color:#586577}
.rulecard .e{font-family:Georgia,serif;font-style:italic;color:#2b2f63;font-size:14px;margin-top:6px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.chip{border:1px solid rgba(22,38,63,.22);background:#fcf9f2;color:#586577;padding:7px 13px;border-radius:3px;font-size:13px;font-weight:600;text-decoration:none}
.chip:hover{border-color:#b22234;color:#16263f;background:#fff}
.chip b{color:#b22234;font-weight:700}
.cta{display:block;text-align:center;margin:30px 0 0;background:#2b2f63;color:#fff;text-decoration:none;font-weight:700;text-transform:uppercase;letter-spacing:.5px;font-size:13px;padding:14px;border-radius:4px}
footer{text-align:center;color:#9a8d73;font-family:Georgia,serif;font-style:italic;font-size:12.5px;margin-top:44px}
footer .s{color:#b22234;letter-spacing:6px;display:block;margin-bottom:10px;font-style:normal}
.grid{display:flex;flex-wrap:wrap;gap:8px}
`;

const HEAR_JS = `<script>(function(){var b=document.getElementById('hear');if(!b||!window.speechSynthesis){if(b)b.style.display='none';return;}function pick(){var v=speechSynthesis.getVoices()||[],u=v.filter(function(x){return /en[-_]US/i.test(x.lang)});return u.find(function(x){return /google us english/i.test(x.name)})||u.find(function(x){return /google/i.test(x.name)})||u[0]||null;}b.addEventListener('click',function(){var s=new SpeechSynthesisUtterance(b.getAttribute('data-word')),p=pick();if(p){s.voice=p;s.lang=p.lang;}else s.lang='en-US';s.rate=.95;speechSynthesis.cancel();speechSynthesis.speak(s);});})();</script>`;

function head({ title, desc, canonical, jsonld }) {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${escHtml(title)}</title>
<meta name="description" content="${escAttr(desc)}"/>
<link rel="canonical" href="${canonical}"/>
<meta name="theme-color" content="#16263f"/>
<meta property="og:type" content="article"/><meta property="og:site_name" content="sayMerica"/>
<meta property="og:title" content="${escAttr(title)}"/>
<meta property="og:description" content="${escAttr(desc)}"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:image" content="${SITE}/og-image.png"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escAttr(title)}"/>
<meta name="twitter:description" content="${escAttr(desc)}"/>
<meta name="twitter:image" content="${SITE}/og-image.png"/>
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>${CSS}</style></head><body><div class="wrap">`;
}
const FOOT = `<footer><span class="s">★ ★ ★</span>sayMerica — the American accent translator.<br>Runs 100% in your browser. No login.</footer></div></body></html>`;

function wordPage(e, siblings) {
  const { word, conv, cards, primary } = e;
  const canonical = `${SITE}/how-americans-say/${e.slug}/`;
  const title = `How Americans pronounce “${word}” → ${lc1(conv)} | sayMerica`;
  const desc = `In relaxed American speech, “${word}” sounds like “${lc1(conv)}”. Here’s exactly why — ${LABELS[primary] || "accent reduction"} — with audio you can play.`;
  const jsonld = {
    "@context": "https://schema.org", "@type": "WebPage", name: title, url: canonical, inLanguage: "en-US",
    breadcrumb: { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "sayMerica", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "How Americans Say", item: `${SITE}/how-americans-say/` },
      { "@type": "ListItem", position: 3, name: word, item: canonical },
    ] },
  };
  const ruleCards = cards.map(c =>
    `<div class="rulecard"><div class="r">${escHtml(c.rule)}</div><div class="d">${escHtml(c.detail)}</div>${c.eg ? `<div class="e">${escHtml(c.eg)}</div>` : ""}</div>`).join("");
  const sibChips = siblings.length
    ? `<h2>More words with this sound</h2><div class="chips">${siblings.map(s =>
        `<a class="chip" href="../${s.slug}/">${escHtml(s.word)} → <b>${escHtml(lc1(s.conv))}</b></a>`).join("")}</div>`
    : "";
  return head({ title, desc, canonical, jsonld }) +
`<div class="top"><a class="brand" href="../../">sayMerica</a><a class="brandcta" href="../../">Open the translator →</a></div>
<div class="crumb"><a href="../../">Home</a> › <a href="../">How Americans Say</a> › ${escHtml(word)}</div>
<h1>How Americans pronounce <em>${escHtml(word)}</em></h1>
<div class="card">
  <div class="xform"><span class="en">${escHtml(word)}</span><span class="ar">→</span><span class="us">${escHtml(lc1(conv))}</span></div>
  <button class="hear" id="hear" data-word="${escAttr(word)}">▶ Hear it</button>
</div>
<h2>Why it sounds like that</h2>
${ruleCards}
${sibChips}
<a class="cta" href="../../">Convert your own text with the full translator →</a>
${FOOT}${HEAR_JS}`;
}

function hubPage(entries) {
  const canonical = `${SITE}/how-americans-say/`;
  const title = `How Americans Pronounce Common Words — Accent Guide | sayMerica`;
  const desc = `A growing guide to how Americans actually pronounce everyday English words — flap‑T, dropped G, the “‑shun” ending and more, each with audio.`;
  const jsonld = { "@context": "https://schema.org", "@type": "CollectionPage", name: title, url: canonical, inLanguage: "en-US" };
  const groups = {};
  for (const e of entries) (groups[e.primary] ||= []).push(e);
  const order = ["flapT", "ing", "tion", "ture", "tial", "nt", "rt", "tr", "dr", "hdrop", "blend", "reduce"];
  const sections = order.filter(k => groups[k]).map(k =>
    `<h2>${escHtml(LABELS[k])}</h2><div class="grid">${groups[k].map(e =>
      `<a class="chip" href="./${e.slug}/">${escHtml(e.word)} → <b>${escHtml(lc1(e.conv))}</b></a>`).join("")}</div>`).join("");
  return head({ title, desc, canonical, jsonld }) +
`<div class="top"><a class="brand" href="../">sayMerica</a><a class="brandcta" href="../">Open the translator →</a></div>
<div class="crumb"><a href="../">Home</a> › How Americans Say</div>
<h1>How Americans <em>actually</em> say it</h1>
<p style="color:#586577;font-family:Georgia,serif;font-style:italic;font-size:17px">${escHtml(`${entries.length} everyday words, spelled the way they really sound — tap any to hear it.`)}</p>
${sections}
<a class="cta" href="../">Convert your own text →</a>
${FOOT}`;
}

/* ---- build ---- */
const seen = new Set();
let entries = [];
for (const word of WORDS) {
  const slug = slugify(word);
  if (seen.has(slug)) continue;
  seen.add(slug);
  const c = classify(word);
  if (!c.changed) continue;                 // only pages with real content
  entries.push({ word, slug, conv: c.conv, cards: c.cards, primary: c.primary });
}
entries.sort((a, b) => a.word.localeCompare(b.word));

// group for sibling cross-links
const byPrimary = {};
for (const e of entries) (byPrimary[e.primary] ||= []).push(e);

const outDir = join(ROOT, "how-americans-say");
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const e of entries) {
  const siblings = (byPrimary[e.primary] || []).filter(s => s.slug !== e.slug).slice(0, 8);
  const dir = join(outDir, e.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), wordPage(e, siblings));
}
writeFileSync(join(outDir, "index.html"), hubPage(entries));

/* ---- sitemap (homepage + hub + every word page) ---- */
const urls = [
  { loc: `${SITE}/`, pri: "1.0", freq: "weekly" },
  { loc: `${SITE}/how-americans-say/`, pri: "0.9", freq: "weekly" },
  ...entries.map(e => ({ loc: `${SITE}/how-americans-say/${e.slug}/`, pri: "0.7", freq: "monthly" })),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${TODAY}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`).join("\n")}
</urlset>
`;
writeFileSync(join(ROOT, "sitemap.xml"), sitemap);

console.log(`Generated ${entries.length} word pages + hub + sitemap (${urls.length} URLs).`);
console.log(`Skipped ${WORDS.length - entries.length} unchanged/duplicate candidates.`);
