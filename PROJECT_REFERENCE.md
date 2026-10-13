# Siddur project reference

Start here when investigating a missing prayer, incorrect page, framing issue, or iPhone UI problem. This file is a project reference, not a replacement for checking current source or release state.

## Boundaries and current layout

- Repository: https://github.com/noach-bergman/sidur-beit-aharon-web
- Working branch: `codex/siddur-exterior-redesign`, in the `redesign/` worktree. The sibling `source/` checkout is the original baseline; do not edit or deploy it as part of the redesign.
- **Owner clarification, 2026-10-12:** “original” means the PDF-based GitHub app at baseline `e911ca18956de46467a590b518146a1a5d0fd334`, which was supplied for this redesign. It does not mean the older Java/text app from repository history. Use PDF scans for prayer reading; do not activate the recovered text reader or substitute text for missing scans.
- The owner wants the original prayer words preserved. Native framing is display-only. Do not recreate missing religious text from memory or substitute another edition without checking it.
- `docs/` supplies the native build and GitHub Pages source. Root `data/`, `css/`, `js/`, `siddur.pdf` mirror the web version. Check both copies when modifying shared content.
- Native changes do not automatically update the separately hosted Sites preview. The original site/main branch has not been deployed by this work.
- Internal TestFlight updates were authorized. On 2026-10-13 the owner authorized preparation toward an unlisted App Store release, then required that the public seller name not be personal. The current membership is Individual and no registered organization exists yet, so publication is blocked on publisher identity. App Store listing metadata is saved as a draft with manual release; no App Review or unlisted request has been submitted. See `native/release/unlisted-release.txt`.

## Find the right file

| Question | Source of truth / implementation |
| --- | --- |
| Is a printed page present? | `docs/data/toc.json`: `sequences`, `missingPrintedPages`, `entries[].pdfPage`; then visually inspect `docs/siddur.pdf` |
| Where does a named prayer open? | `docs/data/toc.json` and the prayer lookup table below |
| What appears in the menu/search? | `docs/data/menu.json`; `renderMenu` / `tocByTitle` in `docs/js/app.js` |
| Which prayer opens from Home today? | `docs/js/today.js` (`PAGES`, calendar rules); `renderToday` in `docs/js/app.js` |
| Where is a Tehillim perek? | `docs/data/tehillim.json`: `start`, `pages`, `books` |
| Which words are highlighted today? | `docs/data/highlights.json`, `scripts/highlights_spec.txt`, `scripts/build_highlights.py`, rules in `docs/js/today.js` |
| Why is a page cropped or sized this way? | `native/resources/page-crops.json`, `native/scripts/measure-page-margins.py`, `native/resources/native-reader.js` |
| Page-turn animation and header timing | `native/resources/page-turn.js`, `native/resources/page-curl-geometry.js`, `native/tests/page-turn.test.mjs` |
| Vertical/horizontal gestures | `native/resources/reader-gestures.js`, generated hooks in `native/scripts/build.mjs`, gesture tests |
| Fixed iPhone home layout | `native/resources/fixed-home.js`, `native/resources/native.css` |
| Home gate / gold styling | `docs/css/gate.css`, `docs/assets/siddur-gate-phone.png`; mirrored root assets/styles |
| iPhone first-launch guide | `native/resources/onboarding.js`, `guide-language.js`, `native.css`; hooks in `native/scripts/build.mjs` |
| App icon | `native/resources/app-icon-source.png` (owner supplied), `native/ios/App/App/Assets.xcassets/AppIcon.appiconset/` |
| iPhone safe areas / background | `native/capacitor.config.json`, `native/resources/native.css`, native LaunchScreen storyboard |
| Native bundling | `native/scripts/build.mjs`; `native/resources/native.js`; run `npm run sync` from `native/` |
| Release history / App Store checklist | `native/README.md`; recheck App Store Connect for current status |
| Build number / signing project | `native/ios/App/App.xcodeproj/project.pbxproj` |
| Internal-only upload settings | `native/ExportOptions.plist` |
| Generated assets: do not edit directly | `native/www/`, `native/ios/App/App/public/`, `native/build/` |
| Historical text-based converter, not active reader | `scripts/convert_texts.py`; it has old hard-coded workspace paths |

## Current intended iPhone behavior

- One fixed home screen, with full daily information available through the daily sheet when necessary. Gate fitting reserves 25% of gate width plus the bottom safe area above the decorative base; `ResizeObserver` refits late-changing labels and location text. Layout checked at 320×568, 375×667, and 393×852, including simulated safe areas and a busy-day fixture.
- All scanned pages use the audited fitted frame. The “מקור”/“התאמה” size toggle was removed in build 9.
- Side taps / horizontal swipes turn pages in Hebrew book direction. Up/down swipes reveal controls. Center tapping still toggles them. Header/footer remain outside the page animation.
- The jump-to-page control is hidden in the native reader. Close the reader to choose another prayer from Home.
- The ten-step guide defaults to the phone language (Hebrew for `he`/`iw`, English otherwise). Explicit selection is remembered; language buttons keep their positions. Replay through `עזרה` in the prayer menu.
- Guide storage: `siddur-guide-v1`, `siddur-guide-language`; bookmark: `sidur-bav-last-page`. Tour exit restores the bookmark.
- The life-cycle heading was removed. The later `ברית, פדיון ונישואין` category was also removed because all its entries have missing opening pages. Healing/memorial entries remain in `תפילות והוספות`.

## Numbering: never use one global offset

All PDF indexes below are **1-based**. The PDF has 315 scanned pages; numbering restarts in Tehillim and Minhagim. Exact sequence rules are generated below. Printed 3 is absent before printed 4; printed 81-84 are absent between PDF pages 79 and 80. Inserting pages shifts later PDF indexes and must update every affected lookup, highlight, Tehillim map, crop and page count; do not merely insert a PDF and leave the app indexes unchanged.

## Recovered original text app - 2026-10-12

The GitHub history contains an earlier app with separate prayer data and working button/menu definitions. It was replaced by the PDF reader in commit `2fdd7ac79b3e4e7be7ef3a2dda064b09813f1ec0` on 2026-09-20, before the isolated redesign. The latest original text version immediately before that change is `c41659659e02e85e1775fe26da7ce1364721bcd2`.

**Historical reference only. The owner explicitly rejected using this text version in the app; the required baseline is the later PDF app.** There are 19 expanded page files and 425 underlying text resources. The current remote `main` still uses the PDF version; these files are recovered from its history.

