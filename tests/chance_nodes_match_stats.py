#!/usr/bin/env python3
"""Summarize h2h_ab.py's final W-L-D score with a 95% Elo interval.

The score standard error uses the observed variance of game outcomes 1, 0, .5
and the unbiased sample-variance estimate. Transform the normal 95% score
interval through 400*log10(p/(1-p)); this is an approximate trinomial interval,
not a claim of significance from a partial match.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
from statistics import NormalDist

ap = argparse.ArgumentParser(description=__doc__)
ap.add_argument('log', type=Path)
a = ap.parse_args()
text = a.log.read_text()
m = re.search(r'FINAL A (\d+)-(\d+)-(\d+) games=(\d+)', text)
if not m:
    raise SystemExit('Match is incomplete: no FINAL line')
w, l, d, n = map(int, m.groups())
assert n == w + l + d and n > 1
p = (w + .5*d)/n
se = math.sqrt((w*(1-p)**2 + l*p**2 + d*(.5-p)**2)/(n*(n-1)))
z = NormalDist().inv_cdf(.975)
def elo(score):
    if score <= 0:
        return '-inf'
    if score >= 1:
        return '+inf'
    return 400*math.log10(score/(1-score))
lo, hi = max(0., p-z*se), min(1., p+z*se)
print(json.dumps(dict(wins=w, losses=l, draws=d, games=n, score=p,
    score_percent=100*p, score_standard_error=se, score_95_interval=[lo,hi],
    elo=elo(p), elo_95_interval=[elo(lo),elo(hi)],
    interval_method='normal score interval from unbiased trinomial sample variance, transformed to Elo',
    log_sha256=hashlib.sha256(a.log.read_bytes()).hexdigest()), indent=2))
