"""P1a: add structured stage timing (from/to) and recruitOn to every unit. Idempotent."""
import json, glob, re, sys, os
ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')
routes = {r: json.load(open(os.path.join(ROOT, 'routes', r.lower() + '.json'))) for r in ['Cai', 'Dietrich', 'Theodora', 'Leda']}
ROUTES = ['Cai', 'Dietrich', 'Theodora', 'Leda']

def pt_at(s, default_part=1):
    """First point in a fragment: Part III / Part II Ch N / Ch N / Section."""
    s = s.strip()
    m = re.search(r'Part III', s)
    if m and (not re.search(r'\bCh \d', s[:m.start()])):
        sec = re.search(r'Section (\d+)', s)
        p = {'part': 3}
        if sec: p['ch'] = int(sec.group(1))
        return p
    m = re.search(r'Part II\b(?:,)?(?: Ch (\d+))?', s)
    ch = re.search(r'\b(early |late )?Ch (\d+)', s)
    if m and (not ch or m.start() < ch.start()):
        p = {'part': 2}
        if m.group(1): p['ch'] = int(m.group(1))
        return p
    if ch:
        p = {'part': 1, 'ch': int(ch.group(2))}
        if ch.group(1): p['at'] = ch.group(1).strip()
        return p
    return None

def parse(when, join, prev_from):
    w = when
    approx = False
    # split from/to on the first ' to ' / ' until ' / ' through ' that is outside parentheses
    depth = 0; cut = None; kw = None
    for i, chr_ in enumerate(w):
        if chr_ == '(': depth += 1
        elif chr_ == ')': depth -= 1
        elif depth == 0:
            for k in (' to ', ' until ', ', through ', ' through ', ', into ', ', and '):
                if w.startswith(k, i): cut, kw = i, k; break
            if cut is not None: break
    head, tail = (w[:cut], w[cut + len(kw):]) if cut is not None else (w, '')
    if re.match(r'^Join\b', head):
        inner = re.search(r'\((?:[^)]*?)(early |late )?Ch (\d+)', head)
        if inner:
            f = {'part': 1, 'ch': int(inner.group(2))}
            if inner.group(1): f['at'] = inner.group(1).strip()
        else:
            f = {'part': 1, 'ch': join}; approx = True
        if re.search(r' or Ch \d', head): approx = True
    else:
        f = pt_at(head)
        if f is None and re.match(r'^Lv', head) and prev_from:
            f = dict(prev_from); approx = True
        if f is None:
            f = {'part': 1, 'ch': join}; approx = True
        if re.search(r'\bor\b', head.split('(')[0]): approx = True
    if f.get('part') == 1 and f.get('ch') and f['ch'] < join:
        f['ch'] = join
    t = None
    if tail:
        lv = re.match(r'^Lv (\d+)', tail.strip())
        bare = re.match(r'^(\d+)\b', tail.strip())
        if lv: t = {'lv': int(lv.group(1))}
        elif bare: t = {'part': f.get('part', 1), 'ch': int(bare.group(1))}
        else:
            t = pt_at(tail)
            if t and t.get('part') == 1 and 'ch' not in t: t = None
            if t and t.get('part') == 1 and f.get('part', 1) > 1 and 'Part I' not in tail: t['part'] = f['part']
    if approx: f['approx'] = True
    return f, t

def rank(p):
    return (p.get('part', 1), p.get('ch', 0))

def timing(stages, join, who, report):
    prev = None
    for s in stages:
        f, t = parse(s['when'], join, prev)
        if prev and rank(f) < rank(prev):
            report.append(f"{who}: '{s['when']}' parsed before previous stage; clamped")
            f = dict(prev); f['approx'] = True
        new = {}
        for k, v in s.items():
            if k in ('from', 'to'): continue
            new[k] = v
            if k == 'when':
                new['from'] = f
                if t: new['to'] = t
        s.clear(); s.update(new)
        if f.get('approx'): report.append(f"{who}: approx from for '{s['when']}' -> {f}")
        prev = f

def req(text):
    if not text or text.strip() in ('—', '-'): return None
    if text.startswith('Auto'):
        return {'how': 'auto'}
    m = re.match(r'(\d)S (\d+)R(?: \((.*)\))?', text)
    if not m: return {'how': 'recruit', 'task': text}
    o = {'how': 'recruit', 'support': int(m.group(1)), 'renown': int(m.group(2))}
    extra = m.group(3)
    if extra:
        g = re.match(r'([\d,]+)G$', extra)
        if g: o['gold'] = int(g.group(1).replace(',', ''))
        else: o['item'] = extra
    return o

report = []
for f in sorted(glob.glob(os.path.join(ROOT, 'characters', '*.json'))):
    c = json.load(open(f))
    name = c['name']
    home = c.get('homeRoute')
    g = c.get('guide') or {}
    if g.get('stages'):
        join = 1
        if home:
            e = next((x for x in routes[home]['roster'] if x['name'] == name), None)
            join = e['chapter'] if e else 1
        timing(g['stages'], join, f"{name}/home", report)
    for cp in c.get('copies', []):
        if (cp.get('guide') or {}).get('stages'):
            timing(cp['guide']['stages'], cp.get('chapter', 1), f"{name}/{cp['route']}", report)
    # recruitOn
    ro = {}
    for r in ROUTES:
        txt = (c.get('requirements') or {}).get(r)
        o = req(txt) if txt else None
        if name == r: o = {'how': 'lord'}
        if not o: continue
        rec = c.get('recruit') or {}
        if r == home and rec.get('extra') and o.get('how') == 'recruit': o.setdefault('task', rec['extra'])
        cp = next((x for x in c.get('copies', []) if x['route'] == r), None)
        if cp and cp.get('cost') and 'item' not in o and 'gold' not in o: o['task'] = cp['cost']
        fl = next((x for x in routes[r].get('fillers', []) if x['name'] == name), None)
        if fl and 'item' not in o and 'gold' not in o:
            m = re.search(r'Renown \d+, (.*)$', fl.get('cost', ''))
            if m: o['task'] = m.group(1)
        ro[r] = o
    if ro: c['recruitOn'] = ro
    json.dump(c, open(f, 'w'), ensure_ascii=False, indent=2)
    open(f, 'a').write('\n')
print('\n'.join(report))
print(len(report), 'notes')
