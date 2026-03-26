"""Convert Sonic Pi FLAC samples to OGG Vorbis for web playback.

Uses ffmpeg for reliable encoding (no libsndfile OGG crashes on large files).

Usage:  python convert_samples.py
Re-run safe: skips files that already exist.
"""
import subprocess
import os
import sys
import time

SRC = r'C:\Program Files\Sonic Pi\etc\samples'
DST = r'C:\Github\polymarket_dj\frontend\samples'

sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

def main():
    print(f'Source: {SRC}')
    print(f'Dest:   {DST}')

    # Check ffmpeg
    try:
        r = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True)
        version = r.stdout.split('\n')[0] if r.returncode == 0 else 'unknown'
        print(f'ffmpeg: {version}')
    except FileNotFoundError:
        print('ERROR: ffmpeg not found. Install with: choco install ffmpeg')
        return

    if not os.path.isdir(SRC):
        print(f'ERROR: source directory not found: {SRC}')
        return

    os.makedirs(DST, exist_ok=True)

    flacs = sorted([f for f in os.listdir(SRC) if f.endswith('.flac')])
    print(f'Found {len(flacs)} FLAC files\n')

    success = 0
    skipped = 0
    errors = []
    t0 = time.time()

    for i, fname in enumerate(flacs):
        name = fname[:-5]
        inp = os.path.join(SRC, fname)
        out = os.path.join(DST, name + '.ogg')

        if os.path.exists(out) and os.path.getsize(out) > 0:
            skipped += 1
            continue

        print(f'  [{i+1:3d}/{len(flacs)}] {name}...', end='')
        try:
            r = subprocess.run(
                ['ffmpeg', '-y', '-i', inp, '-c:a', 'libvorbis', '-q:a', '6', out],
                capture_output=True, text=True, timeout=30
            )
            if r.returncode != 0:
                print(f' ERROR: ffmpeg exit {r.returncode}')
                print(f'         {r.stderr[-200:] if r.stderr else "no stderr"}')
                errors.append((name, f'ffmpeg exit {r.returncode}'))
                continue

            size_kb = os.path.getsize(out) / 1024
            print(f' OK  ({size_kb:.0f} KB)')
            success += 1
        except Exception as e:
            print(f' ERROR: {e}')
            errors.append((name, str(e)))

    elapsed = time.time() - t0
    oggs = [f for f in os.listdir(DST) if f.endswith('.ogg')]
    total_mb = sum(os.path.getsize(os.path.join(DST, f)) for f in oggs) / (1024 * 1024)

    print(f'\n--- Done in {elapsed:.1f}s ---')
    if skipped:
        print(f'Skipped (already exist): {skipped}')
    print(f'Converted: {success}/{len(flacs) - skipped}')
    print(f'Total files: {len(oggs)}/{len(flacs)}')
    print(f'Total size: {total_mb:.1f} MB')
    if errors:
        print(f'\nFailed files:')
        for name, err in errors:
            print(f'  {name}: {err}')

if __name__ == '__main__':
    main()
