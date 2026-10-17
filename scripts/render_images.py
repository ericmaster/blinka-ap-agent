"""Render *.img-src.pdf (a printed invoice) -> *.png that looks like a phone photo of the paper: page rasterised with pdftoppm,
slight rotation and perspective, uneven lighting, paper tone, blur and noise, on a desk-coloured margin. FAKE data only. Needs Pillow + poppler."""
import sys, glob, random, subprocess, tempfile, os
from PIL import Image, ImageFilter, ImageChops, ImageDraw
for d in sys.argv[1:]:
    for src in sorted(glob.glob(f"{d}/*.img-src.pdf")):
        rnd = random.Random(os.path.basename(src))
        with tempfile.TemporaryDirectory() as tmp:
            subprocess.run(["pdftoppm", "-r", "150", "-gray", "-singlefile", "-png", src, f"{tmp}/p"], check=True)
            page = Image.open(f"{tmp}/p.png").convert("L")
        w, h = page.size
        page = page.crop((0, 0, w, int(h * 0.82)))  # photo frames the invoice body, not the empty bottom of the page
        w, h = page.size
        tone = Image.linear_gradient("L").resize((w, h)).rotate(rnd.choice([0, 90, 180, 270]), expand=False).point(lambda v: 225 + v * 30 // 255)
        page = ImageChops.multiply(page, tone)
        m = 40
        canvas = Image.new("L", (w + 2 * m, h + 2 * m), 70 + rnd.randint(0, 25))
        canvas.paste(page, (m, m))
        a = rnd.uniform(-1.3, 1.3)
        canvas = canvas.rotate(a, resample=Image.BICUBIC, expand=False, fillcolor=80)
        dx = rnd.uniform(-0.015, 0.015) * w
        canvas = canvas.transform(canvas.size, Image.QUAD, (dx, 0, 0, canvas.size[1], canvas.size[0], canvas.size[1], canvas.size[0] - dx, 0), resample=Image.BICUBIC)
        canvas = canvas.filter(ImageFilter.GaussianBlur(0.5))
        # light sensor grain on a coarse grid keeps the file small (fine per-pixel noise would not compress)
        grain = Image.effect_noise((canvas.size[0] // 4, canvas.size[1] // 4), 5).resize(canvas.size, Image.BILINEAR)
        canvas = ImageChops.add(canvas, grain, scale=1.0, offset=-128)
        out = src.replace(".img-src.pdf", ".jpg")  # phone photos are JPEGs
        canvas.save(out, quality=72, optimize=True)
        print(out, canvas.size, os.path.getsize(out))
