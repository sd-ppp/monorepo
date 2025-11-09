import type { ImagingActionContext } from "./context.js";

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
        const resolver = context.resolvers?.contentToLayer;
        if (!resolver) {
          return { error: "resolvers.contentToLayer is not provided" };
        }
        const resolved = await resolver(params.uri);
        return { uri: resolved };
      }

      if (params.type === "mask") {
        const resolver = context.resolvers?.maskToLayer;
        if (!resolver) {
          return { error: "resolvers.maskToLayer is not provided" };
        }
        const resolved = await resolver(params.uri);
        return { uri: resolved };
      }

      throw new Error(`Unsupported type: ${params.type}`);
    } catch (error: any) {
      return { error: error?.stack || error?.message || String(error) };
    }
  });
}
