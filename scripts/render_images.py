"""Render *.img-src.txt -> *.png (phone-photo-like: slight noise/rotation). FAKE data only. Needs Pillow."""
import sys, glob, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
for d in sys.argv[1:]:
    for src in sorted(glob.glob(f"{d}/*.img-src.txt")):
        lines = open(src, encoding="utf-8").read().splitlines()
        rnd = random.Random(src); f = ImageFont.truetype(FONT, 26)
        w = max(int(f.getlength(l)) for l in lines) + 80; h = 40 * len(lines) + 80
        im = Image.new("L", (w, h), 250 - rnd.randint(0, 15)); dr = ImageDraw.Draw(im)
        for i, l in enumerate(lines): dr.text((40, 40 + 40 * i), l, fill=rnd.randint(0, 40), font=f)
        im = im.rotate(rnd.uniform(-0.8, 0.8), expand=True, fillcolor=245).filter(ImageFilter.GaussianBlur(0.4))
        im.save(src.replace(".img-src.txt", ".png"))
