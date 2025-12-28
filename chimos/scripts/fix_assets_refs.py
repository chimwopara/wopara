#!/usr/bin/env python3
"""Fix references to files that live under the `assets/` directory.

For each project file (.html,.js,.css,.ts,.tsx) this script looks for string/url-like
references to filenames that exist in `assets/`. If the current reference doesn't resolve
to an existing file but there is a unique match under `assets/`, it replaces the reference
with a correct relative path and saves a `.bak` backup.
"""
import os
import re
from pathlib import Path

ROOT = Path('.')
ASSETS = ROOT / 'assets'
EXTS = {'.html', '.htm', '.js', '.jsx', '.css', '.ts', '.tsx'}

QUOTE_PAT = re.compile(r'(["\'])([^"\']+\.(?:png|jpg|jpeg|gif|webp|svg|mp4|mov|mp3|wav|jpeg))(["\'])', re.IGNORECASE)
URL_PAT = re.compile(r'url\(\s*(["\']?)([^)"\']+\.(?:png|jpg|jpeg|gif|webp|svg|mp4|mov|mp3|wav|jpeg))(["\']?)\s*\)', re.IGNORECASE)
ATTR_PAT = re.compile(r'(?:src|href)\s*=\s*(["\'])([^"\']+\.(?:png|jpg|jpeg|gif|webp|svg|mp4|mov|mp3|wav|jpeg))(["\'])', re.IGNORECASE)

SKIP_PREFIXES = ('http://', 'https://', '//', 'data:', 'mailto:', 'tel:')


def build_asset_map():
    amap = {}
    if not ASSETS.exists():
        return amap
    for p in ASSETS.rglob('*'):
        if p.is_file():
            amap.setdefault(p.name, []).append(p)
    return amap


def normalized_relpath(target: Path, source_file: Path):
    rel = os.path.relpath(target, start=source_file.parent)
    return rel.replace(os.path.sep, '/')


def try_fix_text(path: Path, text: str, amap, report):
    orig = text
    changed = False

    def replace_match(m, group_index=2, wrapper=None):
        nonlocal changed, text
        val = m.group(group_index)
        if any(val.startswith(s) for s in SKIP_PREFIXES):
            return m.group(0)
        if '${' in val or val.strip().startswith('{'):
            return m.group(0)
        lookup = val.split('?')[0].split('#')[0]
        if (path.parent / lookup).exists() or lookup.startswith('assets/') and (ROOT / lookup).exists():
            return m.group(0)
        name = Path(lookup).name
        if name in amap and len(amap[name]) == 1:
            newrel = normalized_relpath(amap[name][0], path)
            changed = True
            report['fixed'].append((str(path), val, newrel))
            if wrapper == 'url':
                return f"url('{newrel}')"
            else:
                return f"{m.group(1)}{newrel}{m.group(3)}"
        elif name in amap and len(amap[name]) > 1:
            report['ambiguous'].append((str(path), val, [str(p) for p in amap[name]]))
            return m.group(0)
        else:
            report['missing'].append((str(path), val))
            return m.group(0)

    # attributes
    text = ATTR_PAT.sub(lambda m: replace_match(m, group_index=2, wrapper='attr'), text)
    # quoted filenames
    text = QUOTE_PAT.sub(lambda m: replace_match(m, group_index=2, wrapper='quote'), text)
    # url(...) occurrences
    text = URL_PAT.sub(lambda m: replace_match(m, group_index=2, wrapper='url'), text)

    return text, changed


def main():
    amap = build_asset_map()
    report = {'fixed': [], 'ambiguous': [], 'missing': []}
    for dirpath, _, filenames in os.walk(ROOT):
        for fn in filenames:
            p = Path(dirpath) / fn
            if p.suffix.lower() in EXTS:
                try:
                    text = p.read_text(encoding='utf-8', errors='ignore')
                    newtext, changed = try_fix_text(p, text, amap, report)
                    if changed and newtext != text:
                        bak = p.with_suffix(p.suffix + '.bak')
                        bak.write_text(text, encoding='utf-8')
                        p.write_text(newtext, encoding='utf-8')
                except Exception as e:
                    print(f"Error processing {p}: {e}")

    print('\nAssets-fix Summary:')
    print(f"Assets indexed: {sum(len(v) for v in amap.values())}")
    print(f"Fixed references: {len(report['fixed'])}")
    for f, old, new in report['fixed'][:200]:
        print(f"- {f}: {old} -> {new}")
    print(f"Ambiguous: {len(report['ambiguous'])}")
    for f, old, cands in report['ambiguous'][:200]:
        print(f"- {f}: {old} -> candidates: {cands}")
    print(f"Missing: {len(report['missing'])}")
    for f, old in report['missing'][:200]:
        print(f"- {f}: {old}")


if __name__ == '__main__':
    main()
