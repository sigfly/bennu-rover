"""Produce a single self-contained HTML document from NASA SVS source products."""
import argparse, base64, pathlib, urllib.request, shutil, json, struct, hashlib, concurrent.futures
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache'
BASE = 'https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005069/'
MODELS = {'standard': 'g_00880mm_alt_ptm_0000n00000_v020.glb', 'ultra': 'bennu_OLA_v21_PTM_very-high.glb'}
MOSAIC = 'Bennu_global_FB34_FB56_ShapeV28_GndControl_MinnaertPhase30_PAN_8bit.tif'

def download(name, dest):
    if dest.exists(): return
    tmp = dest.with_suffix(dest.suffix + '.partial')
    with urllib.request.urlopen(BASE + name, timeout=180) as response, tmp.open('wb') as out:
        shutil.copyfileobj(response, out, 1024 * 1024)
    tmp.replace(dest)

def truck_asset():
    # Original CC0 GLB is vendored in bounded binary parts so builds never
    # depend on the asset host. Reassemble losslessly and verify the full hash.
    path = CACHE / 'monster-truck.glb'
    checksum = '0d8f272006245a54656bea5de7b44b0f535ec6d761f64a0044d8d88f2d2c9380'
    def valid(p):
        return p.is_file() and p.stat().st_size == 1277496 and hashlib.sha256(p.read_bytes()).hexdigest() == checksum
    if not valid(path):
        parts = [ROOT / 'assets' / 'monster-truck' / f'part-{i:02d}.bin' for i in range(26)]
        temp = path.with_suffix('.partial')
        with temp.open('wb') as out:
            for part in parts:
                with part.open('rb') as inp: shutil.copyfileobj(inp, out)
        if not valid(temp): raise ValueError('Vendored monster truck asset hash mismatch')
        temp.replace(path)
    if inspect_model(path) != 19973: raise ValueError('Monster truck triangle count mismatch')
    return path

def landmark_assets():
    catalog = json.loads((ROOT / 'landmark-manifest.json').read_text())
    folder = CACHE / 'landmarks'
    folder.mkdir(exist_ok=True)
    base = 'https://raw.githubusercontent.com/codriver-io/codriver-3d-assets/' + catalog['upstream'] + '/'
    def get(entry):
        dest = folder / (entry['id'] + '.glb')
        def valid(path):
            if not path.exists() or path.stat().st_size != entry['bytes']: return False
            return hashlib.sha256(path.read_bytes()).hexdigest() == entry['sha256']
        if not valid(dest):
            temp = dest.with_suffix('.partial')
            request = urllib.request.Request(base + entry['path'], headers={'User-Agent': 'Bennu-Rover-build'})
            with urllib.request.urlopen(request, timeout=120) as response, temp.open('wb') as out:
                shutil.copyfileobj(response, out)
            if not valid(temp): raise ValueError('Landmark hash mismatch: ' + entry['id'])
            temp.replace(dest)
        if inspect_model(dest) != entry['triangles']: raise ValueError('Landmark triangle count mismatch: ' + entry['id'])
        return entry['id'], dest
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        return list(pool.map(get, catalog['models']))

def inspect_model(path):
    with path.open('rb') as f:
        magic, version, size, jsonlen, kind = struct.unpack('<5I', f.read(20))
        if magic != 0x46546c67 or version != 2 or size != path.stat().st_size or kind != 0x4e4f534a:
            raise ValueError('Invalid or incomplete glTF binary')
        data = json.loads(f.read(jsonlen))
    counts = sum(data['accessors'][p['indices']]['count']//3 for m in data['meshes'] for p in m['primitives'])
    return counts

def embed(out, path, name):
    out.write(f'<script type="application/octet-stream" id="{name}">\n')
    with path.open('rb') as f:
        while chunk := f.read(3 * 1024 * 1024):
            out.write(base64.b64encode(chunk).decode('ascii'))
            out.write('\n')
    out.write('</script>\n')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--edition', choices=MODELS, default='standard')
    parser.add_argument('--texture', type=int, choices=[4096,8192,16384], default=8192)
    args = parser.parse_args()
    CACHE.mkdir(exist_ok=True)
    model = CACHE / ('bennu.glb' if args.edition == 'standard' else 'bennu-ultra.glb')
    download(MODELS[args.edition], model)
    triangles = inspect_model(model)
    mosaic = CACHE / 'mosaic.tif'
    download(MOSAIC, mosaic)
    texture = CACHE / f'mosaic-{args.texture}.jpg'
    if not texture.exists():
        Image.MAX_IMAGE_PIXELS = 600_000_000
        with Image.open(mosaic) as image:
            if image.size != (31417,15709): raise ValueError(f'Unexpected mosaic dimensions: {image.size}')
            image.convert('L').resize((args.texture,args.texture//2),Image.Resampling.LANCZOS).save(texture, quality=92, optimize=True)
    landmarks = landmark_assets()
    truck = truck_asset()
    bundle = (CACHE/'app.js').read_text()
    html = (ROOT/'src/index.html').read_text()
    first, last = html.split('<!-- EMBED -->')
    dest = ROOT / 'dist' / 'index.html'
    dest.parent.mkdir(exist_ok=True)
    with dest.open('w', encoding='utf-8') as out:
        out.write(first)
        out.write(f'<script>window.BENNU_CONFIG={json.dumps(dict(edition=args.edition, triangles=triangles, texture=args.texture))};</script>\n')
        embed(out, model, 'bennu-model')
        embed(out, texture, 'bennu-texture')
        for name, path in landmarks: embed(out, path, 'landmark-' + name)
        embed(out, truck, 'monster-truck-model')
        out.write('<script>'+bundle.replace('</script','<\\/script')+'</script>\n')
        out.write(last)
    print(f'{dest}: {dest.stat().st_size/1024**2:.1f} MiB; {triangles:,} triangles; {args.texture}px imagery')

if __name__ == '__main__': main()
