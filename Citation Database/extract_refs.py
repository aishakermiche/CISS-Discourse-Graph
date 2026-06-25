import pdfplumber
import requests
import re
import time
import json
from pathlib import Path

USER_AGENT = "reference-extractor/1.0 (mailto:aishakermiche@proton.me)"
HEADERS = {"User-Agent": USER_AGENT}

PDFS = [
    "fransonn_should_2025.pdf",
    "foo_mind_2025.pdf",
    "bloom_chiral_2024.pdf",
]

# ── 1. Extract text from each PDF ────────────────────────────────────────────
def extract_full_text(pdf_path):
    text = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text.append(t)
    return "\n".join(text)

# ── 2. Isolate the references section ────────────────────────────────────────
REF_HEADERS = re.compile(
    r'\n\s*(References|Bibliography|Works Cited|REFERENCES|BIBLIOGRAPHY)\s*\n',
    re.IGNORECASE
)

def get_references_section(full_text):
    m = REF_HEADERS.search(full_text)
    if m:
        return full_text[m.end():]
    # fallback: last 30% of doc
    cutoff = int(len(full_text) * 0.70)
    return full_text[cutoff:]

# ── 3. Split into individual references ──────────────────────────────────────
REF_SPLIT = re.compile(
    r'(?:^|\n)(?=\[\d+\]|\d{1,3}\.\s+[A-Z]|[A-Z][a-z]+,\s+[A-Z]\.)',
    re.MULTILINE
)

def split_references(ref_section):
    parts = REF_SPLIT.split(ref_section)
    refs = []
    for p in parts:
        p = p.strip()
        if len(p) > 20:
            refs.append(p)
    return refs

# ── 4. Extract DOI from reference text ───────────────────────────────────────
DOI_RE = re.compile(r'10\.\d{4,9}/[^\s,\]\)"]+', re.IGNORECASE)

def extract_doi(text):
    m = DOI_RE.search(text)
    if m:
        doi = m.group(0).rstrip('.')
        return doi
    return None

# ── 5. CrossRef DOI lookup ────────────────────────────────────────────────────
def crossref_by_doi(doi):
    url = "https://api.crossref.org/works/{}".format(doi)
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        if r.status_code == 200:
            return r.json().get("message", {})
    except Exception as e:
        print("  DOI lookup error ({}): {}".format(doi, e))
    return None

def crossref_search(ref_text):
    query = re.sub(r'^[\[\d\]\.]+\s*', '', ref_text)
    query = query[:200]
    url = "https://api.crossref.org/works"
    params = {"query": query, "rows": 1}
    try:
        r = requests.get(url, headers=HEADERS, params=params, timeout=15)
        if r.status_code == 200:
            items = r.json().get("message", {}).get("items", [])
            if items:
                return items[0]
    except Exception as e:
        print("  Search error: {}".format(e))
    return None

# ── 6. Build BibTeX entry from CrossRef metadata ─────────────────────────────
def make_citekey(meta, fallback_text):
    authors = meta.get("author", [])
    if authors:
        last = authors[0].get("family", "Unknown")
    else:
        m = re.search(r'([A-Z][a-z]+)', fallback_text)
        last = m.group(1) if m else "Unknown"
    last = re.sub(r'[^A-Za-z]', '', last)

    year = ""
    dp = meta.get("published-print") or meta.get("published-online") or meta.get("issued")
    if dp:
        parts = dp.get("date-parts", [[]])
        if parts and parts[0]:
            year = str(parts[0][0])

    title = ""
    if meta.get("title"):
        title = meta["title"][0] if isinstance(meta["title"], list) else meta["title"]
    words = re.findall(r'[A-Za-z]{4,}', title)
    word = words[0].capitalize() if words else "Work"

    return "{}{}{}".format(last, year, word)

def format_authors(author_list):
    parts = []
    for a in author_list:
        family = a.get("family", "")
        given = a.get("given", "")
        if family and given:
            parts.append("{}, {}".format(family, given))
        elif family:
            parts.append(family)
        elif given:
            parts.append(given)
    return " and ".join(parts)

def meta_to_bibtex(meta, citekey, raw_text=""):
    type_map = {
        "journal-article": "article",
        "book": "book",
        "book-chapter": "incollection",
        "proceedings-article": "inproceedings",
        "conference-paper": "inproceedings",
        "posted-content": "misc",
        "report": "techreport",
        "dissertation": "phdthesis",
    }
    cr_type = meta.get("type", "misc")
    bib_type = type_map.get(cr_type, "misc")

    fields = {}

    titles = meta.get("title", [])
    fields["title"] = titles[0] if titles else ""

    authors = meta.get("author", [])
    if authors:
        fields["author"] = format_authors(authors)

    dp = meta.get("published-print") or meta.get("published-online") or meta.get("issued")
    if dp:
        parts = dp.get("date-parts", [[]])
        if parts and parts[0]:
            fields["year"] = str(parts[0][0])
            if len(parts[0]) > 1:
                fields["month"] = str(parts[0][1])

    if bib_type == "article":
        container = meta.get("container-title", [])
        if container:
            fields["journal"] = container[0]
        fields["volume"] = meta.get("volume", "")
        fields["number"] = meta.get("issue", "")
        pages = meta.get("page", "")
        fields["pages"] = pages.replace("-", "--") if pages else ""

    elif bib_type in ("incollection", "inproceedings"):
        container = meta.get("container-title", [])
        fields["booktitle"] = container[0] if container else ""

    elif bib_type == "book":
        publisher = meta.get("publisher", "")
        fields["publisher"] = publisher

    doi = meta.get("DOI", "")
    if doi:
        fields["doi"] = doi
        fields["url"] = "https://doi.org/{}".format(doi)

    # Build BibTeX string
    lines = ["@{}{{{},".format(bib_type, citekey)]
    for k, v in fields.items():
        v = str(v).strip()
        if v:
            v = v.replace("&", "\\&").replace("%", "\\%").replace("_", "\\_")
            lines.append("  {} = {{{}}},".format(k, v))
    lines.append("}")
    return "\n".join(lines)

