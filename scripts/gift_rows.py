"""Writes routine.gifts for Leda and Theodora chapters 4-12 (D-97, D-98).

Every unit that joins through Support (roster, extras, fillers in routes/<route>.json) gets a weekly gift row from
the chapter they are in Dagsion (4, or their appearance date) until their recruit chapter; Support 1 units only in
their first chapter.

Pick rules (gifts.json is the source):
  1. Never an item in gifts.json `avoid` for that unit, or in `characters.<unit>.not`. An entry can name an item
     ("Mellow Pastries"), a list ("Saraminian Sweets, Mellow and Simple Pastries"), a catalog category ("Coffee",
     "Sweets", "Reading material" = book lovers) or a word that ends item names ("Ghosh").
  2. Tier: loved (3) > really (2) > liked (1: the item's `likes` category is in `characters.<unit>.categories`, or
     the item is in its `extra`). Item-level lists win over categories.
  3. Only items buyable by that chapter: a Dagsion stall (`dagsion` shop) whose `from` chapter has come and whose
     stock isn't `conf: unconfirmed`, or a settlement the route has visited by then (TRIPS, see `sourcing`), at or
     under ROAD_CAP. Within a tier: Dagsion before a trip, then the cheaper item.
  4. An unconfirmed Dagsion item may only be the `alt`, never the gift. Nothing buyable: a cheap liked item if any,
     else no row gift (meals carry the unit) and a note.

Rerun after changing gifts.json, rosters or fillers. `write` overwrites hand corrections in the chapter files, so
check first:
    python3 scripts/gift_rows.py verify      # checks current chapter files and the script's picks, writes nothing
    python3 scripts/gift_rows.py leda        # dry run: print the rows for one route
    python3 scripts/gift_rows.py write
"""
import json,re,sys
import os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
G=json.load(open(f'{ROOT}/gifts.json'))
GB={g['name']:g for g in G['gifts']}
DAG={k for k,v in G['shops'].items() if v['dagsion']}
ROAD_CAP=1000
CH=G.get('characters',{})
CAT_ALIAS={'reading material':'book lovers','fermented drinks (ghosh, shosh)':'fermented drinks'}
NAMES={g['name'].lower():g['name'] for g in G['gifts']}
CATS={g['likes'] for g in G['gifts'] if g.get('likes')}
def _blocked(what):
    """Item names blocked by one avoid/not entry."""
    out=set(); parts=[p.strip() for p in re.split(r',| and ',what) if p.strip()]
    tail=parts[-1].split()[-1] if parts else ''
    for p in parts:
        k=p.lower(); cat=CAT_ALIAS.get(k,k)
        if k in NAMES: out.add(NAMES[k]); continue
        if f'{k} {tail.lower()}' in NAMES: out.add(NAMES[f'{k} {tail.lower()}']); continue
        if cat in CATS: out|={g['name'] for g in G['gifts'] if g.get('likes')==cat}
        out|={g['name'] for g in G['gifts'] if re.search(rf'\b{re.escape(k)}\b',g['name'].lower())}
    return out
AVOID={}
for e in G.get('avoid',[]):
    for w in e['who']: AVOID.setdefault(w,set()).update(_blocked(e['what']))
for u,c in CH.items():
    for w in c.get('not') or []: AVOID.setdefault(u,set()).update(_blocked(w))
def tier(u,g):
    if g['name'] in AVOID.get(u,()): return 0
    if u in g['loved']: return 3
    if u in g['really']: return 2
    c=CH.get(u,{})
    return 1 if g.get('likes') in (c.get('categories') or []) or g['name'] in (c.get('extra') or []) else 0
def dag(g,ch): return any(s['shop'] in DAG and s.get('from',0)<=ch and s.get('conf')!='unconfirmed' for s in g['sold'])
def unconf(g,ch): return any(s['shop'] in DAG and s.get('from',0)<=ch and s.get('conf')=='unconfirmed' for s in g['sold'])
TRIPS={'leda':{4:['Regia','Daimon','Yaaman'],5:['Regia','Daimon','Yaaman'],6:['Regia','Daimon','Yaaman','Raivo Port'],7:['Alecto','Mons','Fina Peddler'],9:['Megaira','Orens','Port of Pandora','Mahon Castle Town','Twalinn','Breston','Whill'],10:['Osiris','Niiza Port'],11:['Benetnasch']},
       'theodora':{6:['Alecto'],7:['Raivo Port'],9:['Megaira'],10:['Port of Pandora']}}
