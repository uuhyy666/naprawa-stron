#!/usr/bin/env python3
# Szkielet: masowa modyfikacja podstron HTML pod SEO/AI-SEO — dowód koncepcji dla zlecenia 143804
# Zakres (z zlecenia): rozszerzenie opisów/tekstów, title, description, linkowanie wewnętrzne, llms.txt.
# Użycie:
#   python html-batch-seo.py katalog-podstron --dry-run   # pokazuje zmiany, nie rusza plików
#   python html-batch-seo.py katalog-podstron --apply     # zapisuje (backup .bak obok)
#   python html-batch-seo.py katalog-podstron --llms      # generuje llms.txt dla całej witryny
import argparse, os, re, sys
from html.parser import HTMLParser
from datetime import datetime

DRY = True

# --- Wyciąganie i podmienianie <title> i meta description ---
RE_TITLE = re.compile(r'(<title[^>]*>)([\s\S]*?)(</title>)', re.I)
RE_DESC = re.compile(r'(<meta\s+name="description"\s+content=")([^"]*)(")', re.I)

def gen_title(old, regula):
    # reguły per-witryna; tu przykładowa: nazwa kategorii + marka, <= 60 znaków
    nowy = regula.strip()[:60]
    return nowy if nowy else old

def gen_description(old, regula):
    nowy = regula.strip()[:158]
    return nowy if nowy else old

# --- Linkowanie wewnętrzne: dopisuje 2-3 powiązane linki przed </body> ---
def add_internal_links(html, linki):
    blok = '\n<nav class="seo-powiazane" aria-label="Podobne strony"><h3>Podobne strony</h3><ul>\n'
    for anchor, href in linki:
        blok += f'  <li><a href="{href}">{anchor}</a></li>\n'
    blok += '</ul></nav>\n'
    return html.replace('</body>', blok + '</body>', 1)

# --- llms.txt: mapa witryny dla wyszukiwarek AI (format llmstxt.org) ---
def gen_llms(files_titles):
    out = '# Nazwa witryny\n\n> Jednozdaniowy opis czym jest witryna.\n\n'
    for path, title in files_titles:
        out += f'- [{title}](https://example.com/{path}): {title}\n'
    return out

def process_file(path, reguly):
    with open(path, encoding='utf-8') as f: html = f.read()
    original = html
    m = RE_TITLE.search(html)
    if m and 'TITLE' in reguly: html = RE_TITLE.sub(lambda m: m.group(1) + gen_title(m.group(2), reguly['TITLE']) + m.group(3), html, count=1)
    if 'DESC' in reguly: html = RE_DESC.sub(lambda m: m.group(1) + gen_description(m.group(2), reguly['DESC']) + m.group(3), html, count=1)
    if 'LINKI' in reguly: html = add_internal_links(html, reguly['LINKI'])
    return original, html

def main():
    global DRY
    ap = argparse.ArgumentParser()
    ap.add_argument('katalog'); ap.add_argument('--apply', action='store_true'); ap.add_argument('--llms', action='store_true'); ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args(); DRY = not a.apply

    # Przykładowe reguły — w realu generowane per-podstrona z mapy słów kluczowych (CSV/JSON)
    reguly = {'TITLE': 'Kategoria produktu | Marka', 'DESC': 'Kup kategoria w Marka — sprawdź parametry, ceny i dostępność. Dostawa 24h.',
              'LINKI': [('Najczęściej wybierane modele', '/popularne.html'), ('Zobacz wszystkie kategorie', '/kategorie.html')]}

    pliki = [os.path.join(dp, f) for dp, _, fs in os.walk(a.katalog) for f in fs if f.endswith(('.html', '.htm'))]
    if not pliki: sys.exit(f'Brak plików HTML w {a.katalog}')
    print(f'Znaleziono {len(pliki)} podstron')

    if a.llms:
        titles = []
        for p in pliki[:5]:
            with open(p, encoding='utf-8') as f: m = RE_TITLE.search(f.read())
            titles.append((os.path.basename(p), m.group(2).strip() if m else os.path.basename(p)))
        with open(os.path.join(a.katalog, 'llms.txt'), 'w', encoding='utf-8') as f: f.write(gen_llms(titles))
        print('Wygenerowano llms.txt (pierwsze 5 pozycji jako próbka)'); return

    zmienione = 0
    for p in pliki:
        przed, po = process_file(p, reguly)
        if przed != po:
            zmienione += 1
            if DRY:
                print(f'[DRY] {p}: title -> "{reguly["TITLE"]}" | description podmieniona | +blok linków wewn.')
            else:
                with open(p + '.bak', 'w', encoding='utf-8') as f: f.write(przed)
                with open(p, 'w', encoding='utf-8') as f: f.write(po)
    print(f'{"[DRY] " if DRY else ""}Zmodyfikowano by {zmienione}/{len(pliki)} podstron'
          + ('' if DRY else ' (backupy .bak obok plików)'))

if __name__ == '__main__': main()
