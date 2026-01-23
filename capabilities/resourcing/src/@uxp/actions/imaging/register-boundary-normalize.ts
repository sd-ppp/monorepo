import { app } from "photoshop";

import type { ImagingActionContext } from "./context.js";
import { buildBoundaryUri, parseBoundaryResource } from "../../../resource-uris.js";
import { BoundaryRectUtils, getBoundaryImpl } from "../../../ps-adapter/index";

export function registerBoundaryNormalizeAction(context: ImagingActionContext): void {
  const { mcpMesh } = context;

  mcpMesh.implementAction("boundary.normalize", async (params: { boundary: string }) => {
    try {
      if (!params?.boundary) {
        throw new Error("boundary parameter is required");
      }
      const rectUri = await resolveBoundaryToRect(params.boundary);
      return { boundary: rectUri };
    } catch (error: any) {
      return { error: error?.stack || error?.message || String(error) };
    }
  });
}

async function resolveBoundaryToRect(boundaryUri: string): Promise<string> {
  const parsed = parseBoundaryResource(boundaryUri);
  const { docId, boundary, imageSize, imageQuality } = parsed;

  if (typeof boundary === "object") {
    return buildBoundaryUri(docId, boundary, { imageSize, imageQuality });
  }

  if (!app.activeDocument) {
    throw new Error("No active document to resolve boundary.");
  }

  let resolved: Parameters<typeof buildBoundaryUri>[1] = boundary;
  switch (boundary) {
    case "canvas": {
      const doc = app.activeDocument;
      const width = Number(doc.width);
      const height = Number(doc.height);
      resolved = BoundaryRectUtils.fromPositionAndSize(0, 0, width, height, width, height);
      break;
    }
    case "curlayer": {
      const { boundary: computed } = await getBoundaryImpl({ type: "curlayer" });
      resolved = computed;
      break;
    }
    case "selection": {
      const { boundary: computed } = await getBoundaryImpl({ type: "selection" });
      resolved = computed;
      break;
    }
    default: {
      throw new Error(`Unsupported boundary type "${boundary}"`);
    }
  }

  return buildBoundaryUri(docId, resolved, { imageSize, imageQuality });
}
