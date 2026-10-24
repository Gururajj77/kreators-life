# Re-pull the kit from Figma. Needs FIGMA_TOKEN in .env. See design/figma-tokens.json for the frozen result.
# Pull published styles (and the linked node) from a Figma file over REST.
# Usage: python3 -I pull.py <repo-root> <fileKey> <nodeId> <out-dir>
import json, sys, time, urllib.request, urllib.error, pathlib
root, key, node_id, out = sys.argv[1:5]
tok = next(l.split('=',1)[1].strip().strip('"').strip("'") for l in open(f'{root}/.env') if l.startswith('FIGMA_TOKEN='))
out = pathlib.Path(out); out.mkdir(exist_ok=True)

def get(path, tries=4):
    req = urllib.request.Request('https://api.figma.com' + path, headers={'X-Figma-Token': tok})
    for i in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf8', 'replace')[:300]
            if e.code == 429 and i < tries - 1:
                wait = int(e.headers.get('Retry-After', '15')); time.sleep(min(wait, 60)); continue
            print(f'HTTP {e.code} on {path}: {body}'); return None
    return None

meta = get(f'/v1/files/{key}?depth=1')
if meta:
    (out/'file-meta.json').write_text(json.dumps(meta, indent=1))
    print('file:', meta.get('name'), '| last modified', meta.get('lastModified'), '| version', meta.get('version'))
    for p in meta['document']['children']:
        print('  page:', p['name'], p['id'])

styles = get(f'/v1/files/{key}/styles')
if styles:
    (out/'styles.json').write_text(json.dumps(styles, indent=1))
    items = styles['meta']['styles']
    by = {}
    for s in items: by.setdefault(s['style_type'], []).append(s)
    print('published styles:', {k: len(v) for k, v in by.items()})
    ids = [s['node_id'] for s in items]
    nodes = {}
    for i in range(0, len(ids), 40):
        chunk = ids[i:i+40]
        res = get(f'/v1/files/{key}/nodes?ids=' + ','.join(chunk))
        if res: nodes.update(res['nodes'])
    (out/'style-nodes.json').write_text(json.dumps(nodes, indent=1))
    print('style nodes fetched:', len(nodes))

v = get(f'/v1/files/{key}/variables/local')
if v:
    (out/'variables.json').write_text(json.dumps(v, indent=1)); print('variables: available')

linked = get(f'/v1/files/{key}/nodes?ids={node_id.replace("-", ":")}&depth=2')
if linked:
    (out/'linked-node.json').write_text(json.dumps(linked, indent=1))
    for nid, n in linked['nodes'].items():
        d = n['document']; print('linked node:', d.get('name'), d.get('type'), '| children:', len(d.get('children', [])))
        for c in d.get('children', [])[:40]: print('   -', c.get('type'), c.get('name'))
