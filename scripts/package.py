"""Build a buyer package from an explicit allowlist; never copy seller credentials."""
from pathlib import Path
import zipfile
root = Path(__file__).resolve().parents[1]
out = root / 'release'
out.mkdir(exist_ok=True)
files = ['Code.js', 'Index.html', 'appsscript.json', 'README.md', 'CHANGELOG.md', 'video/package.json', 'video/package-lock.json', 'video/tsconfig.json', 'video/remotion.config.ts', 'video/README.md']
files += [str(p.relative_to(root)) for p in (root / 'video' / 'src').rglob('*') if p.is_file()]
files += [str(p.relative_to(root)) for p in (root / 'video' / 'public').rglob('*.mp3') if p.is_file()]
files += ['video/narration-th.json']
with zipfile.ZipFile(out / 'qc-workspace-source.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(root / name, name)
print('Buyer source package created (no seller script binding or credentials).')