- Exact historical copies: [reference/original-text-app/](reference/original-text-app/).
- Provenance and SHA-256 for every recovered file: [PROVENANCE.json](reference/original-text-app/PROVENANCE.json).
- Original buttons: [data/menus.json](reference/original-text-app/data/menus.json), with seven first-menu actions and sixteen prayer choices.
- Original per-prayer index: [data/pages-index.json](reference/original-text-app/data/pages-index.json).
- ברית מילה: [s_brit.json](reference/original-text-app/data/pages/s_brit.json), 33 blocks including the ceremony, עלינו לשבח and ברכת המזון לברית מילה.
- שבע ברכות: [s_shevaBrachot.json](reference/original-text-app/data/pages/s_shevaBrachot.json), 8 blocks including wedding-meal Birkat Hamazon and Sheva Brachot. Do not equate this with the missing printed ברכות אירוסין ונשואין page without checking the actual content.
- Other original screens include אשר יצר, תפילה לעת רצון, לוח יארצייט, settings, help and zmanim.
- Raw converted resources: [data/texts.json](reference/original-text-app/data/texts.json). Recover original include/conditional intent here rather than guessing from a flattened text page.
- Old renderer and preferences: [js/app.js](reference/original-text-app/js/app.js). Historical conversion: [scripts/convert_texts.py](reference/original-text-app/scripts/convert_texts.py).

These are text resources, not the missing printed scans. Recovered files remain outside the app bundle and are byte-identical to Git history. The old generated prayer files say `weekday-default`; their converter simplified calendar conditions. Some resources contain include markers, alternative versions and encoded Divine Names. Verify presentation and conditional expansion before using them in the current app. Searches for the exact missing headings גאולה לברית, פדיון הבן and ברכות אירוסין did not find them in this text collection; this is not proof that every related passage is absent.

## Printed table-of-contents audit - 2026-10-12

The printed `תוכן ומפתח` is PDF page 2. All 62 numbered main-section entries were read from this page and matched against the index. All 57 previously linked scan destinations were visually checked. One wrong link was corrected: `סדר אלף בית`, printed ג (3), had incorrectly pointed to the table of contents itself. Printed ג is absent; the first numbered scan is printed ד (4) at PDF page 3. The remaining destinations are retained, including several prayers starting halfway down a shared page. Audit evidence and the independently transcribed page numbers are in [reference/printed-contents-audit.json](reference/printed-contents-audit.json). The PDF bytes remain unchanged.

## Known missing pages and source search - 2026-10-12

Confirmed visually: PDF page 79 is printed פ (80), ending פרשת המן / תפלה על הפרנסה. The next scan, PDF page 80, is printed פה (85), containing the continuation of סדר פדיון הבן and סדר נטילת ידים לסעודה. Printed פא-פד (81-84) were absent in the original baseline, before any redesign or crop work.

The opening alphabet page ג (3) is also absent. Affected entries: סדר אלף בית, ברכות אירוסין ונשואין, סדר ברית מילה, גאולה לברית מילה, and the opening of סדר פדיון הבן. At the owner's request, all five affected entries were removed from the visible menu and search on 2026-10-12. This includes סדר פדיון הבן because its opening is absent even though the continuation is present. The printed-contents metadata remains intact for reference; no PDF pages or words were removed.

