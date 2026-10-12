#!/usr/bin/env python3
"""Convert JAR CP1255 prayer resources → UTF-8 JSON for the web siddur."""
from __future__ import annotations
import json, os, re, sys
from pathlib import Path

ROOT = Path('/workspace/siddur-jar-inspect')
OUT = Path('/workspace/sidur-web/data')
SKIP_DIRS = {'META-INF', 'letters1', 'letters2', 'moladlib'}
SKIP_EXT = {'.class', '.png', '.PNG', '.gif', '.MF', '.jar', '.java'}
# Special glyph K in the MIDlet bitmap font = kamatz
KAMATZ = '\u05b8'  # ָ

# Main menu entries → entry resource names (from Manager.showPage)
MENU = [
    {"id": "1", "title": "השכמת הבוקר", "entry": "s_ashkama"},
    {"id": "2", "title": "שחרית", "entry": "s_shacharit"},
    {"id": "3", "title": "מנחה", "entry": "s_mincha"},
    {"id": "4", "title": "ערבית", "entry": "s_arvit"},
    {"id": "5", "title": "קריאת שמע שעל המיטה", "entry": "s_mita"},
    {"id": "6", "title": "ברכת המזון", "entry": "s_mazon"},
    {"id": "7", "title": "מעין שלוש", "entry": "s_shalosh"},
    {"id": "8", "title": "שבע ברכות", "entry": "s_shevaBrachot"},
    {"id": "9", "title": "סדר ברית מילה", "entry": "s_brit"},
    {"id": "10", "title": "ברכות הנהנין", "entry": "s_nefashot"},
    {"id": "11", "title": "אשר יצר", "entry": "s_yatzar"},
    {"id": "12", "title": "תפילת הדרך", "entry": "s_derech"},
    {"id": "13", "title": "תפילות והוספות", "entry": "s_tfilot"},
    {"id": "14", "title": "קידוש לבנה", "entry": "s_levana"},
    {"id": "15a", "title": "ספירת העומר", "entry": "s_omer"},
    {"id": "15b", "title": "הדלקת נרות חנוכה ומזמורים", "entry": "s_nerot"},
]

# Conditions that are TRUE on a typical weekday (non-holiday) for expansion defaults
WEEKDAY_TRUE = {
    'NOTISHAA BEAV', 'NOTISHAABEAV', 'NO TISHAA BEAV',
    'NOPURIM', 'NOCHANUKA', 'NORH', 'NOPESACH', 'NOSUCOT',
    'NOKIPURKATAN', 'NOAYT', 'NOCHONANTANU', 'NOFRI',
    'NOKADOSH', 'NORH', 'NOLEAP', 'NOCHOLAMOED',
    'NOLEMANTZION', 'NOPURIM',
    'TFILIN', 'NOTFILIN',  # both ambiguous — handle below
    'SUMMERBRACHA', 'SUMMERTAL',  # approx; winter toggled in prefs
    'TACHANUN', 'TACHANUNBHAB',  # prefer showing tachanun
    'SHIRLAMAALOT',
    'NOMONTHU',
}
# Normalize helper
def norm_cond(c: str) -> str:
    return re.sub(r'\s+', '', c.upper())

# Weekday-default: include if condition matches these (after normalize)
INCLUDE_DEFAULT = {
    'NOTISHABEAV', 'NOTISHAABEAV', 'NOPURIM', 'NOCHANUKA', 'NORH',
    'NOPESACH', 'NOSUCOT', 'NOKIPURKATAN', 'NOAYT', 'NOCHONANTANU',
    'NOFRI', 'NOKADOSH', 'NOLEAP', 'NOCHOLAMOED', 'NOLEMANTZION',
    'TFILIN', 'SHIRLAMAALOT', 'NOMONTHU',
    'SUMMERBRACHA', 'SUMMERTAL', 'WINTERBRACHA', 'WINTERTAL',  # show both variants marked
    'NOSUN', 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI',  # day-of-week: include all labeled days as sections
}
# Always skip these holiday-only inclusions in default expand (user can toggle later via raw)
SKIP_DEFAULT = {
    'TISHABEAV', 'TISHAABEAV', 'PURIM', 'CHANUKA', 'CHANUKA1', 'RH', 'PESACH', 'SUCOT',
    'KIPURKATAN', 'AYT', 'CHONANTANU', 'FRI',  # fri = kabalat shabbat bits
    'KADOSH', 'LEAP', 'CHOLAMOED', 'LEMANTZION',
    'AHRON1', 'AHRON2', 'AHRON3', 'ASHER1', 'ASHER2', 'SHLOMO', 'YOCHANAN',
    'HATZALA', 'AVRAM', 'ASHERVMOSHE', 'BEER', 'IGROT', 'YAKOVCH',
    'NISAN1', 'FIRE', 'LEVANA', 'ZMIROT', 'ALACOL', 'LULAV_SHEHECHEYANU',
    'MONTHU', 'MONTHUTACHANUN', 'KAPARATPASHA', 'NOKAPARATPASHA',
    'NOTFILIN', 'SHEHECHEYANU',
}


