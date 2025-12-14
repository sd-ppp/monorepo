import { Buffer } from "buffer";
import { app } from "photoshop";

import { sdpppX } from "@sdppp/ps-uxp/src/entry/sdpppX";
import { BoundaryRectUtils, getDocumentInfo, getLayerInfo, SpeicialIDManager, type BoundaryRect } from "../../../ps-adapter/index";

type BoundarySpec = string | BoundaryRect;
type ContentSource = "canvas" | "curlayer" | "selection" | string;

export type SdpppBoundary = ReturnType<typeof BoundaryRectUtils.toSDPPPBoundsAuto>;

export const boundaryRectToSDPPP = (rect: BoundaryRect): SdpppBoundary =>
  BoundaryRectUtils.toSDPPPBoundsAuto(rect);

export function normalizeUri(value?: string | null): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function decodeDataUrl(dataUrl: string): { buffer: Buffer; mime?: string } {
  const DATA_URL_REGEX = /^data:([^;,]+)?(;base64)?,(.*)$/i;
  const match = DATA_URL_REGEX.exec(dataUrl);
  if (!match) {
    throw new Error("Invalid data URL");
  }
  const mime = match[1] ?? undefined;
  const isBase64 = !!match[2];
  const payload = match[3] ?? "";
  if (isBase64) {
    return { buffer: Buffer.from(payload, "base64"), mime };
  }
  return { buffer: Buffer.from(decodeURIComponent(payload), "utf8"), mime };
}

export async function resolveBoundaryParam(
  boundary: BoundarySpec,
  layerIdentify?: string | null
): Promise<SdpppBoundary> {
  const documentIdentify = SpeicialIDManager.get_SPECIAL_DOCUMENT_CURRENT();

  if (typeof boundary === "string") {
    switch (boundary) {
      case "canvas": {
        const docInfo = await getDocumentInfo({ document_identify: documentIdentify });
        return boundaryRectToSDPPP(docInfo.document_boundary);
      }
      case "curlayer": {
        const layerInfo = await getLayerInfo({
          document_identify: documentIdentify,
          layer_identify: layerIdentify ?? SpeicialIDManager.get_SPECIAL_LAYER_SELECTED_LAYER()
        });
        return boundaryRectToSDPPP(layerInfo.boundary);
      }
      case "selection": {
        const docInfo = await getDocumentInfo({ document_identify: documentIdentify });
        const selectionRect = docInfo.selection_boundary ?? docInfo.document_boundary;
        return boundaryRectToSDPPP(selectionRect);
      }
      default:
        throw new Error(`Unsupported boundary specification: ${boundary}`);
    }
  }

  const doc = app.activeDocument;
  if (!doc) {
    throw new Error("No active document to compute boundary rect.");
  }
  const docWidth = Number(doc.width);
  const docHeight = Number(doc.height);
  return BoundaryRectUtils.toSDPPPBounds(boundary, docWidth, docHeight);
}

export function resolveLayerIdentifyForContent(content: ContentSource, layerIdentify?: string | null): string {
  if (layerIdentify && layerIdentify.length > 0) {
    return layerIdentify;
  }

  switch (content) {
    case "canvas":
      return SpeicialIDManager.get_SPECIAL_LAYER_USE_CANVAS();
    case "curlayer":
      return SpeicialIDManager.get_SPECIAL_LAYER_SELECTED_LAYER();
    case "selection":
    default:
      return SpeicialIDManager.get_SPECIAL_LAYER_USE_CANVAS();
  }
}

export function resolveLayerIdentifyForMask(content: ContentSource, layerIdentify?: string | null): string {
  if (layerIdentify && layerIdentify.length > 0) {
    return layerIdentify;
  }

  switch (content) {
    case "canvas":
      return SpeicialIDManager.get_SPECIAL_LAYER_USE_CANVAS();
    case "curlayer":
      return SpeicialIDManager.get_SPECIAL_LAYER_SELECTED_LAYER();
    case "selection":
    default:
      return SpeicialIDManager.get_SPECIAL_LAYER_USE_CANVAS();
  }
}

export function getEffectiveImageSize(mesh: any, requested?: number): number {
  const activeNodeState = mesh?.getNode?.("uxp")?.store?.getState?.();
  const activeDocumentID = activeNodeState?.activeDocumentID;
  const meshState: any = mesh?.store?.getState?.() ?? {};
  const workBoundaryMaxSizes = (meshState as any)?.workBoundaryMaxSizes ?? {};
  const defaultSize = sdpppX["settings.imaging.defaultImagesSizeLimit"];

  if (requested && requested > 0) {
    return requested;
  }
  if (activeDocumentID != null && workBoundaryMaxSizes[activeDocumentID]) {
    return workBoundaryMaxSizes[activeDocumentID];
  }
  return defaultSize;
}
