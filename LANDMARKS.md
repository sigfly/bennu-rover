# Architecture expedition — model sources and scale

The buildings are intentionally fictional on Bennu. These are the **near-detail original GLB meshes** from [Codriver 3D Assets](https://github.com/codriver-io/codriver-3d-assets/tree/e9619339dd3d74d81cb87302e4692082e0c3dbff), not placeholder boxes, generated guesses, or actual buildings on the asteroid.

The source selection compared the Smithsonian open-access 3D catalogue, Open Heritage/CyArk, Open Landmarks, and Codriver. Codriver was chosen for a consistent reusable format, high-detail geometry, published metre units, full model manifests and explicit CC BY 4.0 licensing. The collection prioritises recognisable silhouettes, detailed architecture, varied styles, and dimensions practical on the ~500 m asteroid; a very tall tower retains its size, rather than being shrunk. Source latitude/longitude is not used in the game. The building order was selected to spread large footprints apart. All 20 binary assets are pinned by commit and SHA-256, and triangle counts are validated at build time. The data add about 6.0 MiB before base64.

## Selected models
Height is the source model's vertical extent in metres (some include architectural platforms/spires). Footprints are estimates from real geometry, not survey-quality; the source manifests note reconstruction limitations. No per-axis scale adjustment is applied.

| Model (original manifest) | Height (m) | Triangles |
|---|---:|---:|
| [Arc de Triomphe](https://github.com/codriver-io/codriver-3d-assets/blob/e9619339dd3d74d81cb87302e4692082e0c3dbff/public/models/buildings/paris-arc-de-triomphe.json) | 50.3 | 28,096 |
| [Tour Eiffel](https://github.com/codriver-io/codriver-3d-assets/blob/e9619339dd3d74d81cb87302e4692082e0c3dbff/public/models/buildings/paris-tour-eiffel.json) | 330.0 | 54,128 |
| [Arctic Cathedral](https://github.com/codriver-io/codriver-3d-assets/blob/e9619339dd3d74d81cb87302e4692082e0c3dbff/public/models/buildings/arctic-cathedral.json) | 35.0 | 12,640 |
| [Gooderham (Flatiron) Building](https://github.com/codriver-io/codriver-3d-assets/blob/e9619339dd3d74d81cb87302e4692082e0c3dbff/public/models/buildings/flatiron-building.json) | 26.0 | 32,865 |
| [Borgund Stave Church](https://github.com/codriver-io/codriver-3d-assets/blob/e9619339dd3d74d81cb87302e4692082e0c3dbff/public/models/buildings/borgund-stave-church.json) | 20.0 | 29,264 |
| [Colosseum](https://github.com/codriver-io/codriver-3d-assets/blob/e9619339dd3d74d81cb87302e4692082e0c3dbff/public/models/buildings/colosseum.json) | 48.5 | 31,560 |
| [Maison Carrée de Nîmes](https://github.com/codriver-io/codriver-3d-assets/blob/e9619339dd3d74d81cb87302e4692082e0c3dbff/public/models/buildings/maison-carree-nimes.json) | 17.0 | 7,864 |
| [Atomium](https://github.com/codriver-io/codriver-3d-assets/blob/e9619339dd3d74d81cb87302e4692082e0c3dbff/public/models/buildings/atomium.json) | 102.0 | 16,464 |
| [Griffith Observatory](https://github.com/codriver-io/codriver-3d-assets/blob/e9619339dd3d74d81cb87302e4692082e0c3dbff/public/models/buildings/griffith-observatory.json) | 23.3 | 28,650 |
| [Brandenburg Gate](https://github.com/codriver-io/codriver-3d-assets/blob/e9619339dd3d74d81cb87302e4692082e0c3dbff/public/models/buildings/brandenburg-gate.json) | 26.0 | 33,936 |
| [Belém Tower](https://github.com/codriver-io/codriver-3d-assets/blob/e9619339dd3d74d81cb87302e4692082e0c3dbff/public/models/buildings/belem-tower.json) | 30.0 | 17,909 |
| [Frauenkirche](https://github.com/codriver-io/codriver-3d-assets/blob/e9619339dd3d74d81cb87302e4692082e0c3dbff/public/models/buildings/frauenkirche-munich.json) | 98.6 | 14,776 |
| [Nidaros Cathedral](https://github.com/codriver-io/codriver-3d-assets/blob/e9619339dd3d74d81cb87302e4692082e0c3dbff/public/models/buildings/nidaros-cathedral.json) | 87.0 | 38,724 |
| [Church of Our Saviour](https://github.com/codriver-io/codriver-3d-assets/blob/e9619339dd3d74d81cb87302e4692082e0c3dbff/public/models/buildings/church-of-our-saviour-copenhagen.json) | 90.0 | 22,033 |
| [Notre-Dame de Paris](https://github.com/codriver-io/codriver-3d-assets/blob/e9619339dd3d74d81cb87302e4692082e0c3dbff/public/models/buildings/paris-notre-dame.json) | 96.0 | 38,243 |
| [Helsinki Cathedral](https://github.com/codriver-io/codriver-3d-assets/blob/e9619339dd3d74d81cb87302e4692082e0c3dbff/public/models/buildings/helsinki-cathedral.json) | 62.2 | 17,748 |
| [Jefferson Memorial](https://github.com/codriver-io/codriver-3d-assets/blob/e9619339dd3d74d81cb87302e4692082e0c3dbff/public/models/buildings/jefferson-memorial.json) | 33.2 | 42,132 |
| [Sacré-Cœur](https://github.com/codriver-io/codriver-3d-assets/blob/e9619339dd3d74d81cb87302e4692082e0c3dbff/public/models/buildings/paris-sacre-coeur.json) | 84.0 | 32,608 |
| [Lincoln Memorial](https://github.com/codriver-io/codriver-3d-assets/blob/e9619339dd3d74d81cb87302e4692082e0c3dbff/public/models/buildings/lincoln-memorial.json) | 30.2 | 36,742 |
| [Capitol Records Building](https://github.com/codriver-io/codriver-3d-assets/blob/e9619339dd3d74d81cb87302e4692082e0c3dbff/public/models/buildings/capitol-records-building.json) | 70.7 | 15,430 |

## Grounding and appearance

The game preserves the models' metre scale and original mesh geometry. It computes each building's lower convex envelope, searches nearby measured terrain using NASA OLA ray intersections, and places a rigid foundation at a grade that clears sampled rock. A sloped perimeter skirt extends below the surrounding measured ground so the lower edge is not floating. Large buildings need substantial artificial foundations on Bennu's curvature; their placement is illustrative, not civil engineering. All architectural materials and vertex colours are converted to grayscale, while preserving tonal differences. The local lights are neutral white in this mode; exposure yellow and discovery green are the only intentional colour accents. The two expeditions retain separate progress.

## Attribution and licensing

All twenty models: © 2026 Codriver / 9570-6198 Québec inc., original commissioned models. [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Geographic placement / source footprints © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). [Upstream licensing](https://github.com/codriver-io/codriver-3d-assets/blob/e9619339dd3d74d81cb87302e4692082e0c3dbff/LICENSES.md). Their derived geographic data are not relicensed; the actual GLBs are modified in the game by grayscale materials, recentering, and fictional terrain placement/foundations. No site-coordinate database is redistributed here. Original credit is retained in the embedded catalog and model detail notes. No endorsement implied.

Additional scale and visual references: [official Eiffel Tower height](https://www.toureiffel.paris/en/the-monument/key-figures), [Atomium in figures](https://atomium.be/the_atomium_in_figures?lang=en), [NPS Lincoln Memorial building statistics](https://home.nps.gov/linc/learn/historyculture/lincoln-memorial-building-statistics.htm), [Smithsonian Open Access](https://www.si.edu/spotlight/openaccesshighlights), [Open Heritage](https://artsandculture.google.com/project/openheritage), [Open Landmarks](https://open-landmarks.benmaps.fr/). Individual modeling notes and sources are preserved in [landmark-manifest.json](landmark-manifest.json).
