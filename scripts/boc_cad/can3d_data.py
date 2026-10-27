#!/usr/bin/env python
"""Dữ liệu dựng 3D MỘT căn (tường · cửa · lan can · lover · dầm · sàn) — QT-114.

Nguồn: data/master/unit_geometry.json (nét 2D chuẩn hoá 0..1: x = MẶT TIỀN × dai_mm, y = SÂU × rong_mm,
y = 0 là hành lang) + units.json. Đa giác hoá tường bằng shapely, nhận dạng cửa/cửa sổ/cửa trượt/lan can
từ các nét layer `door`/`rail`/`hidd`. Kết quả (mm, cùng hệ với CAD.u) do build_shell.py nhúng vào CAD.k3;
phần dựng hình + kích thước chỉnh được nằm ở shell.src.html (hàm c3d*).

Chạy riêng: PYTHONIOENCODING=utf-8 python scripts/can3d_data.py  → in số liệu nhận dạng và GHI data/master/can3d.json.
build_shell.py chỉ ĐỌC can3d.json (đã commit) nên máy không cài shapely vẫn build được; chỉ khi bóc lại hình học
(unit_geometry.json đổi) mới cần `pip install shapely` rồi chạy lại script này.
"""
import json
import math
import sys
from pathlib import Path

from shapely.geometry import LineString, Polygon, box
from shapely.geometry import Point
from shapely.ops import nearest_points, polygonize, unary_union

ROOT = Path(__file__).resolve().parent.parent
GEO = ROOT / "data" / "master" / "unit_geometry.json"
CORE = ROOT / "data" / "master" / "core_geometry.json"
UNITS = ROOT / "data" / "master" / "units.json"
OUT = ROOT / "data" / "master" / "can3d.json"


