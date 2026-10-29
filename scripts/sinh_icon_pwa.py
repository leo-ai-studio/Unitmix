"""Sinh biểu tượng PWA / màn hình chính iOS từ logo LEO có sẵn (web/public/brand/leo_ai_app_icon.png).

Không vẽ lại logo: chỉ đổ nền góc trong suốt bằng đúng màu nền của icon (--green #174F52 — iOS tô góc trong suốt
thành đen và tự bo góc), rồi thu nhỏ. Bản "maskable" (Android) thu logo còn 84 % đặt giữa nền cùng màu
để nằm gọn trong vùng an toàn 80 % của mặt nạ tròn.

    python scripts/sinh_icon_pwa.py
"""
from pathlib import Path

from PIL import Image

GOC = Path(__file__).resolve().parent.parent / "web" / "public" / "brand"
NEN = (0x17, 0x4F, 0x52, 255)  # --green, cũng là màu nền trong icon gốc


def phang(anh: Image.Image) -> Image.Image:
    """Đổ nền đặc dưới ảnh RGBA, bỏ kênh alpha."""
    nen = Image.new("RGBA", anh.size, NEN)
    nen.alpha_composite(anh)
    return nen.convert("RGB")


def main() -> None:
    goc = Image.open(GOC / "leo_ai_app_icon.png").convert("RGBA")
    day = phang(goc)
    for co, ten in [(180, "pwa_180.png"), (192, "pwa_192.png"), (512, "pwa_512.png")]:
        day.resize((co, co), Image.LANCZOS).save(GOC / ten, optimize=True)
    # maskable: logo 84 % ở giữa
    co = 512
    nho = round(co * 0.84)
    mk = Image.new("RGB", (co, co), NEN[:3])
    mk.paste(day.resize((nho, nho), Image.LANCZOS), ((co - nho) // 2, (co - nho) // 2))
    mk.save(GOC / "pwa_512_maskable.png", optimize=True)
    print("da sinh:", ", ".join(p.name for p in sorted(GOC.glob("pwa_*.png"))))


if __name__ == "__main__":
    main()