| Source checked | Result / next use |
| --- | --- |
| [Original public PDF](https://stolin.info/stolin/SiddurBAV.pdf) | Downloaded again 2026-10-12; byte-identical to the app PDF. The same four pages are missing. SHA-256 appears below. |
| [Siddur app download site](https://sidurbav.com/) | Provides Android and Java phone applications, not a linked full-page PDF. Public JAR contains `s_brit`, `a_brit`, `britPsukimEI`, and wedding-blessing resources. These are a possible text-source lead, not verified replacement scans or an exact edition match. Inspected `s_brit` as CP1255 text without executing downloaded code. Its conditional markers and special font symbols need careful review before any reuse. Searches of archive text did not locate the other missing section titles. |
| [Matching printed-edition listing](https://www.antiqueseforim.com/ecommerce/sidvr-bit-ahrn-viwral-ltlmidim.html) | Describes the לתלמידים weekday edition, Jerusalem תש״ע, 235 main pages + 69 Tehillim + 11 Minhagim. This matches the apparent edition and pagination; availability and the missing pages themselves are not verified. Seller lists 718-438-8414 / seforim@gmail.com. The search index supplied the listing; a direct preview-image fetch timed out, so preview pages could not be inspected. No message or purchase was made. |
| [National Library author/catalog page](https://www.nli.org.il/he/a-topic/987007307084905171) | Search index lists a לתלמידים edition. Direct catalog fetch returned 403; no usable complete scan verified. |
| General title, PDF, English transliteration and HebrewBooks searches | No complete freely accessible matching scan found in the checked results. Older auctioned editions and the much longer השלם edition are not interchangeable. |

Next useful source: scans of printed פא, פב, פג, פד from the same edition, requested from the publisher/community or a holder of that edition. Compare printed 80 and 85 before accepting replacement pages. Do not send messages or purchase books without the owner's instruction.

## User-supplied replacement PDF check - 2026-10-12

The owner supplied another PDF through a Google download filename beginning `ACFrOgC_q_eNgwo3JMs`. Its SHA-256 is `8d2bac741c12e267be6d423b216ecd4b323fe0ab737ead695c8117c60c743860`; file length 5,764,916 bytes. It also contains 315 pages. Every corresponding page matched the current PDF's drawing streams, compressed images and JBIG2 globals, dimensions, rotation and annotation counts. There are no embedded files. Fresh renders confirmed PDF 79 = printed פ (80), PDF 80 = printed פה (85), PDF 81 = printed פו (86), ברכת המזון. Thus it does not supply the missing printed פא-פד; no remapping or source replacement was made. Evidence: [reference/user-pdf-comparison-2026-10-12.json](reference/user-pdf-comparison-2026-10-12.json). Treat this as a check of this particular attachment, not a conclusion about a different future PDF.

## Verification and refresh

From the repository root:

```sh
node scripts/build_reference.mjs
```

This refreshes the generated prayer and page indexes below and `reference/page-index.json`, checks mirrored data, and verifies the crop manifest's PDF fingerprint. It does not modify the app, PDF or prayer data. Rerun it after content/mapping changes.

From `native/`:

```sh
npm run sync
node scripts/verify.mjs
node --test tests/*.test.mjs
```

For page inspection, render the actual PDF page (not the printed number):

```sh
pdftoppm -f 79 -l 80 -r 150 -png docs/siddur.pdf /tmp/siddur-check
```

The full crop audit uses 120-DPI grayscale renders of all pages; see `native/scripts/measure-page-margins.py`. Ordinary reading frames are 390×648 PDF points; exceptional wide/table/art pages preserve the same display ratio. Source PDF bytes are never modified by that pipeline.

## Release lookup

- Bundle ID: `com.noachbergman.siddurbeitaharon`; App Store Connect app ID: `6821949673`.
- [TestFlight](https://appstoreconnect.apple.com/apps/6821949673/testflight).
- Latest recorded upload: 1.0.0 (14), `native/build/Siddur-14.xcarchive`; uploaded successfully on 2026-10-12 (`native/build/upload-14.log`, EXPORT SUCCEEDED). Reader annotation labels are now exactly `ברכנו` / `ברך עלנו`; the other home reminders are restored. Includes build 13 gate clearance fix. The original PDF is unchanged.
- Apple reported build 14 processing. Post-processing availability is not yet verified because the App Store Connect browser session expired. Build 12 was previously confirmed Testing in the existing two-person internal `testers` group. Physical-device acceptance of build 14 remains separate from build and simulator checks.
- Archives and temporary inspection PNGs are ignored local artifacts, not durable source references. Prefer the source paths and reproducible commands above.

<!-- GENERATED INDEX START -->

## Generated lookup indexes

Generated 2026-10-12T17:20:03.720Z. PDF SHA-256: `95b89872ec9853d8257b1c61c9e5b57947d8fff25ab34591e23be959c7666697`.

315 PDF pages; 66 indexed prayer/section entries; 18 menu categories. Machine-readable detail: [reference/page-index.json](reference/page-index.json). Nearest indexed headings below are navigation inferences, not OCR or a verified title for each individual scanned page.

### Numbering sequences

| Section | PDF from | PDF to | Printed = PDF + |
| --- | --- | --- | --- |
| main | 3 | 79 | 1 |
| main | 80 | 230 | 5 |
| tehillim | 233 | 302 | -231 |
| minhagim | 305 | 315 | -303 |

### Every indexed prayer and section

| Prayer / section | Menu group | Book section | Printed label / number | PDF page | Status / note |
| --- | --- | --- | --- | --- | --- |
| סדר אלף בית |  | main | ג / 3 | — | העמוד חסר בסריקה |
| סדר השכמת הבוקר | השכמת הבוקר | main | ד / 4 | 3 | Available |
| ברכות השחר | השכמת הבוקר | main | ה / 5 | 4 | Available |
| אני מאמין | השכמת הבוקר | main | ח / 8 | 7 | Available |
| פסוקים שאומרים עם הפעוטים | השכמת הבוקר | main | יב / 12 | 11 | Available |
| סדר לבישת טלית גדול | השכמת הבוקר | main | יג / 13 | 12 | Available |
| סדר הנחת תפילין | השכמת הבוקר | main | יד / 14 | 13 | Available |
| תפלת שחרית | שחרית | main | טו / 15 | 14 | Available |
| סליחות לבה״ב ושובבי״ם | צומות וסליחות | main | נג / 53 | 52 | Available |
| ברכת הגומל | שחרית | main | סו / 66 | 65 | Available |
| שש זכירות | שחרית | main | עז / 77 | 76 | Available |
| פרשת היראה | שחרית | main | עז / 77 | 76 | Available |
| פרשת התשובה | שחרית | main | עח / 78 | 77 | Available |
| פרשת המן | שחרית | main | עט / 79 | 78 | Available |
| ברכות אירוסין ונשואין |  | main | פא / 81 | — | העמוד חסר בסריקה |
| סדר ברית מילה |  | main | פב / 82 | — | העמוד חסר בסריקה |
| גאולה לברית מילה |  | main | פד / 84 | — | העמוד חסר בסריקה |
| סדר פדיון הבן |  | main | פד / 84 | 80 | תחילת הסדר בעמוד פ״ד החסר בסריקה; כאן ההמשך |
| סדר נטילת ידים לסעודה | ברכת המזון | main | פה / 85 | 80 | Available |
| ברכת המזון | ברכת המזון | main | פו / 86 | 81 | Available |
| ברכות הנהנין | ברכות הנהנין | main | צא / 91 | 86 | Available |
| ברכת מעין שלוש | ברכה אחרונה ומעין שלוש | main | צב / 92 | 87 | Available |
| ברכה אחרונה | ברכה אחרונה ומעין שלוש | main | צג / 93 | 88 | Available |
| ברכות הריח הראיה והשמיעה | ברכות הנהנין | main | צג / 93 | 88 | Available |
| ברכת האילנות | ברכות הנהנין | main | צד / 94 | 89 | Available |
| ברכות המצוות | ברכות הנהנין | main | צד / 94 | 89 | Available |
| תפלת הדרך | תפילת הדרך | main | צה / 95 | 90 | Available |
| תפלת מנחה לחול | מנחה | main | צו / 96 | 91 | Available |
| תפלת ערבית לחול | ערבית | main | קח / 108 | 103 | Available |
| ספירת העומר | ספירת העומר | main | קיט / 119 | 114 | Available |
| קריאת שמע שעל המטה | קריאת שמע שעל המיטה | main | קכד / 124 | 119 | Available |
| סדר קידוש לבנה | קידוש לבנה | main | קכח / 128 | 123 | Available |
| סדר תפלת יום כיפור קטן | מנחה | main | קלא / 131 | 126 | Available |
| סדר נטילת לולב | ימים נוראים | main | קמא / 141 | 136 | Available |
| סדר הלל | שחרית | main | קמא / 141 | 136 | Available |
| תפלת מוסף לראש חודש | שחרית | main | קמה / 145 | 140 | Available |
| סדר הדלקת נר חנוכה | חנוכה | main | קנא / 151 | 146 | Available |
| סדר מזמורים לחנוכה | חנוכה | main | קנב / 152 | 147 | Available |
| מעוז צור | חנוכה | main | קסא / 161 | 156 | Available |
| סדר ברכות המגילה | פורים | main | קסב / 162 | 157 | Available |
| זמירות לזאת חנוכה ופורים | חנוכה | main | קסג / 163 | 158 | Available |
| זמירות לסעודות ההילולא | תפילות והוספות | main | קסד / 164 | 159 | Available |
| שירים לל״ג בעומר | תפילות והוספות | main | קסה / 165 | 160 | Available |
| סדר התרת נדרים | ימים נוראים | main | קסח / 168 | 163 | Available |
| סדר תשליך | ימים נוראים | main | קעא / 171 | 166 | Available |
| סדר כפרות | ימים נוראים | main | קעב / 172 | 167 | Available |
| סליחות לעשרה בטבת | צומות וסליחות | main | קעד / 174 | 169 | Available |
| סליחות לתענית אסתר | צומות וסליחות | main | קפב / 182 | 177 | Available |
| סליחות לשבעה עשר בתמוז | צומות וסליחות | main | קפו / 186 | 181 | Available |
| סדר הפרשיות לשני וחמישי | שחרית | main | קצ / 190 | 185 | Available |
| קריאה לראש חודש | שחרית | main | רכ / 220 | 215 | Available |
| קריאה לחנוכה | חנוכה | main | רכא / 221 | 216 | Available |
| קריאה לפורים | פורים | main | רכד / 224 | 219 | Available |
| קריאה לתענית ציבור | צומות וסליחות | main | רכה / 225 | 220 | Available |
| הפטרה לתענית ציבור | צומות וסליחות | main | רכו / 226 | 221 | Available |
| מי שברך לחולה וליולדת | תפילות והוספות | main | רכז / 227 | 222 | Available |
| אל מלא להזכרת נשמות | תפילות והוספות | main | רכח / 228 | 223 | Available |
| סדר קבלת תענית | צומות וסליחות | main | רכט / 229 | 224 | Available |
| סדר הפרשת תרומות ומעשרות | תפילות והוספות | main | רכט / 229 | 224 | Available |
| סדר ברכת החמה | תפילות והוספות | main | רל / 230 | 225 | Available |
| פסוקים לשמות אנשים | תפילות והוספות | main | רלב / 232 | 227 | Available |
| תפלת בית המדרש | תפילות והוספות | main | רלה / 235 | 230 | Available |
| לוח קביעת השנים | תפילות והוספות | main |  / — | 231 | עמוד ללא מספור |
| ספר תהלים | ספר תהלים | tehillim | ב / 2 | 233 | Available |
| מנהגים מרבותינו הקדושים מסטולין קרלין | מנהגים ודינים | minhagim | ב / 2 | 305 | Available |
| דינים למי שטעה בתפלת שמו״ע | מנהגים ודינים | minhagim | יב / 12 | 315 | Available |

### Original text app pages and buttons

Recovered historical source, not currently included in the native bundle. Raw resource lookup: [reference/original-text-index.json](reference/original-text-index.json).

| Original button / page | Resource | Expanded blocks | Exact file |
| --- | --- | --- | --- |
| השכמת הבוקר | s_ashkama | 29 | reference/original-text-app/data/pages/s_ashkama.json |
| שחרית | s_shacharit | 94 | reference/original-text-app/data/pages/s_shacharit.json |
| מנחה | s_mincha | 24 | reference/original-text-app/data/pages/s_mincha.json |
| ערבית | s_arvit | 51 | reference/original-text-app/data/pages/s_arvit.json |
| קריאת שמע שעל המיטה | s_mita | 12 | reference/original-text-app/data/pages/s_mita.json |
| ברכת המזון | s_mazon | 4 | reference/original-text-app/data/pages/s_mazon.json |
| מעין שלוש | s_shalosh | 19 | reference/original-text-app/data/pages/s_shalosh.json |
| שבע ברכות | s_shevaBrachot | 8 | reference/original-text-app/data/pages/s_shevaBrachot.json |
| סדר ברית מילה | s_brit | 33 | reference/original-text-app/data/pages/s_brit.json |
| ברכות הנהנין | s_nefashot | 12 | reference/original-text-app/data/pages/s_nefashot.json |
| אשר יצר | s_yatzar | 1 | reference/original-text-app/data/pages/s_yatzar.json |
| תפילת הדרך | s_derech | 1 | reference/original-text-app/data/pages/s_derech.json |
| תפילות והוספות | s_tfilot | 15 | reference/original-text-app/data/pages/s_tfilot.json |
| קידוש לבנה | s_levana | 11 | reference/original-text-app/data/pages/s_levana.json |
| ספירת העומר | s_omer | 7 | reference/original-text-app/data/pages/s_omer.json |
| הדלקת נרות חנוכה ומזמורים | s_nerot | 8 | reference/original-text-app/data/pages/s_nerot.json |
| עזרה | help | 33 | reference/original-text-app/data/pages/help.json |
| תפילה לעת רצון | tzahal | 172 | reference/original-text-app/data/pages/tzahal.json |
| לוח יארצייט | yortzait | 41 | reference/original-text-app/data/pages/yortzait.json |

### Every scanned page

| PDF page | Section | Printed number | Starts on this page | Nearest indexed heading (inferred) | Tehillim chapters | Frame kind | Highlight entries |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | unnumbered | — | שער / cover | — |  | cover | 0 |
| 2 | unnumbered | — | תוכן ומפתח / contents | — |  | reading | 0 |
| 3 | main | 4 | סדר השכמת הבוקר | סדר השכמת הבוקר |  | reading | 0 |
| 4 | main | 5 | ברכות השחר | ברכות השחר |  | reading | 0 |
| 5 | main | 6 | — | ברכות השחר |  | reading | 0 |
| 6 | main | 7 | — | ברכות השחר |  | reading | 0 |
| 7 | main | 8 | אני מאמין | אני מאמין |  | reading | 0 |
| 8 | main | 9 | — | אני מאמין |  | reading | 0 |
| 9 | main | 10 | — | אני מאמין |  | reading | 0 |
| 10 | main | 11 | — | אני מאמין |  | reading | 1 |
| 11 | main | 12 | פסוקים שאומרים עם הפעוטים | פסוקים שאומרים עם הפעוטים |  | reading | 1 |
| 12 | main | 13 | סדר לבישת טלית גדול | סדר לבישת טלית גדול |  | reading | 0 |
| 13 | main | 14 | סדר הנחת תפילין | סדר הנחת תפילין |  | reading | 0 |
| 14 | main | 15 | תפלת שחרית | תפלת שחרית |  | reading | 0 |
| 15 | main | 16 | — | תפלת שחרית |  | reading | 0 |
| 16 | main | 17 | — | תפלת שחרית |  | reading | 0 |
| 17 | main | 18 | — | תפלת שחרית |  | reading | 1 |
| 18 | main | 19 | — | תפלת שחרית |  | reading | 0 |
| 19 | main | 20 | — | תפלת שחרית |  | reading | 1 |
| 20 | main | 21 | — | תפלת שחרית |  | reading | 1 |
| 21 | main | 22 | — | תפלת שחרית |  | reading | 0 |
| 22 | main | 23 | — | תפלת שחרית |  | reading | 0 |
| 23 | main | 24 | — | תפלת שחרית |  | reading | 1 |
| 24 | main | 25 | — | תפלת שחרית |  | reading | 0 |
| 25 | main | 26 | — | תפלת שחרית |  | reading | 1 |
| 26 | main | 27 | — | תפלת שחרית |  | reading | 0 |
| 27 | main | 28 | — | תפלת שחרית |  | reading | 1 |
| 28 | main | 29 | — | תפלת שחרית |  | reading | 2 |
| 29 | main | 30 | — | תפלת שחרית |  | reading | 0 |
| 30 | main | 31 | — | תפלת שחרית |  | reading | 0 |
| 31 | main | 32 | — | תפלת שחרית |  | reading | 0 |
| 32 | main | 33 | — | תפלת שחרית |  | reading | 0 |
| 33 | main | 34 | — | תפלת שחרית |  | reading | 0 |
| 34 | main | 35 | — | תפלת שחרית |  | reading | 0 |
| 35 | main | 36 | — | תפלת שחרית |  | reading | 0 |
| 36 | main | 37 | — | תפלת שחרית |  | reading | 2 |
| 37 | main | 38 | — | תפלת שחרית |  | reading | 0 |
| 38 | main | 39 | — | תפלת שחרית |  | reading | 0 |
| 39 | main | 40 | — | תפלת שחרית |  | reading | 0 |
| 40 | main | 41 | — | תפלת שחרית |  | reading | 0 |
| 41 | main | 42 | — | תפלת שחרית |  | reading | 0 |
| 42 | main | 43 | — | תפלת שחרית |  | reading | 3 |
| 43 | main | 44 | — | תפלת שחרית |  | reading | 2 |
| 44 | main | 45 | — | תפלת שחרית |  | reading | 3 |
| 45 | main | 46 | — | תפלת שחרית |  | reading | 1 |
| 46 | main | 47 | — | תפלת שחרית |  | reading | 0 |
| 47 | main | 48 | — | תפלת שחרית |  | reading | 4 |
| 48 | main | 49 | — | תפלת שחרית |  | reading | 4 |
| 49 | main | 50 | — | תפלת שחרית |  | reading | 0 |
| 50 | main | 51 | — | תפלת שחרית |  | reading | 4 |
| 51 | main | 52 | — | תפלת שחרית |  | reading | 1 |
| 52 | main | 53 | סליחות לבה״ב ושובבי״ם | סליחות לבה״ב ושובבי״ם |  | reading | 3 |
| 53 | main | 54 | — | סליחות לבה״ב ושובבי״ם |  | reading | 2 |
| 54 | main | 55 | — | סליחות לבה״ב ושובבי״ם |  | reading | 3 |
| 55 | main | 56 | — | סליחות לבה״ב ושובבי״ם |  | reading | 8 |
| 56 | main | 57 | — | סליחות לבה״ב ושובבי״ם |  | reading | 4 |
| 57 | main | 58 | — | סליחות לבה״ב ושובבי״ם |  | reading | 2 |
| 58 | main | 59 | — | סליחות לבה״ב ושובבי״ם |  | reading | 2 |
| 59 | main | 60 | — | סליחות לבה״ב ושובבי״ם |  | reading | 2 |
| 60 | main | 61 | — | סליחות לבה״ב ושובבי״ם |  | reading | 2 |
| 61 | main | 62 | — | סליחות לבה״ב ושובבי״ם |  | reading | 1 |
| 62 | main | 63 | — | סליחות לבה״ב ושובבי״ם |  | reading | 6 |
| 63 | main | 64 | — | סליחות לבה״ב ושובבי״ם |  | reading | 3 |
| 64 | main | 65 | — | סליחות לבה״ב ושובבי״ם |  | reading | 2 |
| 65 | main | 66 | ברכת הגומל | ברכת הגומל |  | reading | 4 |
| 66 | main | 67 | — | ברכת הגומל |  | reading | 1 |
| 67 | main | 68 | — | ברכת הגומל |  | reading | 1 |
| 68 | main | 69 | — | ברכת הגומל |  | reading | 3 |
| 69 | main | 70 | — | ברכת הגומל |  | reading | 2 |
| 70 | main | 71 | — | ברכת הגומל |  | reading | 3 |
| 71 | main | 72 | — | ברכת הגומל |  | reading | 3 |
| 72 | main | 73 | — | ברכת הגומל |  | reading | 3 |
| 73 | main | 74 | — | ברכת הגומל |  | reading | 1 |
| 74 | main | 75 | — | ברכת הגומל |  | reading | 1 |
| 75 | main | 76 | — | ברכת הגומל |  | reading | 1 |
| 76 | main | 77 | שש זכירות / פרשת היראה | שש זכירות |  | reading | 0 |
| 77 | main | 78 | פרשת התשובה | פרשת התשובה |  | reading | 0 |
| 78 | main | 79 | פרשת המן | פרשת המן |  | reading | 1 |
| 79 | main | 80 | — | פרשת המן |  | reading | 1 |
| 80 | main | 85 | סדר פדיון הבן / סדר נטילת ידים לסעודה | סדר פדיון הבן |  | reading | 0 |
| 81 | main | 86 | ברכת המזון | ברכת המזון |  | reading | 1 |
| 82 | main | 87 | — | ברכת המזון |  | reading | 3 |
| 83 | main | 88 | — | ברכת המזון |  | reading | 4 |
| 84 | main | 89 | — | ברכת המזון |  | reading | 7 |
| 85 | main | 90 | — | ברכת המזון |  | reading | 4 |
| 86 | main | 91 | ברכות הנהנין | ברכות הנהנין |  | reading | 4 |
| 87 | main | 92 | ברכת מעין שלוש | ברכת מעין שלוש |  | reading | 4 |
| 88 | main | 93 | ברכה אחרונה / ברכות הריח הראיה והשמיעה | ברכה אחרונה |  | reading | 0 |
| 89 | main | 94 | ברכת האילנות / ברכות המצוות | ברכת האילנות |  | reading | 1 |
| 90 | main | 95 | תפלת הדרך | תפלת הדרך |  | reading | 0 |
| 91 | main | 96 | תפלת מנחה לחול | תפלת מנחה לחול |  | reading | 0 |
| 92 | main | 97 | — | תפלת מנחה לחול |  | reading | 2 |
| 93 | main | 98 | — | תפלת מנחה לחול |  | reading | 6 |
| 94 | main | 99 | — | תפלת מנחה לחול |  | reading | 3 |
| 95 | main | 100 | — | תפלת מנחה לחול |  | reading | 3 |
| 96 | main | 101 | — | תפלת מנחה לחול |  | reading | 6 |
| 97 | main | 102 | — | תפלת מנחה לחול |  | reading | 4 |
| 98 | main | 103 | — | תפלת מנחה לחול |  | reading | 3 |
| 99 | main | 104 | — | תפלת מנחה לחול |  | reading | 3 |
| 100 | main | 105 | — | תפלת מנחה לחול |  | reading | 3 |
| 101 | main | 106 | — | תפלת מנחה לחול |  | reading | 3 |
| 102 | main | 107 | — | תפלת מנחה לחול |  | reading | 1 |
| 103 | main | 108 | תפלת ערבית לחול | תפלת ערבית לחול |  | reading | 3 |
| 104 | main | 109 | — | תפלת ערבית לחול |  | reading | 0 |
| 105 | main | 110 | — | תפלת ערבית לחול |  | reading | 0 |
| 106 | main | 111 | — | תפלת ערבית לחול |  | reading | 4 |
| 107 | main | 112 | — | תפלת ערבית לחול |  | reading | 7 |
| 108 | main | 113 | — | תפלת ערבית לחול |  | reading | 1 |
| 109 | main | 114 | — | תפלת ערבית לחול |  | reading | 7 |
| 110 | main | 115 | — | תפלת ערבית לחול |  | reading | 4 |
| 111 | main | 116 | — | תפלת ערבית לחול |  | reading | 2 |
| 112 | main | 117 | — | תפלת ערבית לחול |  | reading | 2 |
| 113 | main | 118 | — | תפלת ערבית לחול |  | reading | 3 |
| 114 | main | 119 | ספירת העומר | ספירת העומר |  | reading | 4 |
| 115 | main | 120 | — | ספירת העומר |  | reading | 20 |
| 116 | main | 121 | — | ספירת העומר |  | reading | 16 |
| 117 | main | 122 | — | ספירת העומר |  | reading | 14 |
| 118 | main | 123 | — | ספירת העומר |  | reading | 1 |
| 119 | main | 124 | קריאת שמע שעל המטה | קריאת שמע שעל המטה |  | reading | 0 |
| 120 | main | 125 | — | קריאת שמע שעל המטה |  | reading | 0 |
| 121 | main | 126 | — | קריאת שמע שעל המטה |  | reading | 0 |
| 122 | main | 127 | — | קריאת שמע שעל המטה |  | reading | 0 |
| 123 | main | 128 | סדר קידוש לבנה | סדר קידוש לבנה |  | reading | 0 |
| 124 | main | 129 | — | סדר קידוש לבנה |  | reading | 0 |
| 125 | main | 130 | — | סדר קידוש לבנה |  | reading | 0 |
| 126 | main | 131 | סדר תפלת יום כיפור קטן | סדר תפלת יום כיפור קטן |  | reading | 0 |
| 127 | main | 132 | — | סדר תפלת יום כיפור קטן |  | reading | 0 |
| 128 | main | 133 | — | סדר תפלת יום כיפור קטן |  | reading | 0 |
| 129 | main | 134 | — | סדר תפלת יום כיפור קטן |  | reading | 0 |
| 130 | main | 135 | — | סדר תפלת יום כיפור קטן |  | reading | 0 |
| 131 | main | 136 | — | סדר תפלת יום כיפור קטן |  | reading | 0 |
| 132 | main | 137 | — | סדר תפלת יום כיפור קטן |  | reading | 0 |
| 133 | main | 138 | — | סדר תפלת יום כיפור קטן |  | reading | 0 |
| 134 | main | 139 | — | סדר תפלת יום כיפור קטן |  | reading | 0 |
| 135 | main | 140 | — | סדר תפלת יום כיפור קטן |  | reading | 0 |
| 136 | main | 141 | סדר נטילת לולב / סדר הלל | סדר נטילת לולב |  | reading | 0 |
| 137 | main | 142 | — | סדר נטילת לולב |  | reading | 0 |
| 138 | main | 143 | — | סדר נטילת לולב |  | reading | 0 |
| 139 | main | 144 | — | סדר נטילת לולב |  | reading | 0 |
| 140 | main | 145 | תפלת מוסף לראש חודש | תפלת מוסף לראש חודש |  | reading | 0 |
| 141 | main | 146 | — | תפלת מוסף לראש חודש |  | reading | 0 |
| 142 | main | 147 | — | תפלת מוסף לראש חודש |  | reading | 0 |
| 143 | main | 148 | — | תפלת מוסף לראש חודש |  | reading | 0 |
| 144 | main | 149 | — | תפלת מוסף לראש חודש |  | reading | 0 |
| 145 | main | 150 | — | תפלת מוסף לראש חודש |  | reading | 0 |
| 146 | main | 151 | סדר הדלקת נר חנוכה | סדר הדלקת נר חנוכה |  | reading | 0 |
| 147 | main | 152 | סדר מזמורים לחנוכה | סדר מזמורים לחנוכה |  | reading | 0 |
| 148 | main | 153 | — | סדר מזמורים לחנוכה |  | reading | 0 |
| 149 | main | 154 | — | סדר מזמורים לחנוכה |  | reading | 0 |
| 150 | main | 155 | — | סדר מזמורים לחנוכה |  | reading | 0 |
| 151 | main | 156 | — | סדר מזמורים לחנוכה |  | reading | 0 |
| 152 | main | 157 | — | סדר מזמורים לחנוכה |  | reading | 0 |
| 153 | main | 158 | — | סדר מזמורים לחנוכה |  | reading | 0 |
| 154 | main | 159 | — | סדר מזמורים לחנוכה |  | reading | 0 |
| 155 | main | 160 | — | סדר מזמורים לחנוכה |  | reading | 0 |
| 156 | main | 161 | מעוז צור | מעוז צור |  | reading | 0 |
| 157 | main | 162 | סדר ברכות המגילה | סדר ברכות המגילה |  | reading | 0 |
| 158 | main | 163 | זמירות לזאת חנוכה ופורים | זמירות לזאת חנוכה ופורים |  | reading | 0 |
| 159 | main | 164 | זמירות לסעודות ההילולא | זמירות לסעודות ההילולא |  | reading | 0 |
| 160 | main | 165 | שירים לל״ג בעומר | שירים לל״ג בעומר |  | reading | 0 |
| 161 | main | 166 | — | שירים לל״ג בעומר |  | reading | 0 |
| 162 | main | 167 | — | שירים לל״ג בעומר |  | reading | 0 |
| 163 | main | 168 | סדר התרת נדרים | סדר התרת נדרים |  | reading | 0 |
| 164 | main | 169 | — | סדר התרת נדרים |  | reading | 0 |
| 165 | main | 170 | — | סדר התרת נדרים |  | reading | 0 |
| 166 | main | 171 | סדר תשליך | סדר תשליך |  | reading | 0 |
| 167 | main | 172 | סדר כפרות | סדר כפרות |  | reading | 0 |
| 168 | main | 173 | — | סדר כפרות |  | reading | 0 |
| 169 | main | 174 | סליחות לעשרה בטבת | סליחות לעשרה בטבת |  | reading | 0 |
| 170 | main | 175 | — | סליחות לעשרה בטבת |  | reading | 0 |
| 171 | main | 176 | — | סליחות לעשרה בטבת |  | reading | 0 |
| 172 | main | 177 | — | סליחות לעשרה בטבת |  | reading | 0 |
| 173 | main | 178 | — | סליחות לעשרה בטבת |  | reading | 0 |
| 174 | main | 179 | — | סליחות לעשרה בטבת |  | reading | 0 |
| 175 | main | 180 | — | סליחות לעשרה בטבת |  | reading | 0 |
| 176 | main | 181 | — | סליחות לעשרה בטבת |  | reading | 0 |
| 177 | main | 182 | סליחות לתענית אסתר | סליחות לתענית אסתר |  | reading | 0 |
| 178 | main | 183 | — | סליחות לתענית אסתר |  | reading | 0 |
| 179 | main | 184 | — | סליחות לתענית אסתר |  | reading | 0 |
| 180 | main | 185 | — | סליחות לתענית אסתר |  | reading | 0 |
| 181 | main | 186 | סליחות לשבעה עשר בתמוז | סליחות לשבעה עשר בתמוז |  | reading | 0 |
| 182 | main | 187 | — | סליחות לשבעה עשר בתמוז |  | reading | 0 |
| 183 | main | 188 | — | סליחות לשבעה עשר בתמוז |  | reading | 0 |
| 184 | main | 189 | — | סליחות לשבעה עשר בתמוז |  | reading | 0 |
| 185 | main | 190 | סדר הפרשיות לשני וחמישי | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 186 | main | 191 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 187 | main | 192 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 188 | main | 193 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 189 | main | 194 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 190 | main | 195 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 191 | main | 196 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 192 | main | 197 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 193 | main | 198 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 194 | main | 199 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 195 | main | 200 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 196 | main | 201 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 197 | main | 202 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 198 | main | 203 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 199 | main | 204 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 200 | main | 205 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 201 | main | 206 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 202 | main | 207 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 203 | main | 208 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 204 | main | 209 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 205 | main | 210 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 206 | main | 211 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 207 | main | 212 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 208 | main | 213 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 209 | main | 214 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 210 | main | 215 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 211 | main | 216 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 212 | main | 217 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 213 | main | 218 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 214 | main | 219 | — | סדר הפרשיות לשני וחמישי |  | reading | 0 |
| 215 | main | 220 | קריאה לראש חודש | קריאה לראש חודש |  | reading | 0 |
| 216 | main | 221 | קריאה לחנוכה | קריאה לחנוכה |  | reading | 0 |
| 217 | main | 222 | — | קריאה לחנוכה |  | reading | 0 |
| 218 | main | 223 | — | קריאה לחנוכה |  | reading | 0 |
| 219 | main | 224 | קריאה לפורים | קריאה לפורים |  | reading | 0 |
| 220 | main | 225 | קריאה לתענית ציבור | קריאה לתענית ציבור |  | reading | 0 |
| 221 | main | 226 | הפטרה לתענית ציבור | הפטרה לתענית ציבור |  | reading | 0 |
| 222 | main | 227 | מי שברך לחולה וליולדת | מי שברך לחולה וליולדת |  | reading | 0 |
| 223 | main | 228 | אל מלא להזכרת נשמות | אל מלא להזכרת נשמות |  | reading | 0 |
| 224 | main | 229 | סדר קבלת תענית / סדר הפרשת תרומות ומעשרות | סדר קבלת תענית |  | reading | 0 |
| 225 | main | 230 | סדר ברכת החמה | סדר ברכת החמה |  | reading | 0 |
| 226 | main | 231 | — | סדר ברכת החמה |  | reading | 0 |
| 227 | main | 232 | פסוקים לשמות אנשים | פסוקים לשמות אנשים |  | reading | 0 |
| 228 | main | 233 | — | פסוקים לשמות אנשים |  | reading | 0 |
| 229 | main | 234 | — | פסוקים לשמות אנשים |  | reading | 0 |
| 230 | main | 235 | תפלת בית המדרש | תפלת בית המדרש |  | reading | 0 |
| 231 | unnumbered | — | לוח קביעת השנים | — |  | wide | 0 |
| 232 | unnumbered | — | שער תהלים / Tehillim cover | — |  | reading | 0 |
| 233 | tehillim | 2 | ספר תהלים | ספר תהלים |  | reading | 0 |
| 234 | tehillim | 3 | — | ספר תהלים | 1, 2, 3, 4 | reading | 0 |
| 235 | tehillim | 4 | — | ספר תהלים | 4, 5, 6, 7 | reading | 0 |
| 236 | tehillim | 5 | — | ספר תהלים | 7, 8, 9, 10 | reading | 0 |
| 237 | tehillim | 6 | — | ספר תהלים | 10, 11, 12, 13 | reading | 0 |
| 238 | tehillim | 7 | — | ספר תהלים | 13, 14, 15, 16, 17 | reading | 0 |
| 239 | tehillim | 8 | — | ספר תהלים | 17, 18 | reading | 0 |
| 240 | tehillim | 9 | — | ספר תהלים | 18, 19, 20 | reading | 0 |
| 241 | tehillim | 10 | — | ספר תהלים | 20, 21, 22 | reading | 0 |
| 242 | tehillim | 11 | — | ספר תהלים | 22, 23, 24, 25 | reading | 0 |
| 243 | tehillim | 12 | — | ספר תהלים | 25, 26, 27 | reading | 0 |
| 244 | tehillim | 13 | — | ספר תהלים | 27, 28, 29, 30 | reading | 0 |
| 245 | tehillim | 14 | — | ספר תהלים | 30, 31, 32 | reading | 0 |
| 246 | tehillim | 15 | — | ספר תהלים | 32, 33, 34 | reading | 0 |
| 247 | tehillim | 16 | — | ספר תהלים | 34, 35 | reading | 0 |
| 248 | tehillim | 17 | — | ספר תהלים | 36, 37 | reading | 0 |
| 249 | tehillim | 18 | — | ספר תהלים | 37, 38, 39 | reading | 0 |
| 250 | tehillim | 19 | — | ספר תהלים | 39, 40, 41 | reading | 0 |
| 251 | tehillim | 20 | — | ספר תהלים | 41, 42, 43, 44 | reading | 0 |
| 252 | tehillim | 21 | — | ספר תהלים | 44, 45 | reading | 0 |
| 253 | tehillim | 22 | — | ספר תהלים | 45, 46, 47, 48 | reading | 0 |
| 254 | tehillim | 23 | — | ספר תהלים | 48, 49, 50 | reading | 0 |
| 255 | tehillim | 24 | — | ספר תהלים | 50, 51, 52 | reading | 0 |
| 256 | tehillim | 25 | — | ספר תהלים | 53, 54, 55 | reading | 0 |
| 257 | tehillim | 26 | — | ספר תהלים | 55, 56, 57, 58 | reading | 0 |
| 258 | tehillim | 27 | — | ספר תהלים | 58, 59, 60 | reading | 0 |
| 259 | tehillim | 28 | — | ספר תהלים | 60, 61, 62, 63 | reading | 0 |
| 260 | tehillim | 29 | — | ספר תהלים | 64, 65, 66 | reading | 0 |
| 261 | tehillim | 30 | — | ספר תהלים | 66, 67, 68 | reading | 0 |
| 262 | tehillim | 31 | — | ספר תהלים | 68, 69 | reading | 0 |
| 263 | tehillim | 32 | — | ספר תהלים | 69, 70, 71 | reading | 0 |
| 264 | tehillim | 33 | — | ספר תהלים | 71, 72, 73 | reading | 0 |
| 265 | tehillim | 34 | — | ספר תהלים | 73, 74 | reading | 0 |
| 266 | tehillim | 35 | — | ספר תהלים | 74, 75, 76, 77 | reading | 0 |
| 267 | tehillim | 36 | — | ספר תהלים | 77, 78 | reading | 0 |
| 268 | tehillim | 37 | — | ספר תהלים | 78, 79 | reading | 0 |
| 269 | tehillim | 38 | — | ספר תהלים | 79, 80, 81 | reading | 0 |
| 270 | tehillim | 39 | — | ספר תהלים | 81, 82, 83, 84 | reading | 0 |
| 271 | tehillim | 40 | — | ספר תהלים | 84, 85, 86 | reading | 0 |
| 272 | tehillim | 41 | — | ספר תהלים | 86, 87, 88, 89 | reading | 0 |
| 273 | tehillim | 42 | — | ספר תהלים | 89 | reading | 0 |
| 274 | tehillim | 43 | — | ספר תהלים | 90, 91, 92 | reading | 0 |
| 275 | tehillim | 44 | — | ספר תהלים | 92, 93, 94 | reading | 0 |
| 276 | tehillim | 45 | — | ספר תהלים | 94, 95, 96, 97 | reading | 0 |
| 277 | tehillim | 46 | — | ספר תהלים | 97, 98, 99, 100, 101 | reading | 0 |
| 278 | tehillim | 47 | — | ספר תהלים | 101, 102, 103 | reading | 0 |
| 279 | tehillim | 48 | — | ספר תהלים | 103, 104 | reading | 0 |
| 280 | tehillim | 49 | — | ספר תהלים | 104, 105 | reading | 0 |
| 281 | tehillim | 50 | — | ספר תהלים | 105, 106 | reading | 0 |
| 282 | tehillim | 51 | — | ספר תהלים | 106, 107 | reading | 0 |
| 283 | tehillim | 52 | — | ספר תהלים | 107, 108, 109 | reading | 0 |
| 284 | tehillim | 53 | — | ספר תהלים | 109, 110, 111, 112 | reading | 0 |
| 285 | tehillim | 54 | — | ספר תהלים | 112, 113, 114, 115 | reading | 0 |
| 286 | tehillim | 55 | — | ספר תהלים | 116, 117, 118 | reading | 0 |
| 287 | tehillim | 56 | — | ספר תהלים | 118, 119 | reading | 0 |
| 288 | tehillim | 57 | — | ספר תהלים | 119 | reading | 0 |
| 289 | tehillim | 58 | — | ספר תהלים | 119 | reading | 0 |
| 290 | tehillim | 59 | — | ספר תהלים | 119, 120 | reading | 0 |
| 291 | tehillim | 60 | — | ספר תהלים | 121, 122, 123, 124, 125 | reading | 0 |
| 292 | tehillim | 61 | — | ספר תהלים | 126, 127, 128, 129, 130 | reading | 0 |
| 293 | tehillim | 62 | — | ספר תהלים | 131, 132, 133, 134, 135 | reading | 0 |
| 294 | tehillim | 63 | — | ספר תהלים | 135, 136, 137 | reading | 0 |
| 295 | tehillim | 64 | — | ספר תהלים | 137, 138, 139 | reading | 0 |
| 296 | tehillim | 65 | — | ספר תהלים | 140, 141, 142 | reading | 0 |
| 297 | tehillim | 66 | — | ספר תהלים | 143, 144, 145 | reading | 0 |
| 298 | tehillim | 67 | — | ספר תהלים | 145, 146, 147 | reading | 0 |
| 299 | tehillim | 68 | — | ספר תהלים | 147, 148, 149, 150 | reading | 0 |
| 300 | tehillim | 69 | — | ספר תהלים |  | reading | 0 |
| 301 | tehillim | 70 | — | ספר תהלים |  | reading | 0 |
| 302 | tehillim | 71 | — | ספר תהלים |  | reading | 0 |
| 303 | unnumbered | — | עמוד ללא מספור / unnumbered page | — |  | reading | 0 |
| 304 | unnumbered | — | שער מנהגים / Minhagim cover | — |  | wide | 0 |
| 305 | minhagim | 2 | מנהגים מרבותינו הקדושים מסטולין קרלין | מנהגים מרבותינו הקדושים מסטולין קרלין |  | reading | 0 |
| 306 | minhagim | 3 | — | מנהגים מרבותינו הקדושים מסטולין קרלין |  | reading | 0 |
| 307 | minhagim | 4 | — | מנהגים מרבותינו הקדושים מסטולין קרלין |  | reading | 0 |
| 308 | minhagim | 5 | — | מנהגים מרבותינו הקדושים מסטולין קרלין |  | reading | 0 |
| 309 | minhagim | 6 | — | מנהגים מרבותינו הקדושים מסטולין קרלין |  | reading | 0 |
| 310 | minhagim | 7 | — | מנהגים מרבותינו הקדושים מסטולין קרלין |  | reading | 0 |
| 311 | minhagim | 8 | — | מנהגים מרבותינו הקדושים מסטולין קרלין |  | reading | 0 |
| 312 | minhagim | 9 | — | מנהגים מרבותינו הקדושים מסטולין קרלין |  | reading | 0 |
| 313 | minhagim | 10 | — | מנהגים מרבותינו הקדושים מסטולין קרלין |  | reading | 0 |
| 314 | minhagim | 11 | — | מנהגים מרבותינו הקדושים מסטולין קרלין |  | reading | 0 |
| 315 | minhagim | 12 | דינים למי שטעה בתפלת שמו״ע | דינים למי שטעה בתפלת שמו״ע |  | reading | 0 |

<!-- GENERATED INDEX END -->
