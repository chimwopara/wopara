#!/usr/bin/env python3
"""Scan project files for local asset references and fix paths by searching for the referenced filename.

Creates a `.bak` backup for every modified file. Prints a summary of fixes and ambiguous matches.
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


def find_files_by_name(name):
    matches = []
    for dirpath, _, filenames in os.walk(ROOT):
        for fn in filenames:
            if fn == name:
                matches.append(Path(dirpath) / fn)
    return matches


def normalized_relpath(target: Path, source_file: Path):
    rel = os.path.relpath(target, start=source_file.parent)
    return rel.replace(os.path.sep, '/')


def process_file(path: Path, report):
    text = path.read_text(encoding='utf-8', errors='ignore')
    orig = text
    changed = False

    for pat in PATTERNS:
        def repl(m):
            nonlocal changed
            if pat.pattern.startswith('url'):
                full = m.group(0)
                q1 = m.group(1) or ''
                val = m.group(2)
                q2 = m.group(3) or ''
                lookup = val.split('?')[0].split('#')[0]
                if any(lookup.startswith(s) for s in SKIP_SCHEMES) or lookup.startswith('/') and (Path(lookup).exists()):
                    return full
                name = os.path.basename(lookup)
                if not name:
                    return full
                matches = find_files_by_name(name)
                if len(matches) == 1:
                    newrel = normalized_relpath(matches[0], path)
                    changed = True
                    report['fixed'].append((str(path), val, newrel))
                    return f"url({q1}{newrel}{q2})"
                elif len(matches) > 1:
                    report['ambiguous'].append((str(path), val, [str(p) for p in matches]))
                    return full
                else:
                    report['missing'].append((str(path), val))
                    return full

            else:
                attr = m.group(1)
                q = m.group(2)
                val = m.group(3)
                qend = m.group(4)
                if any(val.startswith(s) for s in SKIP_SCHEMES) or val.startswith('#'):
                    return m.group(0)
                lookup = val.split('?')[0].split('#')[0]
                name = os.path.basename(lookup)
                if not name:
                    return m.group(0)
                matches = find_files_by_name(name)
                if len(matches) == 1:
                    newrel = normalized_relpath(matches[0], path)
                    changed = True
                    report['fixed'].append((str(path), val, newrel))
                    return f"{attr}={q}{newrel}{qend}"
                elif len(matches) > 1:
                    report['ambiguous'].append((str(path), val, [str(p) for p in matches]))
                    return m.group(0)
                else:
                    report['missing'].append((str(path), val))
                    return m.group(0)

        text = pat.sub(repl, text)

    if changed and text != orig:
        bak = path.with_suffix(path.suffix + '.bak')
        bak.write_text(orig, encoding='utf-8')
        path.write_text(text, encoding='utf-8')


def main():
    report = {'fixed': [], 'ambiguous': [], 'missing': []}
    for dirpath, _, filenames in os.walk(ROOT):
        for fn in filenames:
            p = Path(dirpath) / fn
            if p.suffix.lower() in EXTS:
                try:
                    process_file(p, report)
                except Exception as e:
                    print(f"Error processing {p}: {e}")

    print('\nSummary:')
    print(f"Fixed references: {len(report['fixed'])}")
    for f, old, new in report['fixed'][:200]:
        print(f"- {f}: {old} -> {new}")
    print(f"Ambiguous matches (need manual review): {len(report['ambiguous'])}")
    for f, old, matches in report['ambiguous'][:200]:
        print(f"- {f}: {old} -> candidates: {matches}")
    print(f"Missing targets (not found): {len(report['missing'])}")
    for f, old in report['missing'][:200]:
        print(f"- {f}: {old}")


if __name__ == '__main__':
    main()