def bbox_of(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return [min(xs), min(ys), max(xs), max(ys)]


def touch(a, b, m=2.0):
    return not (a[2] + m < b[0] or b[2] + m < a[0] or a[3] + m < b[1] or b[3] + m < a[1])


def cluster(items, key):
    """Gộp các mục có bbox chạm nhau. Trả về list nhóm (list chỉ số)."""
    n = len(items)
    par = list(range(n))

    def f(i):
        while par[i] != i:
            par[i] = par[par[i]]
            i = par[i]
        return i

    for i in range(n):
        for j in range(i + 1, n):
            if touch(key(items[i]), key(items[j])):
                par[f(i)] = f(j)
    g = {}
    for i in range(n):
        g.setdefault(f(i), []).append(i)
    return list(g.values())


def union_bbox(bbs):
    return [min(b[0] for b in bbs), min(b[1] for b in bbs), max(b[2] for b in bbs), max(b[3] for b in bbs)]


def rnd(v):
    return int(round(v))


def dong_tuong(lines, gap=380.0):
    """Nét tường CAD là các cặp đường song song HỞ ở đầu cửa / đầu tường → polygonize không ra mặt, tường biến mất.
    Đóng nắp: mỗi đầu cụt nối với đầu cụt gần nhất (cặp hai mặt cùng một tường, ≤ gap), không có thì nối vào
    điểm gần nhất của nét khác ≤ gap."""
    u = unary_union(lines)
    segs = list(u.geoms) if hasattr(u, "geoms") else [u]
    deg = {}
    for sg in segs:
        for q in (sg.coords[0], sg.coords[-1]):
            k = (round(q[0], 1), round(q[1], 1))
            deg[k] = deg.get(k, 0) + 1
    ends = [k for k, v in deg.items() if v == 1]
    caps, used = [], set()
    cand = sorted(((math.hypot(a[0] - b[0], a[1] - b[1]), a, b) for i, a in enumerate(ends) for b in ends[i + 1:]),
                  key=lambda t: t[0])
    for d, a, b in cand:
        if d > gap or d < 1:
            break
        if a in used or b in used:
            continue
        used.add(a)
        used.add(b)
        caps.append(LineString([a, b]))
    for a in ends:
        if a in used:
            continue
        pa = Point(a)
        best, bd = None, gap
        for sg in segs:
            if sg.distance(pa) < 1:
                continue
            d = sg.distance(pa)
            if d <= bd:
                best, bd = nearest_points(sg, pa)[0], d
        if best is not None:
            caps.append(LineString([a, (best.x, best.y)]))
    return unary_union([u] + caps) if caps else u


def xu_ly(ma, ents, W, H):
    P = lambda e: [(p[0] * W, p[1] * H) for p in e["pts"]]
    cat = lambda c: [P(e) for e in ents if e["cat"] == c]

    # ---------- Tường: đa giác hoá các nét wall, giữ mặt mỏng ----------
    lines = []
    for pts in cat("wall"):
        for a, b in zip(pts, pts[1:]):
            if abs(a[0] - b[0]) + abs(a[1] - b[1]) > 0.5:
                lines.append(LineString([a, b]))
    walls = []
    if lines:
        for poly in polygonize(dong_tuong(lines)):
            # mặt TƯỜNG: không chứa đĩa bán kính 350 mm (rộng > 700); phòng thì có. Dựa vào bề rộng chứ không
            # dựa 2A/P — khối tường + trụ dính nhau tới đâu vẫn mỏng, không bị rơi nhầm.
            if poly.area < 50 or not poly.buffer(-350).is_empty:
                continue
            ring = [[rnd(x), rnd(y)] for x, y in poly.exterior.coords[:-1]]
            walls.append(ring)
    wb = union_bbox([bbox_of(r) for r in walls]) if walls else [0, 0, W, H]

    # ---------- Lan can (rail): gộp thành các đoạn mỏng-dài ----------
    rb = [bbox_of(p) for p in cat("rail")]
    rails = []
    for g in cluster(rb, lambda b: b):
        b = union_bbox([rb[i] for i in g])
        w, h = b[2] - b[0], b[3] - b[1]
        if max(w, h) >= 300 and min(w, h) <= 260:
            rails.append({"b": [rnd(v) for v in b], "ax": "x" if w >= h else "y"})

    # ---------- Cửa / cửa sổ: gộp theo bbox ----------
    hbs = [bbox_of(p) for p in cat("hidd") if max(bbox_of(p)[2] - bbox_of(p)[0], bbox_of(p)[3] - bbox_of(p)[1]) >= 150]
    dp = cat("door")
    db = [bbox_of(p) for p in dp]
    openings = []
    bo_qua = 0
    for g in cluster(db, lambda b: b):
        cb = union_bbox([db[i] for i in g])
        w, h = cb[2] - cb[0], cb[3] - cb[1]
        markers = [i for i in g if len(dp[i]) == 7 and db[i][2] - db[i][0] < 220 and db[i][3] - db[i][1] < 220]
        if len(markers) >= 2:  # cửa đi cánh mở (hai mốc khung ở hai đầu)
            best = max(
                ((a, b) for a in markers for b in markers if a < b),
                key=lambda ab: math.hypot(
                    (db[ab[0]][0] + db[ab[0]][2] - db[ab[1]][0] - db[ab[1]][2]) / 2,
                    (db[ab[0]][1] + db[ab[0]][3] - db[ab[1]][1] - db[ab[1]][3]) / 2,
                ),
            )
            m1, m2 = db[best[0]], db[best[1]]
            ax = "x" if abs(m1[0] + m1[2] - m2[0] - m2[2]) >= abs(m1[1] + m1[3] - m2[1] - m2[3]) else "y"
            ia, ie = (0, 2) if ax == "x" else (1, 3)
            ni, ne = (1, 3) if ax == "x" else (0, 2)
            lo, hi = sorted([m1, m2], key=lambda m: m[ia])
            a0, a1 = lo[ia], hi[ie]
            c0, c1 = lo[ie], hi[ia]
            n0, n1 = min(lo[ni], hi[ni]), max(lo[ne], hi[ne])
            # bản lề: nét 2 điểm vuông góc tường
            hinge, side = 0, 1
            for i in g:
                if len(dp[i]) == 2:
                    q0, q1 = dp[i]
                    along = (q0[0], q1[0]) if ax == "x" else (q0[1], q1[1])
                    norm = (q0[1], q1[1]) if ax == "x" else (q0[0], q1[0])
                    if abs(along[0] - along[1]) < 2 and abs(norm[0] - norm[1]) > 100:
                        hinge = 0 if abs(along[0] - c0) <= abs(along[0] - c1) else 1
                        break
            cn0, cn1 = (cb[1], cb[3]) if ax == "x" else (cb[0], cb[2])
            side = 1 if (cn1 - n1) > (n0 - cn0) else -1
            # cửa đi ra lô gia phụ (phơi): sau cửa có đoạn lan can song song, cách 0,3–2,5 m → cửa nhôm kính
            lg = 0
            nc = (n0 + n1) / 2
            for r in rails:
                if r["ax"] != ax:
                    continue
                rb2 = r["b"]
                ra0, ra1 = (rb2[0], rb2[2]) if ax == "x" else (rb2[1], rb2[3])
                rn = (rb2[1] + rb2[3]) / 2 if ax == "x" else (rb2[0] + rb2[2]) / 2
                if 300 <= abs(rn - nc) <= 2500 and min(a1, ra1) - max(a0, ra0) >= 0.3 * (a1 - a0):
                    lg = 1
                    break
            if not lg:
                # lô gia phụ không vẽ lan can: sau cánh cửa (phía side) có hộp A-HIDD (dàn nóng điều hoà) gần ≤ 2,5 m
                for hbx in hbs:
                    ha0, ha1 = (hbx[0], hbx[2]) if ax == "x" else (hbx[1], hbx[3])
                    hn0, hn1 = (hbx[1], hbx[3]) if ax == "x" else (hbx[0], hbx[2])
                    dn = (hn0 - n1) if side == 1 else (n0 - hn1)
                    if -50 <= dn <= 2500 and min(a1 + 500, ha1) - max(a0 - 500, ha0) > 0:
                        lg = 1
                        break
            openings.append({"t": "swing", "ax": ax, "a": [rnd(a0), rnd(a1)], "c": [rnd(c0), rnd(c1)],
                             "n": [rnd(n0), rnd(n1)], "hinge": hinge, "side": side, "lg": lg})
        elif min(w, h) <= 220 and max(w, h) >= 500:  # cửa sổ / cửa trượt
            ax = "x" if w >= h else "y"
            a0, a1 = (cb[0], cb[2]) if ax == "x" else (cb[1], cb[3])
            n0, n1 = (cb[1], cb[3]) if ax == "x" else (cb[0], cb[2])
            nc = (n0 + n1) / 2
            loai = "window"
            for r in rails:
                rb2 = r["b"]
                ra0, ra1 = (rb2[0], rb2[2]) if ax == "x" else (rb2[1], rb2[3])
                rn = (rb2[1] + rb2[3]) / 2 if ax == "x" else (rb2[0] + rb2[2]) / 2
                ov = min(a1, ra1) - max(a0, ra0)
                if 300 <= abs(rn - nc) <= 2500 and ov >= 0.3 * (a1 - a0):
                    loai = "slide"
                    break
            openings.append({"t": loai, "ax": ax, "a": [rnd(a0), rnd(a1)], "c": [rnd(a0), rnd(a1)],
                             "n": [rnd(n0), rnd(n1)]})
        else:
            # cửa sổ trên mặt tiền XIÊN (căn V / Y): nét 2 điểm không song song trục = đường tim cửa sổ, các hình chữ nhật xoay quanh nó
            ln = [dp[i] for i in g if len(dp[i]) == 2
                  and math.hypot(dp[i][0][0] - dp[i][1][0], dp[i][0][1] - dp[i][1][1]) >= 500
                  and abs(dp[i][0][0] - dp[i][1][0]) > 30 and abs(dp[i][0][1] - dp[i][1][1]) > 30]
            if ln:
                q0, q1 = max(ln, key=lambda q: math.hypot(q[0][0] - q[1][0], q[0][1] - q[1][1]))
                if q1[0] < q0[0] or (q1[0] == q0[0] and q1[1] < q0[1]):
                    q0, q1 = q1, q0
                L = math.hypot(q1[0] - q0[0], q1[1] - q0[1])
                ux, uy = (q1[0] - q0[0]) / L, (q1[1] - q0[1]) / L
                nn = [(x - q0[0]) * -uy + (y - q0[1]) * ux for i in g for (x, y) in dp[i]]
                openings.append({"t": "window", "ax": "s", "o": [rnd(q0[0]), rnd(q0[1]), round(math.atan2(uy, ux), 5)],
                                 "a": [0, rnd(L)], "c": [0, rnd(L)], "n": [rnd(min(nn)), rnd(max(nn))]})
            else:
                bo_qua += 1

    # ---------- Tường bao còn thiếu: CAD không vẽ nét tường ở đoạn giữa các cửa sổ / cửa → vá theo đường bao `tim` ----------
    for pts in cat("tim"):
        if len(pts) < 4:
            continue
        env = Polygon(pts).buffer(0)
        if env.is_empty or env.area < 1e6:
            continue
        band = env.difference(env.buffer(-120, join_style=2))
        have = unary_union([Polygon(r).buffer(30) for r in walls]) if walls else None
        cut = []
        for o in openings:
            ao, no = o["a"], o["n"]
            if o["ax"] == "s":
                x0, y0, an = o["o"]
                ux, uy = math.cos(an), math.sin(an)
                cut.append(LineString([(x0 + ux * (ao[0] - 20), y0 + uy * (ao[0] - 20)), (x0 + ux * (ao[1] + 20), y0 + uy * (ao[1] + 20))])
                           .buffer(300, cap_style=2))
                continue
            m = 250 if o["t"] == "swing" else 300
            cut.append(box(ao[0] - 20, no[0] - m, ao[1] + 20, no[1] + m) if o["ax"] == "x"
                       else box(no[0] - m, ao[0] - 20, no[1] + m, ao[1] + 20))
        for r in rails:
            cut.append(box(r["b"][0] - 200, r["b"][1] - 200, r["b"][2] + 200, r["b"][3] + 200))
        if have is not None:
            cut.append(have)
        if cut:
            band = band.difference(unary_union(cut))
        for poly in (band.geoms if hasattr(band, "geoms") else [band]):
            if poly.is_empty or poly.geom_type != "Polygon" or poly.area < 2.5e4:
                continue
            if poly.interiors:
                continue
            # gộp vào tường cũ chạm nó → một khối phẳng, không còn mảnh vá rời / bậc thềm
            near = [i for i, r in enumerate(walls) if Polygon(r).buffer(30).intersects(poly)]
            if near:
                m = unary_union([poly.buffer(30)] + [Polygon(walls[i]).buffer(30) for i in near]).buffer(-30, join_style=2)
                if m.geom_type == "Polygon" and not m.interiors and not m.is_empty:
                    for i in sorted(near, reverse=True):
                        walls.pop(i)
                    walls.append([[rnd(x), rnd(y)] for x, y in m.simplify(2).exterior.coords[:-1]])
                    continue
            walls.append([[rnd(x), rnd(y)] for x, y in poly.exterior.coords[:-1]])
    wb = union_bbox([bbox_of(r) for r in walls]) if walls else wb

    # ---------- Mặt tiền (cạnh có lan can / cửa sổ) → dầm biên ----------
    cand = []
    for r in rails:
        cand.append(((r["b"][0] + r["b"][2]) / 2, (r["b"][1] + r["b"][3]) / 2))
    for o in openings:
        if o["t"] == "window":
            if o["ax"] == "s":
                x0, y0, an = o["o"]
                h = (o["a"][0] + o["a"][1]) / 2
                cand.append((x0 + math.cos(an) * h, y0 + math.sin(an) * h))
                continue
            a = (o["a"][0] + o["a"][1]) / 2
            n = (o["n"][0] + o["n"][1]) / 2
            cand.append((a, n) if o["ax"] == "x" else (n, a))
    sides = set()
    for cx, cy in cand:
        d = {"L": abs(cx - wb[0]), "R": abs(cx - wb[2]), "B": abs(cy - wb[1]), "T": abs(cy - wb[3])}
        s = min(d, key=d.get)
        if d[s] <= 400:
            sides.add(s)
    # Dầm biên THEO CẠNH đa giác tim (QT-119): logia tụt vào thì dầm cũng ngắt rồi tụt theo (đi dọc vách logia), mặt tiền xiên (V, Y) cũng có dầm.
    # Cạnh có dầm = (a) cạnh trục song song, nằm sát cạnh hộp bao có cửa sổ / lan can, (b) cạnh cách ứng viên (lan can, cửa sổ) ≤ 400,
    # (c) cạnh nối giữa hai cạnh đã chọn (vách bên của logia) ngắn ≤ 3500. Dày 220 phía trong.
    dam_s = None
    tims = [Polygon(p).buffer(0) for p in cat("tim") if len(p) >= 4]
    tims = [q for q in tims if q.geom_type == "Polygon" and q.area > 1e6]
    if tims and cand:
        env = max(tims, key=lambda q: q.area)
        ring = list(env.exterior.coords)
        if not env.exterior.is_ccw:
            ring = ring[::-1]
        tb = bbox_of(ring)
        fs = set()
        for cx, cy in cand:
            dd = {"L": abs(cx - tb[0]), "R": abs(cx - tb[2]), "B": abs(cy - tb[1]), "T": abs(cy - tb[3])}
            k = min(dd, key=dd.get)
            if dd[k] <= 400:
                fs.add(k)
        edges = [(ring[k], ring[k + 1]) for k in range(len(ring) - 1)]
        edges = [(a, b) for a, b in edges if math.hypot(b[0] - a[0], b[1] - a[1]) >= 300]
        pick = set()
        for k, (a, b) in enumerate(edges):
            sg = LineString([a, b])
            if any(sg.distance(Point(cx, cy)) <= 400 for cx, cy in cand):
                pick.add(k)
                continue
            ngang, dung = abs(a[1] - b[1]) < 5, abs(a[0] - b[0]) < 5
            if (ngang and ((a[1] - tb[1] < 150 and "B" in fs) or (tb[3] - a[1] < 150 and "T" in fs))) or                (dung and ((a[0] - tb[0] < 150 and "L" in fs) or (tb[2] - a[0] < 150 and "R" in fs))):
                pick.add(k)
        for k, (a, b) in enumerate(edges):
            if k in pick or math.hypot(b[0] - a[0], b[1] - a[1]) > 3500:
                continue
            tr = lambda q: any(Point(q).distance(LineString(edges[m])) <= 30 for m in pick)
            if tr(a) and tr(b):
                pick.add(k)
        dam_s = []
        for k in sorted(pick):
            (ax0, ay0), (ax1, ay1) = edges[k]
            L = math.hypot(ax1 - ax0, ay1 - ay0)
            nx, ny = -(ay1 - ay0) / L * 220, (ax1 - ax0) / L * 220     # CCW → pháp tuyến trái = hướng vào trong
            dam_s.append([[rnd(ax0), rnd(ay0)], [rnd(ax1), rnd(ay1)], [rnd(ax1 + nx), rnd(ay1 + ny)], [rnd(ax0 + nx), rnd(ay0 + ny)]])

    # ---------- Lover che điều hoà: hộp hidd gần đoạn lan can ----------
    hb = [bbox_of(p) for p in cat("hidd")]
    lovers = []
    for g in cluster(hb, lambda b: b):
        b = union_bbox([hb[i] for i in g])
        if max(b[2] - b[0], b[3] - b[1]) < 150:
            continue
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        best, bd = None, 1800
        for r in rails:
            rb2 = r["b"]
            dx = max(rb2[0] - b[2], b[0] - rb2[2], 0)
            dy = max(rb2[1] - b[3], b[1] - rb2[3], 0)
            d = math.hypot(dx, dy)
            if d <= bd:
                best, bd = r, d
        if best:
            rb2 = best["b"]
            ax = best["ax"]
            ra0, ra1 = (rb2[0], rb2[2]) if ax == "x" else (rb2[1], rb2[3])
            hc = cx if ax == "x" else cy
            a0 = max(ra0, min(hc - 450, ra1 - 900))
            a1 = min(ra1, a0 + 900)
            n0, n1 = (rb2[1], rb2[3]) if ax == "x" else (rb2[0], rb2[2])
            lovers.append({"ax": ax, "a": [rnd(a0), rnd(a1)], "n": [rnd(n0), rnd(n1)]})

    # ---------- Sàn: hợp tim + tường + lan can ----------
    parts = [Polygon(p) for p in cat("tim") if len(p) >= 4]
    parts = [q.buffer(0) for q in parts] + [Polygon(r).buffer(0) for r in walls]
    parts += [box(*r["b"]) for r in rails]
    slab = []
    if parts:
        u = unary_union(parts)
        for poly in (u.geoms if hasattr(u, "geoms") else [u]):
            if poly.area > 1e4:
                slab.append([[rnd(x), rnd(y)] for x, y in poly.exterior.coords[:-1]])

    return {"walls": walls, "openings": openings, "rails": rails, "lovers": lovers,
            "slab": slab, "sides": sorted(sides), "damS": dam_s, "bb": [rnd(v) for v in wb], "_skip": bo_qua}


def build_k3(verbose=False):
    geo = json.loads(GEO.read_text(encoding="utf-8"))
    units = {u["ma"]: u for u in json.loads(UNITS.read_text(encoding="utf-8"))}
    data = {}
    for ma, ents in geo.items():
        u = units.get(ma)
        if not u:
            continue
        # x chuẩn hoá = mặt tiền (dai_mm), y = chiều sâu (rong_mm) — xem chú thích CAD.u trong shell.src.html
        W, H = u["dai_mm"], u["rong_mm"]
        r = xu_ly(ma, ents, W, H)
        skip = r.pop("_skip")
        data[ma] = r
        if verbose:
            kinds = {}
            for o in r["openings"]:
                kinds[o["t"]] = kinds.get(o["t"], 0) + 1
            print(f"{ma:34s} tuong={len(r['walls']):3d} cua={kinds} lancan={len(r['rails'])} "
                  f"lover={len(r['lovers'])} mat_tien={r['sides']} bo_qua={skip}")
    # ---------- Lõi thang / buồng thang bộ (QT-116): cùng bộ nhận dạng, toạ độ mm cục bộ (x = dọc mặt, y = sâu) ----------
    if CORE.exists():
        cg = json.loads(CORE.read_text(encoding="utf-8"))
        for ma, v in cg.items():
            ents = [{"cat": p["cat"], "pts": p["pts"]} for p in v["paths"] if p["cat"] == "wall"]
            r = xu_ly(ma, ents, 1.0, 1.0)
            skip = r.pop("_skip")
            bb = v["bao_tuong_mm"]
            r["slab"] = [[[rnd(bb[0]), rnd(bb[1])], [rnd(bb[2]), rnd(bb[1])], [rnd(bb[2]), rnd(bb[3])], [rnd(bb[0]), rnd(bb[3])]]]
            r["bb"] = [rnd(x) for x in bb]
            r["sides"] = []
            r["damS"] = None
            r["lovers"] = []
            r["rails"] = []
            r["openings"] = []   # cửa lõi vẽ bằng cung 2 điểm (không có mốc khung) → để hở đúng chỗ tường ngắt, không dựng khung
            r["loi"] = 1
            data[ma] = r
            if verbose:
                print(f"{ma:34s} LOI tuong={len(r['walls']):3d} cua={len(r['openings'])} bo_qua={skip}")
    return data


if __name__ == "__main__":
    k3 = build_k3(verbose=True)
    OUT.write_text(json.dumps(k3, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("->", OUT.relative_to(ROOT), f"{OUT.stat().st_size / 1024:.0f} KB")
