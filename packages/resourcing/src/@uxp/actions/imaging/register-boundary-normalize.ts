import type { ImagingActionContext } from "./context.js";

export function registerBoundaryNormalizeAction(context: ImagingActionContext): void {
  const { mcpMesh } = context;

  mcpMesh.implementAction("boundary.normalize", async (params: { boundary: string }) => {
    try {
      const resolver = context.resolvers?.boundaryToRect;
      if (!resolver) {
        return { error: "resolvers.boundaryToRect is not provided" };
      }
      if (!params?.boundary) {
        throw new Error("boundary parameter is required");
      }
      const rectUri = await resolver(params.boundary);
      return { boundary: rectUri };
    } catch (error: any) {
      return { error: error?.stack || error?.message || String(error) };
    }
  });
}
