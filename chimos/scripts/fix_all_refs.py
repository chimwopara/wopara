#!/usr/bin/env python3
"""Aggressively fix local file references across the repo.

Heuristics for ambiguous matches:
 - Prefer candidate in same top-level folder as the source file
 - Then prefer candidate under `src/`
 - Then choose candidate with shortest relative path length

Creates `.bak` backups for modified files and prints a summary.
"""
import os
import re
from pathlib import Path

ROOT = Path('.')
EXTS = {'.html', '.htm', '.js', '.jsx', '.css', '.ts', '.tsx'}

PATTERNS = [
    re.compile(r'(src)\s*=\s*("|\')([^"\']+)("|\')', re.IGNORECASE),
    re.compile(r'(href)\s*=\s*("|\')([^"\']+)("|\')', re.IGNORECASE),
    re.compile(r'url\(\s*("|\')?([^\)"\']+)("|\')?\s*\)', re.IGNORECASE),
    re.compile(r'(srcset)\s*=\s*("|\')([^"\']+)("|\')', re.IGNORECASE),
]

SKIP_SCHEMES = ('http://', 'https://', '//', 'data:', 'mailto:', 'tel:')


def index_files():
    fmap = {}
    for dirpath, _, filenames in os.walk(ROOT):
        for fn in filenames:
            p = Path(dirpath) / fn
            fmap.setdefault(fn, []).append(p)
    return fmap


def top_level_dir(p: Path):
    parts = p.resolve().relative_to(Path.cwd().resolve()).parts
    return parts[0] if parts else ''


def choose_candidate(candidates, source_path: Path):
    if not candidates:
        return None
    if len(candidates) == 1:
        return candidates[0]
    src_top = top_level_dir(source_path)
    # prefer same top-level
    same = [c for c in candidates if top_level_dir(c) == src_top]
    if same:
        candidates = same
    # prefer under src
    src_pref = [c for c in candidates if any(part == 'src' for part in c.parts)]
    if src_pref:
        candidates = src_pref
    # choose shortest relpath
    candidates.sort(key=lambda c: len(os.path.relpath(c, start=source_path.parent)))
    return candidates[0]


def normalized_relpath(target: Path, source_file: Path):
    rel = os.path.relpath(target, start=source_file.parent)
    return rel.replace(os.path.sep, '/')


def process_file(path: Path, fmap, report):
    text = path.read_text(encoding='utf-8', errors='ignore')
    orig = text
    changed = False

    for pat in PATTERNS:
        def repl(m):
            nonlocal changed
            # determine value and skip external/template values
            if pat.pattern.startswith('url'):
                val = m.group(2)
            else:
                val = m.group(3)
            if not val or any(val.startswith(s) for s in SKIP_SCHEMES):
                return m.group(0)
            if '${' in val or '{' in val:
                return m.group(0)
            lookup = val.split('?')[0].split('#')[0]
            # if it already exists as given, skip
            if (path.parent / lookup).exists() or (ROOT / lookup).exists():
                return m.group(0)
            name = os.path.basename(lookup)
            candidates = fmap.get(name, [])
            if not candidates:
                report['missing'].append((str(path), val))
                return m.group(0)
            if len(candidates) == 1:
                pick = candidates[0]
            else:
                pick = choose_candidate(candidates, path)
            if not pick:
                report['ambiguous'].append((str(path), val, [str(p) for p in candidates]))
                return m.group(0)
            newrel = normalized_relpath(pick, path)
            changed = True
            report['fixed'].append((str(path), val, newrel))
            if pat.pattern.startswith('url'):
                return f"url('{newrel}')"
            else:
                # rebuild groups: keep surrounding quotes if present
                if pat.pattern.startswith('(src') or pat.pattern.startswith('(href') or pat.pattern.startswith('(srcset'):
                    return m.group(1) + '=' + m.group(2) + newrel + m.group(4)
                else:
                    return newrel

        text = pat.sub(repl, text)

    if changed and text != orig:
        bak = path.with_suffix(path.suffix + '.bak')
        bak.write_text(orig, encoding='utf-8')
        path.write_text(text, encoding='utf-8')


def main():
    fmap = index_files()
    report = {'fixed': [], 'ambiguous': [], 'missing': []}
    for dirpath, _, filenames in os.walk(ROOT):
        for fn in filenames:
            p = Path(dirpath) / fn
            if p.suffix.lower() in EXTS:
                try:
                    process_file(p, fmap, report)
                except Exception as e:
                    print(f"Error processing {p}: {e}")

    print('\nAggressive-fix Summary:')
    print(f"Fixed references: {len(report['fixed'])}")
    for f, old, new in report['fixed'][:300]:
        print(f"- {f}: {old} -> {new}")
    print(f"Ambiguous (left for manual review): {len(report['ambiguous'])}")
    for f, old, cands in report['ambiguous'][:300]:
        print(f"- {f}: {old} -> candidates: {cands}")
    print(f"Missing (not found): {len(report['missing'])}")
    for f, old in report['missing'][:300]:
        print(f"- {f}: {old}")


if __name__ == '__main__':
    main()