TRIPNAME={'Regia':'Regia dance','Daimon':'Daimon dance','Yaaman':'Yaaman dance','Raivo Port':'Raivo Port','Alecto':'Alecto','Mons':'Mons','Megaira':'Megaira','Port of Pandora':'Port of Pandora','Breston':'Breston','Niiza Port':'Niiza Port','Orens':'Orens','Whill':'Whill','Osiris':'Osiris','Benetnasch':'Benetnasch','Twalinn':'Twalinn','Mahon Castle Town':'Mahon','Fina Peddler':'Fina','Daimon':'Daimon','Yaaman':'Yaaman'}
APPEAR={'Benditz':(4,11),'Jasmine':(5,8),'Alexandra':(5,29),'Nuzzuo':(7,1),'Inyoni':(7,10),'Kiroc':(5,4)}
SKIP={'leda':{'Catania'},'theodora':{'Sofia'}}
def md(s): m,d=map(int,s.split('/')); return (m,d)
def chap_of(route,date):
    for ch in range(4,13):
        f=json.load(open(f'{ROOT}/site/src/data/walkthrough/{route}/ch{ch:02d}.json'))['free']
        if f and md(f['to'])>=date: return ch
    return 12
def targets(route):
    R=route.title(); d=json.load(open(f'{ROOT}/site/src/data/routes/{route}.json'))
    out=[]
    def ch_json(n): return json.load(open(f'{ROOT}/site/src/data/characters/{n.lower().replace(" ","-")}.json'))
    units=[(u['name'],u['chapter'],'army') for u in d['roster']]
    for n in d['extras']:
        c=ch_json(n); cp=[x for x in c.get('copies',[]) if x.get('route')==R]
        units.append((n,cp[0]['chapter'] if cp else 10,'army'))
    for f in d.get('fillers',[]):
        m=re.search(r'Ch (\d+)',f['when']); units.append((f['name'],int(m.group(1)) if m else 10,'filler'))
    for n,join,kind in units:
        if n in SKIP[route]: continue
        g=(ch_json(n).get('recruitOn') or {}).get(R)
        if not g or g.get('how')!='recruit' or not g.get('support'): continue
        start=chap_of(route,APPEAR[n]) if n in APPEAR else 4
        out.append(dict(name=n,join=join,support=g['support'],start=start,kind=kind))
    return out
def seen(route,ch): return {t for c in range(4,ch+1) for t in TRIPS[route].get(c,[])}
def road(route,g,ch): return (g['price'] or 9e9)<=ROAD_CAP and any(s['shop'] in seen(route,ch) for s in g['sold'])
def buyable(route,g,ch): return dag(g,ch) or road(route,g,ch)
def pick(route,u,ch):
    """(gift, alt, trip): trip is the settlement on this chapter's trips that sells the gift, 'FAR' when nothing
    buyable is liked, else None."""
    likes=[g for g in G['gifts'] if tier(u,g)]
    ok=sorted([g for g in likes if buyable(route,g,ch)],key=lambda g:(-tier(u,g),not dag(g,ch),g['price'] or 9e9))
    unc=sorted([g for g in likes if not buyable(route,g,ch) and unconf(g,ch)],key=lambda g:(-tier(u,g),g['price'] or 9e9))
    if not ok: return None,(unc[0]['name'] if unc else None),'FAR'
    g=ok[0]; trip=None
    if not dag(g,ch):
        here=[s['shop'] for s in g['sold'] if s['shop'] in TRIPS[route].get(ch,[])]
        trip=here[0] if here else None
    alt=None
    if unc and tier(u,unc[0])>tier(u,g): alt=unc[0]['name']
    elif len(ok)>1: alt=ok[1]['name']
    return g['name'],alt,trip
