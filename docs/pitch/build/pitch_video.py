#!/usr/bin/env python3
"""Build ../clearhold-pitch-3min.mp4: deck slides (1920x1080) + narration + ../demo-narrated.mp4 as slide 3.

  cd docs/pitch/build && npm i --no-save playwright-core   # once, for slide screenshots
  FISH_AUDIO_API_KEY=... python3 pitch_video.py           # Fish Audio voice (VOICE_ID below)

Own recorded voice instead of Fish (see ../README.md, "Usar la voz de Eric"):
  python3 pitch_video.py --voice-dir voz-eric/                       # 1.wav 2.wav 4.wav 5.wav 6.wav 7.wav [+ demo-1..demo-7]
  python3 pitch_video.py --track eric.wav --timing eric-labels.txt   # one take + cut points (Audacity labels or JSON)

Narration text: pitch-narration.json (slides) and demo-beats.json (demo beats). Fish clips are cached in .pitch-video/ by
(voice, text), so changing VOICE_ID or a line only regenerates what changed. The build stops if the result is longer than MAX_LEN.
"""
import argparse, hashlib, json, os, pathlib, re, subprocess, sys, urllib.request

VOICE_ID = os.environ.get("VOICE_ID", "a508e76ec74e4b57ad77d907992a536e")  # Fish Audio voice ("Voz tik tok", male, Latin American Spanish)
MODEL = "s2.1-pro-free"
TEMPO = 1.03            # light speed-up applied to Fish clips (same as the demo video)
LEAD, TAIL, XF = 0.5, 0.6, 0.5   # seconds of silence before/after each slide's line, crossfade length
SLIDE3_INTRO = 1.2      # slide 3 title shown briefly before the demo video
EMPH_FRAC = 0.52        # slide 5: the "0 pagos indebidos" box pops in at this fraction of the line (Fish: on the word "cero")
MAX_LEN = 178.0
SLIDES = ["1", "2", "4", "5", "6", "7"]
AUDIO_EXT = (".wav", ".mp3", ".m4a", ".flac", ".ogg", ".aac")

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("--voice-dir", default=os.environ.get("VOICE_DIR"), help="folder with one audio file per slide (1,2,4,5,6,7) and optionally per demo beat (demo-1..demo-7)")
ap.add_argument("--track", default=os.environ.get("VOICE_TRACK"), help="one full narration take; needs --timing")
ap.add_argument("--timing", default=os.environ.get("VOICE_TIMING"), help="cut points for --track: Audacity label export (.txt) or JSON {id: [start, end]}; may set 'emphasis-5'")
ap.add_argument("--own-tempo", type=float, default=float(os.environ.get("OWN_TEMPO", "1.0")), help="speed factor for your own clips (e.g. 1.04 to save time); 1.0 = untouched")
ap.add_argument("--fish-fallback", action="store_true", help="use Fish for slides missing from your recordings instead of failing")
ap.add_argument("--max-len", type=float, default=MAX_LEN)
ap.add_argument("--out", default=None)
A = ap.parse_args()

