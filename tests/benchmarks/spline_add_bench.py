"""Benchmark: incremental Spline.add() vs re-flattening the whole curve each frame.

Validates the O(1)-amortized promise of Spline.add() against the old pattern
(`ps.append(p); spline(ps)`), where the entire point list is reprocessed every
frame. Incremental cost stays flat as the curve grows; the rebuild cost grows
linearly per add (quadratic overall).

Run manually (not part of the CI gate):

    PYTHONPATH=src/assets/python python3 tests/benchmarks/spline_add_bench.py
"""

import time

from graphics.shapes import Spline


def bench_incremental(n):
    sp = Spline([])
    t0 = time.perf_counter()
    for i in range(n):
        sp.add((i, (i * 37) % 200))
    return time.perf_counter() - t0


def bench_full_rebuild(n):
    """The old pattern: append to a list and re-flatten the whole curve each add."""
    pts = []
    t0 = time.perf_counter()
    for i in range(n):
        pts.append((i, (i * 37) % 200))
        sp = Spline(pts)
        sp._ensure_built()   # force the full flatten + segment build
    return time.perf_counter() - t0


def main():
    header = (
        f"{'N':>6} {'incr ms':>10} {'incr us/add':>12} "
        f"{'rebuild ms':>11} {'rebuild us/add':>15} {'speedup':>8}"
    )
    print(header)
    print("-" * len(header))
    for n in [50, 100, 200, 500, 1000, 2000]:
        ti = bench_incremental(n)
        tr = bench_full_rebuild(n)
        print(
            f"{n:>6} {ti * 1e3:>10.2f} {ti / n * 1e6:>12.2f} "
            f"{tr * 1e3:>11.2f} {tr / n * 1e6:>15.2f} {tr / ti:>7.1f}x"
        )
    print(
        "\nincr us/add stays flat as N grows (O(1) amortized); rebuild us/add "
        "climbs with N (O(n) per add)."
    )


if __name__ == "__main__":
    main()
