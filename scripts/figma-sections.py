# Fetch the Color Palette, Typography and Effects frames in full and summarize them.
import json, sys, time, urllib.request, urllib.error, collections, re
root, key, S = sys.argv[1:4]
tok = next(l.split('=',1)[1].strip().strip('"').strip("'") for l in open(f'{root}/.env') if l.startswith('FIGMA_TOKEN='))
page = json.load(open(f'{S}/design-system.json'))['nodes']['234:1829']['document']
want = {'Color Palette', 'Typography', 'Effects', 'Buttons 1', 'Grids & Spacing'}
ids = {c['name']: c['id'] for c in page['children'] if c['name'] in want}
print('sections:', ids)

def get(path):
    req = urllib.request.Request('https://api.figma.com' + path, headers={'X-Figma-Token': tok})
    for i in range(4):
        try:
            with urllib.request.urlopen(req, timeout=180) as r: return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429 and i < 3: time.sleep(min(int(e.headers.get('Retry-After','15')),60)); continue
            print('HTTP', e.code, e.read().decode('utf8','replace')[:200]); return None

res = get('/v1/files/%s/nodes?ids=%s' % (key, ','.join(ids.values())))
json.dump(res, open(f'{S}/sections.json','w'))

def hexof(c):
    return '#%02X%02X%02X' % (round(c['r']*255), round(c['g']*255), round(c['b']*255))

def walk(n, fn, path=()):
    fn(n, path)
    for c in n.get('children', []): walk(c, fn, path + (n.get('name',''),))

for name, nid in ids.items():
    doc = res['nodes'][nid]['document']
    print(f'\n=== {name} ===')
    if name == 'Color Palette':
        texts = []; fills = collections.Counter(); pairs = []
        def f(n, path):
            if n['type'] == 'TEXT': texts.append((path[-1] if path else '', n['characters'].strip()))
            for fl in n.get('fills', []):
                if fl.get('type') == 'SOLID' and fl.get('visible', True) and n['type'] in ('RECTANGLE','ELLIPSE','FRAME','VECTOR'):
                    fills[hexof(fl['color'])] += 1
                    pairs.append((n.get('name',''), path[-1] if path else '', hexof(fl['color']), round(fl.get('opacity',1),2)))
        walk(doc, f)
        print('text labels (first 120):'); print('  ' + ' | '.join(t for _, t in texts[:120]))
        print('named swatches (name, parent, hex) first 140:')
        seen=set()
        for p in pairs:
            k=(p[0],p[2])
            if k in seen: continue
            seen.add(k); print('  ', p)
            if len(seen)>=140: break
    elif name == 'Typography':
        styles = collections.OrderedDict()
        def f(n, path):
            if n['type'] == 'TEXT' and 'style' in n:
                st = n['style']; k = (st.get('fontFamily'), st.get('fontWeight'), st.get('fontSize'), round(st.get('lineHeightPx',0)), round(st.get('letterSpacing',0),2))
                styles.setdefault(k, []).append((path[-1] if path else '', n['characters'][:40].replace('\n',' ')))
        walk(doc, f)
        for k, v in sorted(styles.items(), key=lambda kv: -kv[0][2]):
            print('  ', k, '←', v[0], f'(x{len(v)})')
    elif name == 'Effects':
        def f(n, path):
            for e in n.get('effects', []):
                if e.get('visible', True):
                    c = e.get('color', {}); print('  ', n.get('name'), '|', e['type'], 'offset', e.get('offset'), 'radius', e.get('radius'), 'spread', e.get('spread'), 'color', hexof(c) if c else None, 'a', round(c.get('a',1),2) if c else None)
        walk(doc, f)
    else:
        radii = collections.Counter(); names=[]
        def f(n, path):
            if n.get('cornerRadius'): radii[n['cornerRadius']] += 1
            if n['type']=='TEXT' and len(names)<30: names.append(n['characters'][:30].replace('\n',' '))
        walk(doc, f)
        print('  corner radii:', radii.most_common(8)); print('  labels:', ' | '.join(names))
