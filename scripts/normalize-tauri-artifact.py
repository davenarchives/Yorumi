from pathlib import Path
import shutil
import sys

rel_subpath = (
    'universal-apple-darwin/release/bundle'
    if sys.platform == 'darwin'
    else 'release/bundle'
)
candidate_roots = [
    Path('target') / rel_subpath,
    Path('src-tauri/target') / rel_subpath,
]

target = Path('release-assets/desktop')
target.mkdir(parents=True, exist_ok=True)
patterns = {
    'win32': ('nsis/*-setup.exe', 'Yorumi.exe'),
    'darwin': ('dmg/*.dmg', 'Yorumi.dmg'),
    'linux': ('appimage/*.AppImage', 'Yorumi.AppImage'),
}
pattern, name = patterns[sys.platform]

matches: list[Path] = []
for root in candidate_roots:
    if root.exists():
        matches.extend(root.glob(pattern))

if len(matches) != 1:
    searched = ', '.join(str(r) for r in candidate_roots)
    raise SystemExit(
        f'Expected one {pattern} bundle under [{searched}], found {len(matches)}: {matches}'
    )

shutil.copyfile(matches[0], target / name)
print(f'Copied {matches[0]} -> {target / name}')
