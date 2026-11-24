# Bennu / Rover

A full-surface, standalone WebGL 2 driving explorer for asteroid (101955) Bennu, built from NASA OSIRIS-REx's measured shape and photographic mosaic. Every rock represented in the input geometry is real geometry; no invented terrain is used.

## Download

Open [Actions → Build offline rover](https://github.com/sigfly/bennu-rover/actions/workflows/build.yml), choose a run, and download `bennu-rover-standard-8192` or `bennu-rover-ultra-16384`. Both are built automatically. Unzip the artifact and open `index.html` directly in a recent desktop browser. Once built, the HTML needs no server, dependencies, installation or internet connection. GitHub may require sign-in to download artifacts.

## Drive

* **W/S or ↑/↓** accelerate forward/reverse; **A/D or ←/→** steer. **Space** brakes. On-screen arrow controls support touch.
* **C** cycles chase, cockpit and orbit; use the mouse to drag and zoom in orbit.
* Teleport to latitude/longitude or the approximate Nightingale and Osprey sample sites. The whole asteroid is reachable by teleportation; some boulders and slopes are too steep to drive over.
* Adjust illumination, speed limit or the photographic texture. Switch photos off to inspect the actual shape independently of imaging.

## Optional expedition: dinosaur fossil hunt

Enable **Dinosaur fossil hunt** in the expedition panel. Twenty fictional, life-scale excavations are distributed over Bennu using a Fibonacci sphere. Rotate the asteroid or drive to a site, click the weathered bones to catalogue the specimen, and watch it turn green. The counter and collection list persist when you toggle the mode off and back on; reset starts a new case. Find all twenty to unlock a black-and-white 1950s detective-film title card.

The specimens are original procedural reconstructions, not 3D scans, archaeological measurements, or real fossils on Bennu. Articulated and partly dispersed bones, open skull fenestrae, individually shaped ribs, flared limb-bone ends and vertebral chains are inspired by excavation imagery. They are flattened into fossil-bed poses and conformed to the actual NASA shape via sub-metre terrain sampling; all skeletal geometry is scaled to the approximate adult body length (5.5–26 m) listed in the Natural History Museum's Dino Directory. Some taxa have incomplete fossil records; proportions and inferred bones are illustrative rather than scientific reconstructions.

References: [Smithsonian Carnegie Quarry excavation photograph](https://www.si.edu/object/close-skeleton-dinosaur-national-monument-quarry%3Asiris_arc_367764), [USGS Dinosaur Quarry photo](https://www.usgs.gov/media/images/dinosaur-national-monument-dinosaur-quarry-1), [NPS Quarry Exhibit Hall](https://www.nps.gov/dino/planyourvisit/quarry-exhibit-hall.htm), [NPS 2025 excavation](https://www.nps.gov/dino/learn/news/parkinglotfossilsexcavated.htm), and [Natural History Museum Dino Directory](https://www.nhm.ac.uk/discover/dino-directory.html). Individual taxon reference pages and measured lengths are listed in [FOSSILS.md](FOSSILS.md).

## Data and editions

| Edition | Source shape | Embedded imagery | Typical use |
|---|---|---|---|
| Standard | OLA v20 PTM, 3,366,134 triangles, nominal ~0.88 m product | 8192 × 4096 by default | Desktop driving |
| Ultra | OLA v21 PTM, ~17.9 million triangles | Up to 16384 × 8192 | High-memory desktop GPUs |

The source global OCAMS PolyCam panchromatic mosaic has 31,417 × 15,709 pixels (~5 cm/pixel on its 250 m reference sphere). For browser compatibility it is resampled to 4K, 8K or 16K, corresponding to ~38, 19 or 9.6 cm/pixel at the equator. The texture is spherical/equirectangular and has an adjustable longitude alignment. It is not texture-mapped with a photogrammetric mesh-specific camera solution. Source-image shadows may remain visible when changing lighting.

NASA's original indexed triangles are preserved; glTF's axis transform is applied and coordinates are converted from kilometres to metres. Collision queries use a bounding volume hierarchy and cast radial rays to the outermost measured surface. The algorithm rejects abrupt steps and steep slopes; this is a surface-following rover game, **not an engineering-grade multibody simulator**. Bennu's real microgravity is far too weak for normal Earth-like driving, so the fictional rover adheres to the surface. Slopes and radii are approximate local mesh measurements; angle is relative to the radial direction, not local effective gravity. Overhangs and caves cannot be explored by this radial model. The rover and starfield are illustrative.

The standard file is approximately 101 MiB and ultra approximately 493 MiB, with significantly higher runtime memory use. Ultra is experimental and may require several GB of RAM and VRAM; reduce image width if the GPU cannot accommodate the texture. GPU texture-size limits are detected and the loaded width is displayed. The large generated HTML and raw NASA data are intentionally not checked into Git: the build downloads the original assets and packages them into HTML.

## Reproduce locally

Requires Node 22+, Python 3.10+, internet for the initial build and several GB of free disk/RAM.

```sh
npm ci
python -m pip install Pillow==11.3.0
npm test
npm run build
```

Open `dist/index.html`. For an ultra edition (or smaller image):

```sh
node tools/bundle.mjs
python tools/build.py --edition ultra --texture 16384
```

The `.cache` directory retains downloaded and derived assets, so subsequent builds work without redownloading. Delete individual stale cached products if a download is corrupted. The builder validates source dimensions, GLB header, length and triangle count and embeds binary data in bounded base64 chunks. The application JS and styles are bundled into the one HTML file.

```sh
npx playwright install chromium
node tools/smoke.mjs
```

The browser test blocks network requests and checks real-mesh load, metre-scale radius, camera modes, teleportation, driving input and texture controls. To use an installed Chromium, set `CHROMIUM_PATH`.

## Source credits

* [NASA Scientific Visualization Studio — Asteroid Bennu 3D Models, ID 5069](https://svs.gsfc.nasa.gov/5069) — original OLA v20 and v21 PTM meshes and global OCAMS PAN mosaic. Credit NASA's Scientific Visualization Studio; data provided by NASA / University of Arizona / CSA / York University / MDA.
* [USGS Astropedia — 5 cm PAN mosaic](https://astrogeology.usgs.gov/search/map/bennu_osiris_rex_ocams_global_pan_mosaic_5cm).
* [NASA — candidate sample sites](https://svs.gsfc.nasa.gov/4744/).
* Three.js and three-mesh-bvh are MIT-licensed libraries; bundled copyright notices are retained.

The data products are attributed to their original providers. This independent explorer is not affiliated with or endorsed by NASA.
