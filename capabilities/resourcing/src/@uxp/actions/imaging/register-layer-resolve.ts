import type { ImagingActionContext } from "./context.js";
import {
  buildContentUri,
  buildMaskContentUri,
  parseContentResource,
  parseMaskResource
} from "../../../resource-uris.js";
import { getCurrentLayerIdentify } from "../../../ps-adapter/index";

type LayerResolveType = "content" | "mask";

interface LayerResolveParams {
  uri: string;
  type: LayerResolveType;
}

export function registerLayerResolveAction(context: ImagingActionContext): void {
  const { mcpMesh } = context;

  mcpMesh.implementAction("layer.resolve", async (params: LayerResolveParams) => {
    try {
      if (!params?.uri) {
        throw new Error("uri parameter is required");
      }
      if (!params?.type) {
        throw new Error("type parameter is required");
      }

      if (params.type === "content") {
        const resolved = await resolveContentToLayer(params.uri);
        return { uri: resolved };
      }

      if (params.type === "mask") {
        const resolved = await resolveMaskToLayer(params.uri);
        return { uri: resolved };
      }

      throw new Error(`Unsupported type: ${params.type}`);
    } catch (error: any) {
      return { error: error?.stack || error?.message || String(error) };
    }
  });
}

async function resolveContentToLayer(contentUri: string): Promise<string> {
  const parsed = parseContentResource(contentUri);
  const { docId, content, layerIdentify } = parsed;

  if (content !== "curlayer") {
    return buildContentUri(docId, content, layerIdentify);
  }

  if (layerIdentify && layerIdentify.length > 0) {
    return buildContentUri(docId, content, layerIdentify);
  }

  const { layer_identify } = await getCurrentLayerIdentify();
  if (!layer_identify) {
    throw new Error("No active layer available to resolve content.");
  }

  return buildContentUri(docId, content, layer_identify);
}

async function resolveMaskToLayer(maskUri: string): Promise<string> {
  const parsed = parseMaskResource(maskUri);
  const { docId, content, reverse, layerIdentify } = parsed;

  if (content !== "curlayer") {
    return buildMaskContentUri(docId, content, undefined, reverse);
  }

  const existing = layerIdentify && layerIdentify.length > 0
    ? layerIdentify
    : (await getCurrentLayerIdentify()).layer_identify;

  if (!existing) {
    throw new Error("No active layer available to resolve mask.");
  }

  return buildMaskContentUri(docId, content, existing, reverse);
}
