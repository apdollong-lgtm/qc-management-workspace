"""Normalize recorded Thai narration and fit each Remotion scene to its audio."""
import json, subprocess
from pathlib import Path
root = Path(__file__).resolve().parents[1]
texts = json.loads((root/'video/narration-th.json').read_text(encoding='utf-8-sig'))
destination = root/'video/public/narration'
destination.mkdir(parents=True, exist_ok=True)
def main():
    durations = []
    minimums = [15,15,18,16,18,18,18]
    for i, text in enumerate(texts, 1):
        target = destination/f'step-{i:02}.mp3'
        source = destination/f'step-{i:02}.wav'
        if source.exists():
            subprocess.run(['ffmpeg','-y','-v','error','-i',str(source),'-af','loudnorm=I=-16:TP=-1.5:LRA=9','-ar','48000','-ac','1','-b:a','160k',str(target)], check=True)
        if not target.exists() or target.stat().st_size == 0:
            raise RuntimeError(f'Missing narration for scene {i}')
        seconds = float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(target)], text=True).strip())
        frames = max(minimums[i-1]*30, int((seconds+1.2)*30+0.999))
        durations.append(frames)
        print(f'Scene {i}: audio {seconds:.2f}s, video {frames/30:.2f}s')
    (root/'video/src/narration-timing.json').write_text(json.dumps(durations), encoding='utf-8')
main()