def misc_bibtex(citekey, raw_text):
    raw_text = raw_text.replace("&", "\\&").replace("%", "\\%")
    return "@misc{{{},\n  note = {{{}}},\n}}".format(citekey, raw_text[:400])

# ── Main pipeline ─────────────────────────────────────────────────────────────
all_refs_by_paper = {}
doi_to_meta = {}
doi_to_citekey = {}
unique_entries = {}
title_to_citekey = {}

def normalize_title(t):
    return re.sub(r'\W+', '', t).lower()[:60]

stats = {}

for pdf_name in PDFS:
    pdf_path = Path("C:/Users/19496/Documents/Claude") / pdf_name
    print("\n" + "="*60)
    print("Processing: {}".format(pdf_name))
    print("="*60)

    full_text = extract_full_text(pdf_path)
    ref_section = get_references_section(full_text)
    refs = split_references(ref_section)

    print("  Raw reference chunks found: {}".format(len(refs)))
    all_refs_by_paper[pdf_name] = refs
    stats[pdf_name] = {"raw": len(refs), "with_doi": 0, "found_via_search": 0}

    for i, ref_text in enumerate(refs):
        ref_text_clean = ' '.join(ref_text.split())
        doi = extract_doi(ref_text_clean)
        meta = None
        found_doi = doi

        if doi:
            if doi in doi_to_meta:
                meta = doi_to_meta[doi]
                print("  [{}] DOI cached: {}".format(i+1, doi))
            else:
                print("  [{}] DOI found: {} — fetching...".format(i+1, doi))
                meta = crossref_by_doi(doi)
                doi_to_meta[doi] = meta
                time.sleep(0.3)
            if meta:
                stats[pdf_name]["with_doi"] += 1

        if not meta:
            print("  [{}] No DOI, searching CrossRef...".format(i+1))
            meta = crossref_search(ref_text_clean)
            time.sleep(0.35)
            if meta:
                found_doi = meta.get("DOI")
                if found_doi:
                    if found_doi in doi_to_meta:
                        meta = doi_to_meta[found_doi]
                    else:
                        doi_to_meta[found_doi] = meta
                    stats[pdf_name]["found_via_search"] += 1

        # Dedup by DOI
        if found_doi and found_doi in doi_to_citekey:
            print("    -> Duplicate (DOI {}), skipping".format(found_doi))
            continue

        # Build BibTeX
        if meta:
            citekey = make_citekey(meta, ref_text_clean)
            title_list = meta.get("title", [])
            norm_title = normalize_title(title_list[0] if title_list else ref_text_clean[:60])
            if norm_title in title_to_citekey:
                existing = title_to_citekey[norm_title]
                print("    -> Duplicate title, skipping (key={})".format(existing))
                if found_doi:
                    doi_to_citekey[found_doi] = existing
                continue
            base_key = citekey
            suffix = 1
            while citekey in unique_entries:
                citekey = "{}{}".format(base_key, chr(96+suffix))
                suffix += 1
            bib = meta_to_bibtex(meta, citekey, ref_text_clean)
        else:
            m = re.search(r'([A-Z][a-z]+)', ref_text_clean)
            last = m.group(1) if m else "Unknown"
            year_m = re.search(r'(19|20)\d{2}', ref_text_clean)
            year = year_m.group(0) if year_m else "0000"
            words = re.findall(r'[A-Za-z]{4,}', ref_text_clean)
            word = words[1].capitalize() if len(words) > 1 else "Work"
            citekey = "{}{}{}".format(last, year, word)
            base_key = citekey
            suffix = 1
            while citekey in unique_entries:
                citekey = "{}{}".format(base_key, chr(96+suffix))
                suffix += 1
            bib = misc_bibtex(citekey, ref_text_clean)

        unique_entries[citekey] = bib
        if found_doi:
            doi_to_citekey[found_doi] = citekey
        if meta:
            title_list = meta.get("title", [])
            norm_title = normalize_title(title_list[0] if title_list else ref_text_clean[:60])
            title_to_citekey[norm_title] = citekey
        print("    -> Added as @{}".format(citekey))

# ── Write .bib file ───────────────────────────────────────────────────────────
bib_content = "% Generated by reference-extractor\n% Papers: " + ", ".join(PDFS) + "\n\n"
bib_content += "\n\n".join(unique_entries.values())
bib_content += "\n"

out_path = Path("C:/Users/19496/Documents/Claude/references.bib")
out_path.write_text(bib_content, encoding="utf-8")

# ── Summary ───────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("SUMMARY")
print("="*60)
total_raw = 0
for pdf_name, s in stats.items():
    print("\n{}:".format(pdf_name))
    print("  References extracted: {}".format(s['raw']))
    print("  With inline DOI:      {}".format(s['with_doi']))
    print("  Found via search:     {}".format(s['found_via_search']))
    total_raw += s['raw']

print("\nTotal raw refs across all papers: {}".format(total_raw))
print("Unique references (after dedup):  {}".format(len(unique_entries)))
doi_count = sum(1 for ck, bib in unique_entries.items() if 'doi = {' in bib)
print("Entries with a DOI:               {}".format(doi_count))
print("\nBib file written to: {}".format(out_path))

with open("C:/Users/19496/Documents/Claude/refs_debug.json", "w", encoding="utf-8") as f:
    json.dump(all_refs_by_paper, f, ensure_ascii=False, indent=2)
print("Debug JSON written to refs_debug.json")
