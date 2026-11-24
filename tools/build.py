"""Produce a single self-contained HTML document from NASA SVS source products."""
import argparse, base64, pathlib, urllib.request, shutil, json, struct
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
        out.write('<script>'+bundle.replace('</script','<\\/script')+'</script>\n')
        out.write(last)
    print(f'{dest}: {dest.stat().st_size/1024**2:.1f} MiB; {triangles:,} triangles; {args.texture}px imagery')

if __name__ == '__main__': main()