W = pathlib.Path(__file__).resolve().parent; P = W.parent; C = W / ".pitch-video"; C.mkdir(exist_ok=True)
DEMO = P / "demo-narrated.mp4"; OUT = pathlib.Path(A.out) if A.out else P / "clearhold-pitch-3min.mp4"
NARR = {k: v for k, v in json.loads((W / "pitch-narration.json").read_text()).items() if not k.startswith("_")}
DB = json.loads((W / "demo-beats.json").read_text())
run = lambda *a: subprocess.run([str(x) for x in a], check=True, capture_output=True, text=True).stdout
dur = lambda f: float(run("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f))
fhash = lambda f: hashlib.sha1(pathlib.Path(f).read_bytes()).hexdigest()[:12]
die = lambda m: sys.exit("ERROR: " + m)

# ---------- 1. own recordings (optional): id -> source file, plus timing extras ----------
own, extra = {}, {}
def parse_timing(path):
    p = pathlib.Path(path); out = {}
    if p.suffix.lower() == ".json":
        for k, v in json.loads(p.read_text()).items():
            if k.startswith("_"): continue
            out[k] = v
    else:  # Audacity "Export Labels": start<TAB>end<TAB>label
        for line in p.read_text().splitlines():
            parts = line.strip().split("\t")
            if len(parts) >= 3 and parts[2].strip():
                s, e, lab = float(parts[0].replace(",", ".")), float(parts[1].replace(",", ".")), parts[2].strip()
                out[lab] = s if lab.startswith("emphasis") else [s, e]
    return out
if A.track:
    if not A.timing: die("--track needs --timing (cut points per slide)")
    tm = parse_timing(A.timing); cut = C / "own-cut"; cut.mkdir(exist_ok=True); th = fhash(A.track)
    for k, v in tm.items():
        if k.startswith("emphasis"): extra[k] = float(v); continue
        s, e = map(float, v); f = cut / f"{k}-{th}-{s:.3f}-{e:.3f}.wav"
        if not f.exists(): run("ffmpeg", "-v", "error", "-y", "-ss", f"{s:.3f}", "-to", f"{e:.3f}", "-i", A.track, "-ac", "2", "-ar", "48000", f)
        own[k] = f
elif A.voice_dir:
    d = pathlib.Path(A.voice_dir)
    if not d.is_dir(): die(f"--voice-dir {d} is not a folder")
    for f in sorted(d.iterdir()):
        if f.suffix.lower() in AUDIO_EXT: own[f.stem.lower()] = f
    if A.timing:
        extra = {k: float(v) for k, v in parse_timing(A.timing).items() if k.startswith("emphasis")}
if own:
    unknown = [k for k in own if k not in SLIDES and k not in [b["id"] for b in DB["beats"]]]
    if unknown: die(f"unknown clip names {unknown}; use 1,2,4,5,6,7 and demo-1..demo-7")
    missing = [k for k in SLIDES if k not in own]
    if missing and not A.fish_fallback: die(f"missing your recording for slide(s) {missing} (or pass --fish-fallback)")
    print("own voice:", ", ".join(sorted(own)))

def prep_own(src, tag):
    fin = C / f"own-{tag}-{fhash(src)}-{A.own_tempo}.wav"
    if not fin.exists():
        tempo = f"atempo={A.own_tempo}," if A.own_tempo != 1.0 else ""
        run("ffmpeg", "-v", "error", "-y", "-i", src, "-af",
            "highpass=f=70,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse,"
            "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15,areverse,"
            f"{tempo}loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-ac", "2", fin)
    return fin

# ---------- 2. slide narration clips ----------
def tts(text, out):
    body = json.dumps({"text": text, "reference_id": VOICE_ID, "format": "wav", "normalize": True, "latency": "normal"}).encode()
    req = urllib.request.Request("https://api.fish.audio/v1/tts", data=body, headers={
        "Authorization": "Bearer " + os.environ["FISH_AUDIO_API_KEY"], "Content-Type": "application/json", "model": MODEL})
    with urllib.request.urlopen(req, timeout=300) as r: out.write_bytes(r.read())

clips, source = {}, {}
for k, text in NARR.items():
    if k in own: clips[k] = prep_own(own[k], f"s{k}"); source[k] = "own"; continue
    h = hashlib.sha1(f"{VOICE_ID}|{MODEL}|{TEMPO}|{text}".encode()).hexdigest()[:12]
    raw, fin = C / f"s{k}-{h}.raw.wav", C / f"s{k}-{h}.wav"
    if not fin.exists():
        if not raw.exists(): print("tts slide", k); tts(text, raw)
        run("ffmpeg", "-v", "error", "-y", "-i", raw, "-af",
            "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.12,areverse,"
            "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.15,areverse,"
            f"atempo={TEMPO},loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-ac", "2", fin)
    clips[k] = fin; source[k] = "fish"

# ---------- 3. demo: keep as is, or swap beat narration and re-time ----------
def retime_demo():
    beats = DB["beats"]; ids = [b["id"] for b in beats if b["id"] in own]
    if not ids: return DEMO, []
    E = DB["duration"]; args = ["ffmpeg", "-v", "error", "-y", "-i", DEMO]; nin = 1; vf, af, report = [], [], []
    segs = []
    for i, b in enumerate(beats):  # last beat: freeze before the 0.6 s fade-out, keep the fade as a tail
        end = E - 0.6 if i == len(beats) - 1 else b["end"]; segs.append([b, b["start"], end])
    for j, (b, s, e) in enumerate(segs):
        win = e - s; off = b["audio_at"] - s
        if b["id"] in own:
            c = prep_own(own[b["id"]], b["id"]); d = dur(c); args += ["-i", c]; ai = nin; nin += 1
            ext = max(0.0, off + d + 0.45 - win)
            af.append(f"[{ai}:a]adelay={int(off*1000)}|{int(off*1000)},apad,atrim=0:{win+ext:.3f},asetpts=PTS-STARTPTS[da{j}]")
            report.append(f"  {b['id']}: {d:.2f}s (Fish {b['fish_dur']:.2f}s) -> beat {win:.2f}s +{ext:.2f}s freeze")
        else:
            ext = 0.0
            af.append(f"[0:a]atrim={s:.3f}:{e:.3f},asetpts=PTS-STARTPTS,apad,atrim=0:{win:.3f}[da{j}]")
        vf.append(f"[0:v]trim={s:.3f}:{e:.3f},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration={ext:.3f}[dv{j}]")
    n = len(segs)
    vf.append(f"[0:v]trim={E-0.6:.3f}:{E:.3f},setpts=PTS-STARTPTS[dv{n}]"); af.append(f"[0:a]atrim={E-0.6:.3f}:{E:.3f},asetpts=PTS-STARTPTS[da{n}]")
    cat = "".join(f"[dv{j}][da{j}]" for j in range(n + 1)) + f"concat=n={n+1}:v=1:a=1[v][a]"
    key = hashlib.sha1(("|".join(f"{k}:{fhash(own[k])}" for k in sorted(ids)) + str(A.own_tempo) + fhash(DEMO)).encode()).hexdigest()[:12]
    out = C / f"demo-own-{key}.mp4"
    if not out.exists():
        print("re-timing demo with", ", ".join(ids))
        run(*args, "-filter_complex", ";".join(vf + af + [cat]), "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium",
            "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", out)
    return out, report
demo, demo_report = retime_demo()

# ---------- 4. slides (screenshots) and the slide-5 pop ----------
POP = sorted(C.glob("slide5-pop-*.png"))
if not all((C / f"slide{n}.png").exists() for n in range(1, 8)) or not POP or os.environ.get("RECAPTURE"):
    print(run("node", W / "capture_slides.cjs", C).strip()); POP = sorted(C.glob("slide5-pop-*.png"))

def slide5_clip(d, at):
    """Slide 5 as a short video: plain -> pop-in of the '0 pagos indebidos' box at `at` s -> emphasized until the end."""
    pop = len(POP) / 30; at = max(0.3, min(at, d - pop - 0.3)); rest = d - at - pop
    out = C / f"slide5-anim-{d:.3f}-{at:.3f}-{len(POP)}.mp4"
    if not out.exists():
        run("ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", "30", "-t", f"{at:.3f}", "-i", C / "slide5.png",
            "-framerate", "30", "-i", C / "slide5-pop-%02d.png", "-loop", "1", "-framerate", "30", "-t", f"{rest:.3f}", "-i", POP[-1],
            "-filter_complex", "[0:v][1:v][2:v]concat=n=3:v=1,format=yuv420p[v]", "-map", "[v]", "-c:v", "libx264", "-preset", "medium",
            "-crf", "16", "-r", "30", out)
    return out

# ---------- 5. timeline: (kind, source, duration, narration clip or None) ----------
segs = []
for n in range(1, 8):
    if n == 3:
        segs.append(("img", C / "slide3.png", SLIDE3_INTRO + XF, None))
        segs.append(("demo", demo, dur(demo), None))
    else:
        a = clips[str(n)]; d = LEAD + dur(a) + TAIL + (0.8 if n == 7 else 0)
        if n == 5:
            e5 = extra["emphasis-5"] / (A.own_tempo if source["5"] == "own" else TEMPO) if "emphasis-5" in extra else EMPH_FRAC * dur(a)
            at = LEAD + e5 - 0.15
            segs.append(("clip", slide5_clip(d, at), d, a))
        else:
            segs.append(("img", C / f"slide{n}.png", d, a))
starts, t = [], 0.0
for i, s in enumerate(segs):
    starts.append(t); t += s[2] - XF
total = t + XF
lines = [f"  {pathlib.Path(s[1]).name:<28} {st:6.2f}s  {s[2]:6.2f}s" + (f"  ({source[k]})" if s[3] else "")
         for s, st, k in zip(segs, starts, [next((x for x, c in clips.items() if c == s[3]), None) for s in segs])]
print("\n".join(lines + demo_report)); print(f"total {total:.2f}s (max {A.max_len}s)")
if total > A.max_len:
    die(f"too long by {total - A.max_len:.2f}s: shorten the lines (pitch-narration.json / your takes) or speed up your clips with --own-tempo 1.04")

args, vf = ["ffmpeg", "-v", "error", "-y"], []
for i, (kind, src, d, a) in enumerate(segs):
    args += (["-loop", "1", "-framerate", "30", "-t", f"{d:.3f}", "-i", str(src)] if kind == "img" else ["-i", str(src)])
    vf.append(f"[{i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=white,fps=30,format=yuv420p,setsar=1,settb=AVTB[v{i}]")
nin = len(segs); ai = []
for i, (kind, src, d, a) in enumerate(segs):
    if kind == "demo":
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
    "-movflags", "+faststart", "-t", f"{total:.3f}", OUT)
json.dump({"voice": "own" if own else "fish", "voice_id": VOICE_ID, "model": MODEL, "total": round(total, 2), "own_clips": sorted(own),
           "segments": [{"kind": k, "src": pathlib.Path(s).name, "start": round(st, 2), "dur": round(d, 2)} for (k, s, d, a), st in zip(segs, starts)]},
          open(C / "timeline.json", "w"), indent=1)
print("wrote", OUT, f"{OUT.stat().st_size/1e6:.1f} MB")
