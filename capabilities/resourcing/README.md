# @sdppp/resourcing


## URI Schemes

- `uxp://file/<uuid>` – materialized resource handle (used for image/mask/generic files).
- `uxp://boundary/<docId>/<canvas|curlayer|selection>` – document boundary reference.
- `uxp://boundary/<docId>/layer?layerid=<id>&layername=<name>` – layer boundary snapshot.
- `uxp://boundary/<docId>/rect?leftDistance=...` – boundary rectangle snapshot.
- `uxp://content/<docId>/<canvas|curlayer>` – content source specifier.
- `uxp://content/<docId>/layer?layerid=<id>&layername=<name>` – specific layer content.
- `uxp://mask/<docId>/<canvas|curlayer|selection>?reverse=0|1` – mask content reference.
- `uxp://mask/<docId>/layer?layerid=<id>&layername=<name>&reverse=0|1` – layer-based mask content.

## Mesh Actions (UXP)

The UXP side exports helper functions to register the following actions against your `mcpMesh` implementation:

| Action name                      | Purpose                                                                    |
|----------------------------------|----------------------------------------------------------------------------|
| `resource.file.createFromExternal`| Download external/base64 data, materialize a `uxp://file/<uuid>` resource  |
| `resource.file.createFromLocal`   | Materialize a resource from a locally selected file                        |
| `resource.file.createByContent`   | Capture document content via boundary handles and turn it into a file resource |
| `resource.file.createByMask`      | Materialize a mask resource from selection/layer handles or stored mask    |
| `resource.file.combineByCBM`      | Combine Content/Boundary/Mask handles to produce a masked + cropped resource |
| `resource.thumbnail`         | Generate/cached PNG thumbnail for a file resource                          |
| `resource.file.saveAs`            | Prompt user to choose a folder and save file resources to disk             |
| `resource.file.delete`            | Remove materialized resources (and temp files if applicable)               |
| `resource.boundary.normalize`             | Resolve boundary handle (canvas/curlayer/selection) to canonical rect URI  |
| `resource.layer.resolve`                  | Convert content/mask curlayer handles to explicit layer-id handles         |
