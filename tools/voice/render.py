"""Records every sentence in tools/voice/catalog.json with the Kokoro voice into voice/*.mp3.
Existing clips are kept, so re-running only records new sentences.
Usage: python render.py <note-garden folder> <kokoro model dir> [voice]"""
import json, os, subprocess, sys, tempfile
import soundfile as sf
from kokoro_onnx import Kokoro

root, model_dir = sys.argv[1], sys.argv[2]
voice = sys.argv[3] if len(sys.argv) > 3 else 'af_heart'
kokoro = Kokoro(os.path.join(model_dir, 'kokoro-v1.0.onnx'), os.path.join(model_dir, 'voices-v1.0.bin'))
items = json.load(open(os.path.join(root, 'tools', 'voice', 'catalog.json'), encoding='utf8'))
out_dir = os.path.join(root, 'voice'); os.makedirs(out_dir, exist_ok=True)
made = 0
for i, it in enumerate(items):
    dest = os.path.join(out_dir, it['file'])
    if os.path.exists(dest):
        continue
    samples, rate = kokoro.create(it['tts'], voice=voice, speed=0.95, lang='en-us')
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
        wav = tmp.name
    sf.write(wav, samples, rate)
    # Trim silence at both ends, then encode a small mono MP3.
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', wav, '-af',
                    'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse',
                    '-ac', '1', '-ar', '24000', '-b:a', '48k', dest], check=True)
    os.remove(wav)
    made += 1
    if made % 25 == 0:
        print(f'{made} recorded ({i + 1}/{len(items)})', flush=True)
print(f'done: {made} new clips, {len(items)} total')