def decode_cp1255(data: bytes) -> str:
    text = data.decode('cp1255', errors='replace')
    # Map bitmap-font sentinel K → kamatz
    text = text.replace('K', KAMATZ)
    # Normalize newlines
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    return text


def collect_files() -> dict[str, str]:
    texts = {}
    for dirpath, dirs, fnames in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in fnames:
            if any(f.endswith(e) for e in SKIP_EXT):
                continue
            if f in ('ab',):
                continue
            path = Path(dirpath) / f
            if not path.is_file():
                continue
            # skip binary-ish
            raw = path.read_bytes()
            if b'\x00' in raw[:200]:
                continue
            rel = str(path.relative_to(ROOT)).replace('\\', '/')
            # only top-level + specials/ for prayer text
            if '/' in rel and not rel.startswith('specials/'):
                continue
            try:
                texts[rel] = decode_cp1255(raw)
            except Exception as e:
                print('skip', rel, e)
    return texts


INCLUDE_RE = re.compile(r'^\(\)(\S+)(?:\s+(\S+))?\s*$')


def should_include(cond: str | None, mode: str = 'weekday') -> bool:
    if not cond:
        return True
    c = norm_cond(cond)
    if mode == 'all':
        return True
    # In weekday mode: include if in INCLUDE_DEFAULT or unknown-negative (NO*)
    if c in SKIP_DEFAULT:
        return False
    if c in INCLUDE_DEFAULT:
        return True
    if c.startswith('NO'):
        return True  # most NO* mean "when not holiday"
    # unknown positive holiday flags → skip
    return False


def expand(name: str, texts: dict[str, str], mode: str = 'weekday',
           stack: list[str] | None = None, max_depth: int = 40) -> str:
    """Recursively expand ()includes like Page.parse / Manager.readFile."""
    if stack is None:
        stack = []
    # resolve name: try as-is, then without path
    key = name
    if key not in texts:
        # try basename
        for k in texts:
            if k == name or k.endswith('/' + name) or k.split('/')[-1] == name:
                key = k
                break
    if key not in texts:
        return f'\n[חסר: {name}]\n'
    if key in stack:
        return f'\n[רקורסיה: {name}]\n'
    if len(stack) > max_depth:
        return f'\n[עומק יתר: {name}]\n'

    stack.append(key)
    out_lines = []
    for line in texts[key].split('\n'):
        raw = line
        s = line.strip()
        m = INCLUDE_RE.match(s)
        if m:
            inc, cond = m.group(1), m.group(2)
            if should_include(cond, mode):
                expanded = expand(inc, texts, mode, stack, max_depth)
                out_lines.append(expanded)
            # else skip
            continue
        out_lines.append(raw)
    stack.pop()
    return '\n'.join(out_lines)


