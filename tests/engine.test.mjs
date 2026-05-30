/**
 * sayMerica engine tests
 *
 * The conversion engine lives inside index.html (single-file app). To avoid
 * duplicating logic, this test EXTRACTS the engine straight out of index.html
 * and runs it — so the tests can never drift from the real app.
 *
 *   Run:  node tests/engine.test.mjs   (or: npm test)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "index.html"), "utf8");

// Pull the <script> body, then keep only the pure-logic part (everything before
// the UI/DOM section). The DOM code would throw under Node; the engine doesn't.
const script = html.split("<script>")[1].split("</script>")[0];
const engineSrc = script.split("/* ----------------------------- UI")[0];
if (!/function convert\(/.test(engineSrc)) {
  console.error("Could not locate convert() in index.html — did the markers change?");
  process.exit(2);
}
const { convert } = new Function(engineSrc + "\n return { convert };")();

/* ----------------------------- tiny test runner --------------------------- */
let pass = 0, fail = 0;
const fails = [];

const opts = (level, extra = {}) => ({ level, weak: false, stops: false, ...extra });

function eq(input, level, expected, note = "") {
  const got = convert(input, opts(level));
  if (got === expected) { pass++; }
  else { fail++; fails.push({ input, level, expected, got, note }); }
}
function contains(input, level, needle, extra = {}, note = "") {
  const got = convert(input, opts(level, extra));
  if (got.includes(needle)) { pass++; }
  else { fail++; fails.push({ input, level, expected: `…contains "${needle}"`, got, note }); }
}

/* =============================== TEST CASES =============================== */

// --- Smarter regex: t-clusters that are really SH / CH (full mode) ----------
eq("nation",    "full", "Nashun");
eq("station",   "full", "Stashun");
eq("question",  "full", "Queschun");
eq("national",  "full", "Nashunal");
eq("picture",   "full", "Piccher");
eq("nature",    "full", "Nacher");
eq("natural",   "full", "Nachural");
eq("partial",   "full", "Parshul");
eq("ambitious", "full", "Ambishus");
eq("actual",    "full", "Akchual");   // dictionary-pinned (avoids ct->cch)

// --- Must NOT over-fire ----------------------------------------------------
eq("turn",    "full", "Turn");     // word-initial 'tur' protected
eq("until",   "full", "Until");    // nt-drop requires unstressed ending
eq("intend",  "full", "Intend");
eq("fortune", "full", "Fortune");  // rt rule excludes 't' before 'u'
eq("ring",    "full", "Ring");     // -ing monosyllables left alone
eq("king",    "full", "King");
eq("thing",   "full", "Thing");
eq("bring",   "full", "Bring");
eq("spring",  "full", "Spring");
eq("future",  "full", "Fucher");

// --- Flat T (both intensities), doubled spelling preserved -----------------
eq("water",  "full", "Wader");
eq("better", "full", "Bedder");
eq("butter", "full", "Budder");
eq("duty",   "full", "Dudy");
eq("cattle", "full", "Caddle");
eq("title",  "full", "Tidle");

// --- rt / nt / -ing / tr / dr (full mode) ----------------------------------
eq("party",      "full", "Pardy");
eq("dirty",      "full", "Dirdy");
eq("forty",      "full", "Fordy");
eq("winter",     "full", "Winer");
eq("talking",    "full", "Talkin");
eq("running",    "full", "Runnin");
eq("singing",    "full", "Singin");
eq("tree",       "full", "Chree");
eq("children",   "full", "Chiljren");

// --- Subtle vs Full: heavy reductions are full-only ------------------------
eq("nation",  "subtle", "Nation");   // sh/ch conversion is full-only
eq("picture", "subtle", "Picture");
eq("talking", "subtle", "Talking");  // -ing reduction full-only
eq("tree",    "subtle", "Tree");     // tr->chr full-only
eq("the",     "subtle", "The");
eq("the",     "full",   "Thuh");
eq("you",     "subtle", "You");
eq("you",     "full",   "Ya");
// Flat-T DOES run in subtle:
eq("water",   "subtle", "Wader");
eq("better",  "subtle", "Bedder");

// --- Curated dictionary: phrases, blends, words ----------------------------
eq("going to",       "full", "Gonna");
eq("want to",        "full", "Wanna");
eq("what are you",   "full", "Whatcha");
eq("i don't know",   "full", "I dunno");
eq("take it easy",   "full", "Tei-ki-dizzy");
eq("definitely",     "full", "Defin-ly");
eq("of",             "full", "Uv");
eq("remember",       "full", "Member");
eq("does not",       "full", "Dozen");
eq("because",        "full", "Cuz");      // SLANG, full-only
eq("because",        "subtle", "Because"); // untouched in subtle

// --- Expanded vocab: schwa-drops / elisions (both modes) -------------------
eq("usually",    "full", "Uzhally");
eq("government", "full", "Guvment");
eq("library",    "full", "Libry");
eq("wednesday",  "full", "Wensday");
eq("separate",   "full", "Seprit");
eq("clothes",    "full", "Cloze");
eq("photo",      "full", "Fodo");
eq("usually",    "subtle", "Uzhally");   // content-word elisions run in subtle too

// --- Expanded vocab: contraction blends (both modes) -----------------------
eq("do not",     "subtle", "Don't");
eq("do not",     "full",   "Don");      // -> don't -> (full) don
eq("i am",       "full",   "I'm");
eq("they are",   "subtle", "They're");   // blend only
eq("they are",   "full",   "Ther");      // blend -> they're -> (full) ther
eq("thank you",  "full",   "Thanks");

// --- Expanded vocab: function words & slang (full-only) --------------------
eq("from",   "full", "Frum");
eq("from",   "subtle", "From");    // full-only reduction
eq("there",  "full", "Ther");
eq("awesome","full", "Awsum");
eq("goodbye","full", "Bye");

// --- four -> for must NOT chain into for -> fur (POST_WORDS post-pass) ------
eq("four",         "full",   "For");
eq("four",         "subtle", "For");
eq("for",          "full",   "Fur");   // standalone 'for' still reduces
eq("four bottles", "full",   "For bottles");

// --- Ordering: multi-word slang not pre-empted by single-word reductions ---
eq("you all", "full", "Yall");        // SLANG runs before COMMON_FULL's you->ya
eq("does he", "full", "Duzzy");
eq("would he", "full", "Woody");
eq("it is cool", "full", "School");
eq("what i told you", "full", "Wha dai tol ju");

// --- Full sentence: phrases + reductions + capitalization ------------------
eq("What are you going to do? I want you to wait for me.", "full",
   "Whatcha gonna do? I wanchoo tuh weigh fur me.");

// --- Decoration: weak endings + stop-T markers -----------------------------
contains("club", "full", "[b]", { weak: true });                 // clu[b]
contains("hole", "full", 'class="stop"', { stops: true });       // ho + glottal marker

/* =============================== REPORT =================================== */
for (const f of fails) {
  console.log(`FAIL  [${f.level}] "${f.input}"`);
  console.log(`        expected: ${f.expected}`);
  console.log(`        got:      ${f.got}`);
}
console.log(`\n${pass} passed, ${fail} failed  (${pass + fail} total)`);
process.exit(fail ? 1 : 0);
