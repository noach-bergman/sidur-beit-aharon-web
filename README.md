# סידור בית אהרן וישראל — PWA (ספר מודפס)

אפליקציית ווב (Progressive Web App) שמציגה את **דפי הסידור המודפס** של  
**סידור בית אהרן וישראל** (סטולין · קרלין) כמחליף־עמודים בסגנון ספר.

התוכן הוא סריקות PDF — **לא** נוסח שהומצא ולא הקורא הישן מבוסס־JAR.

## מקור ה־PDF

- קובץ: `SiddurBAV.pdf` (315 עמודים)
- מקור ציבורי: <https://stolin.info/stolin/SiddurBAV.pdf>
- בעותק האפליקציה: `docs/siddur.pdf` (וגם `siddur.pdf` בשורש)
- **לשימוש אישי** בתוכן שסופק מכתובת ציבורית זו.

## מיפוי עמודים

מספר עמוד עברי מודפס `H` ≈ אינדקס PDF (1-based) לפי:

```text
hebToPdf(h) = clamp(h - 1, 1, 315)
pdfToHeb(p) = clamp(p + 1, 1, 315)
```

דוגמאות מאומתות מהסריקה: ד(4)→PDF 3 · ו(6)→PDF 5 · כא(21)→PDF 20.  
PDF עמוד 2 = תוכן ומפתח.

## הפעלה מקומית

```bash
cd sidur-web/docs    # או sidur-web אם מגישים מהשורש
python3 -m http.server 3000
# או: npx --yes serve -l 3000
```

פתחו: `http://localhost:3000`

> חובה לשרת דרך HTTP (לא `file://`) — אחרת fetch / PDF.js / service worker לא יעבדו.

## GitHub Pages

האתר מוגש מ־`/docs`:

- `docs/index.html` + `docs/siddur.pdf` + `docs/data/toc.json`
- הפעילו Pages מתיקיית `/docs`

## מבנה

```text
sidur-web/
  docs/                 # מוכן ל-GitHub Pages
    index.html
    siddur.pdf          # הסידור המודפס (5.5MB, 315 עמ')
    data/toc.json       # תוכן העניינים מהסידור המודפס
    css/ js/ icons/ sw.js manifest…
  siddur.pdf            # אותו PDF גם בשורש
  data/toc.json
```

## UX

1. **בית** — כותרת, «פתח סידור», תוכן מחולק: יום־יום / מועדים / אחר  
2. **קורא** — עמוד מודפס אחד בכל פעם (PDF.js), RTL  
   - חצי ימין → הקודם · חצי שמאל → הבא (או החלקה)  
   - סרגל: מספר עברי + מיקום PDF · תוכן · הקודם/הבא  
3. קפיצה מפריט תוכן דרך `hebToPdf`  
4. עמוד אחרון נשמר ב־`localStorage`  
5. PWA: manifest + service worker (מעטפת אופליין; PDF נשמר אחרי טעינה ראשונה)

## טכנולוגיה

- PDF.js 3.11 (jsDelivr / mozilla) + worker  
- HTML/CSS/JS ונילה, mobile-first לאייפון  

## הערות

- הסיבובים המעורבים ב־PDF (`/Rotate` 0/180/270) מטופלים ע״י PDF.js ב־`getViewport`.  
- תפריט הטקסט הישן מה־JAR הוסר — התוכן הוא דפי הספר בלבד.