def postprocess(text: str) -> dict:
    """Split into display blocks with simple roles."""
    blocks = []
    lines = text.split('\n')
    i = 0
    buf = []
    role = 'body'

    def flush():
        nonlocal buf, role
        if buf:
            content = '\n'.join(buf).strip('\n')
            if content.strip():
                blocks.append({'role': role, 'text': content})
            buf = []
            role = 'body'

    while i < len(lines):
        line = lines[i]
        st = line.strip()
        # instruction block (: ... :)
        if st == '(:':
            flush()
            i += 1
            instr = []
            while i < len(lines) and lines[i].strip() != ':)':
                instr.append(lines[i])
                i += 1
            blocks.append({'role': 'note', 'text': '\n'.join(instr).strip()})
            i += 1
            continue
        if st == ':)':
            i += 1
            continue
        # bracket highlight ([ ... ])
        if st == '([':
            flush()
            i += 1
            special = []
            while i < len(lines) and lines[i].strip() != '])':
                special.append(lines[i])
                i += 1
            blocks.append({'role': 'special', 'text': '\n'.join(special).strip()})
            i += 1
            continue
        # section / skip markers -----Title
        if st.startswith('-----') or st.startswith('====='):
            flush()
            title = st.lstrip('-=').strip()
            if title:
                blocks.append({'role': 'section', 'text': title})
            i += 1
            continue
        # omer placeholders
        if st.startswith('::::'):
            flush()
            blocks.append({'role': 'dynamic', 'text': 'omer', 'raw': st})
            i += 1
            continue
        buf.append(line)
        i += 1
    flush()
    return {'blocks': blocks, 'plain': text}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'pages').mkdir(exist_ok=True)
    texts = collect_files()
    print(f'Converted {len(texts)} text resources')

    # Write full corpus
    (OUT / 'texts.json').write_text(
        json.dumps(texts, ensure_ascii=False, separators=(',', ':')),
        encoding='utf-8'
    )
    print(f'Wrote texts.json ({(OUT/"texts.json").stat().st_size} bytes)')

    # Menus
    first_menu = [
        {"id": "pray", "title": "לבחירת תפילה", "action": "main"},
        {"id": "tzahal", "title": "תפילה לעת רצון", "action": "page", "entry": "tzahal"},
        {"id": "yortzait", "title": "לוח יארצייט", "action": "page", "entry": "yortzait"},
        {"id": "prefs", "title": "הגדרות", "action": "prefs"},
        {"id": "zmanim", "title": "זמני היום", "action": "zmanim"},
        {"id": "help", "title": "עזרה", "action": "page", "entry": "help"},
        {"id": "about", "title": "אודות", "action": "about"},
    ]
    (OUT / 'menus.json').write_text(json.dumps({
        'appName': 'סידור בית אהרן וישראל',
        'version': '2.0',
        'firstMenu': first_menu,
        'mainMenu': MENU,
        'nusach': [
            {"id": "s", "title": "בית אהרן וישראל"},
            {"id": "a", "title": "בית אהרן וישראל (a)"},
            {"id": "em", "title": "בית אהרן וישראל (em)"},
        ],
        'defaultNusach': 's',
    }, ensure_ascii=False, indent=2), encoding='utf-8')

    # Cities from earlier extraction
    cities_src = Path('/tmp/cities.json')
    if cities_src.exists():
        cities = json.loads(cities_src.read_text(encoding='utf-8'))
        # Convert DMS to decimal
        def dms(arr):
            # [deg, min, sec, hemisphere] where last 0=N/E, 1=S/W (from City ctor)
            sign = -1 if len(arr) > 3 and arr[3] == 1 else 1
            return sign * (arr[0] + arr[1]/60 + arr[2]/3600)
        for c in cities:
            c['latitude'] = dms(c['lat'])
            c['longitude'] = dms(c['lon'])
        (OUT / 'cities.json').write_text(json.dumps(cities, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f'Cities: {len(cities)}')

    # Expand major pages
    index = []
    for item in MENU:
        entry = item['entry']
        # a_/em_ aliases mostly redirect to s_
        expanded = expand(entry, texts, mode='weekday')
        processed = postprocess(expanded)
        page = {
            'id': item['id'],
            'title': item['title'],
            'entry': entry,
            'mode': 'weekday-default',
            **processed,
        }
        outp = OUT / 'pages' / f'{entry}.json'
        outp.write_text(json.dumps(page, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        index.append({
            'id': item['id'], 'title': item['title'], 'entry': entry,
            'chars': len(processed['plain']), 'blocks': len(processed['blocks']),
            'file': f'pages/{entry}.json',
        })
        print(f'  {entry}: {len(processed["plain"]):,} chars, {len(processed["blocks"])} blocks')

    # Also expand help / tzahal / yortzait if present
    for extra in ('help', 'tzahal', 'yortzait'):
        if extra in texts or any(k.endswith(extra) for k in texts):
            expanded = expand(extra, texts, mode='all')
            processed = postprocess(expanded)
            (OUT / 'pages' / f'{extra}.json').write_text(
                json.dumps({'id': extra, 'title': extra, 'entry': extra, **processed},
                           ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            index.append({'id': extra, 'title': extra, 'entry': extra,
                          'chars': len(processed['plain']), 'blocks': len(processed['blocks']),
                          'file': f'pages/{extra}.json'})

    (OUT / 'pages-index.json').write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding='utf-8')
    print('Done.')


if __name__ == '__main__':
    main()
