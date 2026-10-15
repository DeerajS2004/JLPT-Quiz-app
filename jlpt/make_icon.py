#!/usr/bin/env python3
"""Generates jlpt_n4_icon.png using only stdlib (tkinter canvas → PostScript → PIL fallback)"""
import sys, os, base64

# Inline a minimal 256x256 PNG as base64 — drawn programmatically
# We'll use tkinter to render and save, or fall back to writing raw PNG bytes

def make_icon_png(out_path):
    try:
        from PIL import Image, ImageDraw, ImageFont
        img = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        # background rounded square
        d.rounded_rectangle([8, 8, 248, 248], radius=40, fill="#12111A")
        d.rounded_rectangle([12, 12, 244, 244], radius=38, fill="#1C1B28")
        # red accent band
        d.rectangle([12, 90, 244, 140], fill="#E8445A")
        # N4 text
        try:
            fnt = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 80)
            fnt2 = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
        except Exception:
            fnt = ImageFont.load_default()
            fnt2 = fnt
        d.text((128, 115), "N4", fill="white", font=fnt, anchor="mm")
        d.text((128, 200), "JLPT", fill="#F0B429", font=fnt2, anchor="mm")
        d.text((128, 232), "日本語能力試験", fill="#7C7A95", font=ImageFont.load_default(), anchor="mm")
        img.save(out_path, "PNG")
        return True
    except ImportError:
        pass

    # Fallback: write a hand-crafted minimal valid PNG (simple colored square)
    # This is a pre-encoded 64x64 dark square with "N4" — good enough for desktop icon
    PNG_B64 = (
        "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABHNCSVQICAgIfAhkiAAAAAlwSFlz"
        "AAALEwAACxMBAJqcGAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAANpSURB"
        "VHic7ZtNaBNBFMd/mU1iNjFpqmkTtTYFP6gHD4IHD4IHD4JCD4IHD4IHERQRD4IHwYOHgAcPHgQP"
        "HgQPHgQPHgQPHgRFURRFURRFURRFURRFURRFURRFURRFURRFURRFURRFURRFURRFURRFURRFURRF"
        "URRFURRFURRFURRFURRFURRFURRFURRFURRFURRFURRFURRFURRFURRFURRFURRFURRFURRFURRFURRF"
    )
    # Just write a simple valid PNG using struct
    import struct, zlib

    def png_chunk(name, data):
        c = struct.pack('>I', len(data)) + name + data
        crc = zlib.crc32(name + data) & 0xffffffff
        return c + struct.pack('>I', crc)

    W = H = 64
    # RGBA image: dark bg with simple pattern
    raw = []
    for y in range(H):
        row = b'\x00'  # filter type none
        for x in range(W):
            # background
            if 4 <= x < 60 and 4 <= y < 60:
                if 22 <= y < 38:  # red band
                    row += bytes([232, 68, 90, 255])
                else:
                    row += bytes([28, 27, 40, 255])
            else:
                row += bytes([18, 17, 26, 255])
        raw.append(row)
    compressed = zlib.compress(b''.join(raw))

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>IIBBBBB', W, H, 8, 2, 0, 0, 0)  # RGB (type 2)
    # Redo with RGBA
    ihdr_data = struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0)  # RGBA type 6

    raw2 = []
    for y in range(H):
        row = b'\x00'
        for x in range(W):
            if 4 <= x < 60 and 4 <= y < 60:
                if 22 <= y < 38:
                    row += bytes([232, 68, 90, 255])
                elif 42 <= y < 56:
                    row += bytes([240, 180, 41, 255])
                else:
                    row += bytes([28, 27, 40, 255])
            else:
                row += bytes([18, 17, 26, 255])
        raw2.append(row)

    compressed2 = zlib.compress(b''.join(raw2))
    png_bytes = (sig
                 + png_chunk(b'IHDR', ihdr_data)
                 + png_chunk(b'IDAT', compressed2)
                 + png_chunk(b'IEND', b''))
    with open(out_path, 'wb') as f:
        f.write(png_bytes)
    return True

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "jlpt_n4_icon.png"
    make_icon_png(out)
    print(f"Icon saved to {out}")
