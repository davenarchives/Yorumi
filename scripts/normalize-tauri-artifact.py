from pathlib import Path
import shutil
import sys

bundle = Path('src-tauri/target/universal-apple-darwin/release/bundle' if sys.platform == 'darwin' else 'src-tauri/target/release/bundle')
target = Path('release-assets/desktop')
target.mkdir(parents=True, exist_ok=True)
patterns = {'win32': ('nsis/*-setup.exe', 'Yorumi.exe'), 'darwin': ('dmg/*.dmg', 'Yorumi.dmg'), 'linux': ('appimage/*.AppImage', 'Yorumi.AppImage')}
pattern, name = patterns[sys.platform]
matches = list(bundle.glob(pattern))
if len(matches) != 1:
    raise SystemExit(f'Expected one {pattern} bundle, found {len(matches)}')
shutil.copyfile(matches[0], target / name)
