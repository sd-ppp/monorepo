import { JimpMime } from "jimp";

import { createResource } from "../../image-holder.js";
import type { MaterializedCbmPayload } from "./context.js";
import { PNG_MIME, createPerfTracker } from "./cbm-materializer.js";

export async function persistMaterializedPayload(payload: MaterializedCbmPayload) {
  if (!payload?.image) {
    throw new Error("CBM materializer returned empty payload");
  }
  const image = payload.image;
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  const mime = payload.mime ?? PNG_MIME;
  const encodeLog = createPerfTracker("fileResource.cbm.encode");
  encodeLog("start");
  const pngBuffer = await image.getBuffer(JimpMime.png);
  encodeLog("completed", { bytes: pngBuffer.length });

  const createLog = createPerfTracker("fileResource.cbm.createResource");
  createLog("start");
  const resourceId = createResource({
    type: "file",
    data: {
      buffer: new Uint8Array(pngBuffer),
      mime
    },
    originalMeta: {
      width,
      height,
      ...(payload.meta ?? {})
    }
  });
  createLog("completed", { resourceId });
  return {
    resource: resourceId,
    width,
    height,
    mime
  };
}
