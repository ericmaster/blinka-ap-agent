#!/usr/bin/env python3
"""Build ../clearhold-pitch-3min.mp4: deck slides (1920x1080) + Fish Audio narration + ../demo-narrated.mp4 as slide 3.

  cd docs/pitch/build && npm i --no-save playwright-core   # once, for slide screenshots
  FISH_AUDIO_API_KEY=... python3 pitch_video.py          # VOICE_ID below picks the voice

Narration text: pitch-narration.json. TTS clips are cached in .pitch-video/ by (voice, text), so changing VOICE_ID or a line only regenerates what changed.
"""
import hashlib, json, os, pathlib, re, subprocess, urllib.request

VOICE_ID = os.environ.get("VOICE_ID", "a508e76ec74e4b57ad77d907992a536e")  # Fish Audio voice ("Voz tik tok", male, Latin American Spanish)
MODEL = "s2.1-pro-free"
TEMPO = 1.03            # same light speed-up as the demo video
LEAD, TAIL, XF = 0.5, 0.6, 0.5   # seconds of silence before/after each slide's line, crossfade length
SLIDE3_INTRO = 1.2      # slide 3 title shown briefly before the demo video
MAX_LEN = 178.0

W = pathlib.Path(__file__).resolve().parent; P = W.parent; C = W / ".pitch-video"; C.mkdir(exist_ok=True)
DEMO = P / "demo-narrated.mp4"; OUT = P / "clearhold-pitch-3min.mp4"
NARR = {k: v for k, v in json.loads((W / "pitch-narration.json").read_text()).items() if not k.startswith("_")}
run = lambda *a: subprocess.run(a, check=True, capture_output=True, text=True).stdout
dur = lambda f: float(run("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)))

def tts(text, out):
    body = json.dumps({"text": text, "reference_id": VOICE_ID, "format": "wav", "normalize": True, "latency": "normal"}).encode()
    req = urllib.request.Request("https://api.fish.audio/v1/tts", data=body, headers={
        "Authorization": "Bearer " + os.environ["FISH_AUDIO_API_KEY"], "Content-Type": "application/json", "model": MODEL})
    with urllib.request.urlopen(req, timeout=300) as r: out.write_bytes(r.read())

clips = {}
for k, text in NARR.items():
    h = hashlib.sha1(f"{VOICE_ID}|{MODEL}|{TEMPO}|{text}".encode()).hexdigest()[:12]
    raw, fin = C / f"s{k}-{h}.raw.wav", C / f"s{k}-{h}.wav"
    if not fin.exists():
        if not raw.exists(): print("tts slide", k); tts(text, raw)
        run("ffmpeg", "-v", "error", "-y", "-i", str(raw), "-af",
            "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.12,areverse,"
            "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.15,areverse,"
            f"atempo={TEMPO},loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-ac", "2", str(fin))
    clips[k] = fin

if not all((C / f"slide{n}.png").exists() for n in range(1, 8)) or os.environ.get("RECAPTURE"):
    print(run("node", str(W / "capture_slides.cjs"), str(C)).strip())

# timeline: (kind, source, duration, narration clip or None)
segs = []
for n in range(1, 8):
    if n == 3:
        segs.append(("img", C / "slide3.png", SLIDE3_INTRO + XF, None))
        segs.append(("vid", DEMO, dur(DEMO), None))
    else:
        a = clips[str(n)]; segs.append(("img", C / f"slide{n}.png", LEAD + dur(a) + TAIL + (0.8 if n == 7 else 0), a))
starts, t = [], 0.0
for i, s in enumerate(segs):
    starts.append(t); t += s[2] - XF
total = t + XF
print(f"total {total:.2f}s")
assert total <= MAX_LEN, f"too long: {total:.2f}s > {MAX_LEN}s; shorten pitch-narration.json"

args, vf, af = ["ffmpeg", "-v", "error", "-y"], [], []
for i, (kind, src, d, a) in enumerate(segs):
    args += (["-loop", "1", "-framerate", "30", "-t", f"{d:.3f}", "-i", str(src)] if kind == "img" else ["-i", str(src)])
    vf.append(f"[{i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=white,fps=30,format=yuv420p,setsar=1,settb=AVTB[v{i}]")
nin = len(segs); ai = []
for i, (kind, src, d, a) in enumerate(segs):
    if kind == "vid":
        ms = int(starts[i] * 1000); ai.append(f"[{i}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay={ms}|{ms}[a{i}]")
    elif a is not None:
        args += ["-i", str(a)]; ms = int((starts[i] + LEAD) * 1000)
        ai.append(f"[{nin}:a]adelay={ms}|{ms}[a{i}]"); nin += 1
labels = [l.split("[")[-1].rstrip("]") for l in ai]
prev = "v0"
for i in range(1, len(segs)):
    off = starts[i]; nxt = f"x{i}"
    vf.append(f"[{prev}][v{i}]xfade=transition=fade:duration={XF}:offset={off:.3f}[{nxt}]"); prev = nxt
vf.append(f"[{prev}]fade=t=in:st=0:d=0.4,fade=t=out:st={total-0.6:.3f}:d=0.6[vout]")
mix = "".join(f"[{l}]" for l in labels) + f"amix=inputs={len(labels)}:normalize=0,apad,atrim=0:{total:.3f}"
# two-pass loudness normalization of the whole mix to -16 LUFS
meas_cmd = args + ["-filter_complex", ";".join(ai) + ";" + mix + ",loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json[aout]", "-map", "[aout]", "-f", "null", "-"]
err = subprocess.run(["ffmpeg", "-hide_banner", "-nostats"] + meas_cmd[3:], capture_output=True, text=True).stderr
m = json.loads(re.findall(r"\{[^{}]*\"input_i\"[^{}]*\}", err)[-1])
ln = (f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
      f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,afade=t=out:st={total-0.6:.3f}:d=0.6")
fc = ";".join(vf + ai) + ";" + mix + "," + ln + "[aout]"
run(*args, "-filter_complex", fc, "-map", "[vout]", "-map", "[aout]", "-c:v", "libx264", "-preset", "slow", "-crf", "21",
    "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
    "-movflags", "+faststart", "-t", f"{total:.3f}", str(OUT))
json.dump({"voice_id": VOICE_ID, "model": MODEL, "total": round(total, 2),
           "segments": [{"kind": k, "src": pathlib.Path(s).name, "start": round(st, 2), "dur": round(d, 2), "line": a and next(x for x, c in clips.items() if c == a)}
                        for (k, s, d, a), st in zip(segs, starts)]}, open(C / "timeline.json", "w"), indent=1)
print("wrote", OUT, f"{OUT.stat().st_size/1e6:.1f} MB")