def check(route,ch,row):
    """Problems with one routine.gifts row: avoided, not liked, or not buyable by this chapter."""
    out=[]; u=row['unit']
    for key in ('gift','alt'):
        n=row.get(key)  # '' = meals only: nothing liked is buyable that chapter
        if not n: continue
        g=GB.get(n)
        if not g: out.append(f"{key} {n}: not in gifts.json"); continue
        if n in AVOID.get(u,()): out.append(f"{key} {n}: in avoid/not for {u}")
        elif not tier(u,g) and not (key=='gift' and str(row.get('note','')).startswith('Bond only')):
            out.append(f"{key} {n}: {u} doesn't like it")
        if not buyable(route,g,ch) and not (key=='alt' and unconf(g,ch)): out.append(f"{key} {n}: not buyable by Ch {ch}")
    return out
def rows(route,ch):
    out=[]
    for t in targets(route):
        last = t['start'] if t['support']==1 else t['join']
        if ch<t['start'] or ch>max(last,t['start']): continue
        g,alt,trip=pick(route,t['name'],ch)
        notes=[]; first=False
        if ch==t['start']:
            if t['name'] in APPEAR: notes.append(f"In Dagsion from {APPEAR[t['name']][0]}/{APPEAR[t['name']][1]}")
            first = not g or (GB[g]['price'] or 0)>30
        else: first=False
        if trip=='FAR': notes.append("Nothing they like is buyable yet: meals carry them")
        elif trip: notes.append(f"Buy several on the {TRIPNAME.get(trip,trip)} trip")
        if not g:
            # Nothing liked is buyable yet. The first week still needs a gift: any gift opens the bond and the meal
            # invite. Later weeks list the unit with no gift ("meals only") so the sheet still shows the whole roster.
            if ch==t['start']:
                cheap=sorted([x for x in G['gifts'] if dag(x,ch) and x['name'] not in AVOID.get(t['name'],())],key=lambda x:x['price'] or 9e9)
                g=cheap[0]['name']; first=False
                notes=[n for n in notes if not n.startswith('Nothing they like')]+["Bond only: nothing they like is buyable yet, so meals carry the Support"]
            else:
                g=''
        row={'unit':t['name'],'gift':g}
        if alt and alt!=g: row['alt']=alt
        row['until']=f"Support {t['support']}" + (f", recruit Ch {t['join']}" if t['support']>1 or t['join']>ch else "")
        if t['kind']=='filler': row['until']+=" (filler)"
        if first: row['first']=True
        if notes: row['note']='; '.join(n[0].lower()+n[1:] if i else n for i,n in enumerate(notes))
        out.append(row)
    order={t['name']:(t['join'],-t['support']) for t in targets(route)}
    out.sort(key=lambda r:order[r['unit']])
    return out
def write(route):
    import os
    for ch in range(4,13):
        f=f'{ROOT}/site/src/data/walkthrough/{route}/ch{ch:02d}.json'
        d=json.load(open(f,encoding='utf-8'))
        if d['routine'] is None: continue
        rs=rows(route,ch)
        if rs: d['routine']['gifts']=rs
        else: d['routine'].pop('gifts',None)
        open(f,'w',encoding='utf-8').write(json.dumps(d,ensure_ascii=False,indent=2)+"\n")

def verify():
    bad=0
    for r in ['leda','theodora']:
        for ch in range(4,13):
            d=json.load(open(f'{ROOT}/site/src/data/walkthrough/{r}/ch{ch:02d}.json',encoding='utf-8'))
            for row in (d.get('routine') or {}).get('gifts') or []:
                for p in check(r,ch,row): print(f'FILE   {r} ch{ch} {row["unit"]}: {p}'); bad+=1
            for row in rows(r,ch) if d.get('routine') else []:
                for p in check(r,ch,row): print(f'SCRIPT {r} ch{ch} {row["unit"]}: {p}'); bad+=1
    print(f'{bad} problem(s)')
    return bad

if __name__=='__main__' and sys.argv[1:]==['write']:
    for r in ['leda','theodora']: write(r)
    print('routine.gifts written for leda and theodora')
elif __name__=='__main__' and sys.argv[1:]==['verify']:
    sys.exit(1 if verify() else 0)
elif __name__=='__main__':
    route=sys.argv[1]
    for t in targets(route): print(t)
    for ch in range(4,13):
        rs=rows(route,ch); print('CH',ch,len(rs))
        for r in rs: print('  ',json.dumps(r,ensure_ascii=False))
