import {
  applyMaskToSnapshot,
  createSnapshot,
  ensurePositiveRect,
  type MaskSnapshot
} from "@sdppp/cbm-calculator";
import { sdpppX } from "@sdppp/ps-uxp/src/entry/sdpppX";
import { buildGetImageParamsFromResources } from "../../../ps-adapter/index";
import type { BoundaryRect } from "../../../resource-uris.js";
import { parseBoundaryResource, parseMaskResource } from "../../../resource-uris.js";
import {
  PNG_MIME,
  actionErrorResult,
  createPerfTracker,
  loadContentSnapshotJimp,
  loadMaskSnapshotForMaterializer,
  normalizeCombineParams,
  normalizeUri,
  projectBoundaryRectFromResource,
  resolveEffectiveBoundaryUri
} from "./cbm-materializer.js";
import { persistMaterializedPayload } from "./cbm-persist.js";
import type { CombineByCbmParams, ImagingActionContext, MaterializedCbmPayload } from "./context.js";
import { storeJimpForResource } from "./jimp-holder.js";

export function registerCombineByCbmAction(context: ImagingActionContext): void {
  const { mcpMesh } = context;
  const mesh = mcpMesh as any;
  const materialize =
    context.materializers?.combineCBM ??
    (async (params: CombineByCbmParams) => materializeCombineByCbm(mesh, params));

  mcpMesh.implementAction("fileResource.combineByCBM", async (rawParams?: CombineByCbmParams) => {
    console.info("[fileResource.combineByCBM] invoked", rawParams);
    const actionLog = createPerfTracker("fileResource.combineByCBM.action");
    try {
      actionLog("start");
      const params = normalizeCombineParams(rawParams);
      const payload = await materialize(params);
      const response = await persistMaterializedPayload(payload);
      if (response.resource && payload.image) {
        storeJimpForResource(response.resource, payload.image, { mime: payload.mime });
      }
      actionLog("completed", {
        boundaryUri: params.boundaryUri ?? null,
        contentUri: params.contentUri ?? null,
        maskUri: params.maskUri ?? null,
        resource: response.resource ?? null
      });
      return response;
    } catch (error) {
      actionLog("failed", { message: (error as any)?.message });
      return actionErrorResult(error);
    }
  });
}

async function materializeCombineByCbm(
  mesh: any,
  params: CombineByCbmParams
): Promise<MaterializedCbmPayload> {
  const perfLog = createPerfTracker("fileResource.combineByCBM.action");
  perfLog("materialize.start", {
    boundaryUri: params.boundaryUri ?? null,
    contentUri: params.contentUri ?? null,
    maskUri: params.maskUri ?? null
  });
  console.log("[combineByCBM][调试] 接收到参数", {
    boundaryUri: params.boundaryUri ?? null,
    contentUri: params.contentUri ?? null,
    maskUri: params.maskUri ?? null,
    thumbnail: params.thumbnail ?? false
  });
  const contentUri = normalizeUri(params.contentUri);
  const maskUri = normalizeUri(params.maskUri);
  const parsedMask = maskUri && maskUri.startsWith("uxp://mask/") ? parseMaskResource(maskUri) : null;

  if (params.maskUri && !maskUri) {
    console.warn("[combineByCBM] mask skipped: invalid maskUri after normalization", {
      boundaryUri: params.boundaryUri ?? null,
      rawMaskUri: params.maskUri
    });
  }

  if (!contentUri) {
    throw new Error("contentUri is required");
  }

  const boundaryUri = await resolveEffectiveBoundaryUri(params);
  const boundarySampling = createBoundarySamplingMetadata(boundaryUri);
  const boundaryDetails = boundarySampling.parsed;
  const maskIsEmpty = parsedMask?.maskType === "empty";
  const maskIsFileResource = Boolean(maskUri && maskUri.startsWith("uxp://file/"));
  const contentIsFileResource = Boolean(contentUri && contentUri.startsWith("uxp://file/"));
  const contentParams = contentIsFileResource
    ? {
        boundary: boundaryDetails.boundary,
        content: "canvas" as const,
        imageSize: boundaryDetails.imageSize ?? 0,
        imageQuality: boundaryDetails.imageQuality ?? 1,
        layer_identify: null
      }
    : buildGetImageParamsFromResources(boundaryUri, contentUri);
  perfLog("materialize.content.load.start", { contentIsFileResource });
  const contentSnapshot = await loadContentSnapshotJimp(mesh, boundaryUri, contentUri, {
    prebuiltParams: contentParams
  });
  console.info("[fileResource.combineByCBM] contentSnapshot", {
    contentUri,
    boundaryUri,
    fromFileResource: contentIsFileResource,
    width: contentSnapshot.jimp.bitmap.width,
    height: contentSnapshot.jimp.bitmap.height
  });
  perfLog("materialize.content.load.completed", {
    width: contentSnapshot.jimp.bitmap.width,
    height: contentSnapshot.jimp.bitmap.height
  });

  let contentImage = contentSnapshot.jimp;
  if (contentIsFileResource) {
    perfLog("materialize.content.sample.start");
    contentImage = sampleFilehostImageForBoundary(contentImage, boundaryUri, boundarySampling, contentUri);
    perfLog("materialize.content.sample.completed", {
      width: contentImage.bitmap.width,
      height: contentImage.bitmap.height
    });
  }

  let snapshot = createSnapshot(contentImage);
  const meta: Record<string, unknown> = {
    boundaryUri,
    contentUri
  };
  console.log("[combineByCBM][调试] 内容图像已就绪", {
    width: contentImage.bitmap.width,
    height: contentImage.bitmap.height,
    contentIsFileResource
  });

  if (maskUri && !maskIsEmpty) {
    perfLog("materialize.mask.load.start", { maskIsFileResource });
    const maskSnapshot = await loadMaskSnapshotForMaterializer(mesh, boundaryUri, maskUri);
    if (!maskSnapshot) {
      throw new Error("Unable to resolve mask snapshot");
    }
    perfLog("materialize.mask.load.completed", {
      width: maskSnapshot.jimp.bitmap.width,
      height: maskSnapshot.jimp.bitmap.height
    });
    console.info("[fileResource.combineByCBM] maskSnapshot", {
      maskUri,
      boundaryUri,
      fromFileResource: maskIsFileResource,
      width: maskSnapshot.jimp.bitmap.width,
      height: maskSnapshot.jimp.bitmap.height
    });

    let maskImage = maskSnapshot.jimp;
    if (maskIsFileResource) {
      perfLog("materialize.mask.sample.start");
      maskImage = sampleFilehostImageForBoundary(maskImage, boundaryUri, boundarySampling, maskUri);
      perfLog("materialize.mask.sample.completed", {
        width: maskImage.bitmap.width,
        height: maskImage.bitmap.height
      });
    }
    console.log("[combineByCBM][调试] 遮罩图像已就绪", {
      width: maskImage.bitmap.width,
      height: maskImage.bitmap.height,
      maskIsFileResource,
      reverse: maskSnapshot.reverse ?? null
    });

    const normalizedMaskSnapshot: MaskSnapshot = {
      ...createSnapshot(maskImage),
      maskRegion: null
    };
    const invertSettingEnabled = Number(sdpppX["settings.imaging.applyMaskInvert"]) === 1;
    const reverseFlag = maskSnapshot.reverse === true;
    const invertMask = Boolean(invertSettingEnabled) !== reverseFlag;
    const applicationResult = await applyMaskToSnapshot(snapshot, {
      maskSnapshot: normalizedMaskSnapshot,
      invertMask
    });
    snapshot = applicationResult.snapshot;
    const maskStats = applicationResult.stats ?? null;
    console.log("[combineByCBM][调试] 遮罩已应用", {
      invertMask,
      maskedPixels: maskStats?.maskedPixels ?? null,
      totalPixels: maskStats?.totalPixels ?? null,
      coverage: maskStats
        ? Number(((maskStats.maskedPixels / Math.max(1, maskStats.totalPixels)) * 100).toFixed(2))
        : null,
      maskAlphaZeroPixels: maskStats?.maskAlphaZeroPixels ?? null,
      maskAlphaNonZeroPixels: maskStats?.maskAlphaNonZeroPixels ?? null,
      invertMaskApplied: maskStats?.invertMaskApplied ?? null,
      alphaRemovalAverage: maskStats?.alphaRemovalAverage ?? null,
      alphaRemovalAverageNormalized: maskStats?.alphaRemovalAverageNormalized ?? null,
      alphaRemovalMax: maskStats?.alphaRemovalMax ?? null,
      stronglyMaskedPixels: maskStats?.stronglyMaskedPixels ?? null
    });
    meta.maskApplied = maskUri;
    meta.maskStats = applicationResult.stats;
    perfLog("materialize.mask.apply.completed", {
      maskedPixels: applicationResult.stats?.maskedPixels ?? null
    });
    if (maskSnapshot.reverse !== undefined) {
      meta.maskReverse = maskSnapshot.reverse;
    }
  } else if (maskIsEmpty) {
    perfLog("materialize.mask.skip.empty");
  }

  perfLog("materialize.completed", {
    outputWidth: snapshot.image.bitmap.width,
    outputHeight: snapshot.image.bitmap.height
  });
  console.log("[combineByCBM][调试] 合成完成", {
    outputWidth: snapshot.image.bitmap.width,
    outputHeight: snapshot.image.bitmap.height,
    hasMaskApplied: Boolean(meta.maskApplied)
  });
  return {
    type: "image",
    image: snapshot.image,
    mime: PNG_MIME,
    meta
  };
}

type BoundarySamplingMetadata = {
  parsed: ReturnType<typeof parseBoundaryResource>;
  rectSpec?: BoundaryRectSampleSpec;
};

type BoundaryRectSampleSpec = {
  sourceRect: BoundaryRect;
  docWidth: number;
  docHeight: number;
  targetDocWidth: number;
  targetDocHeight: number;
  targetCropRect: { x: number; y: number; width: number; height: number };
};

const FILEHOST_BOUNDARY_CACHE_TTL_MS = 5_000;
const filehostBoundarySampleCache = new Map<string, { expiresAt: number; image: Jimp }>();

function createBoundarySamplingMetadata(boundaryUri: string): BoundarySamplingMetadata {
  const parsed = parseBoundaryResource(boundaryUri);
  if (typeof parsed.boundary !== "string" && parsed.boundary) {
    const normalizedRect = normalizeBoundaryRect(parsed.boundary);
    const docWidth = Math.max(
      1,
      Math.round(normalizedRect.leftDistance + normalizedRect.width + normalizedRect.rightDistance)
    );
    const docHeight = Math.max(
      1,
      Math.round(normalizedRect.topDistance + normalizedRect.height + normalizedRect.bottomDistance)
    );
    const projected =
      projectBoundaryRectFromResource(boundaryUri) ?? {
        docWidth,
        docHeight,
        cropRect: ensurePositiveRect({
          x: Math.round(normalizedRect.leftDistance),
          y: Math.round(normalizedRect.topDistance),
          width: Math.max(1, Math.round(normalizedRect.width)),
          height: Math.max(1, Math.round(normalizedRect.height))
        })
      };
    return {
      parsed,
      rectSpec: {
        sourceRect: normalizedRect,
        docWidth,
        docHeight,
        targetDocWidth: projected.docWidth,
        targetDocHeight: projected.docHeight,
        targetCropRect: projected.cropRect
      }
    };
  }
  return { parsed };
}

function normalizeBoundaryRect(rect: BoundaryRect): BoundaryRect {
  return {
    leftDistance: Math.max(0, Math.round(rect.leftDistance)),
    topDistance: Math.max(0, Math.round(rect.topDistance)),
    rightDistance: Math.max(0, Math.round(rect.rightDistance)),
    bottomDistance: Math.max(0, Math.round(rect.bottomDistance)),
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height))
  };
}

function sampleFilehostImageForBoundary(
  image: Jimp,
  boundaryUri: string,
  sampling: BoundarySamplingMetadata,
  resourceUri: string
): Jimp {
  const perfLog = createPerfTracker("fileResource.combineByCBM.action");
  perfLog("sample.start", {
    boundaryUri,
    resourceUri,
    hasRectSpec: Boolean(sampling.rectSpec)
  });
  pruneExpiredBoundarySamples();
  const cacheKey = createFilehostBoundaryCacheKey(resourceUri, boundaryUri, image);
  if (cacheKey) {
    const cached = takeCachedBoundarySample(cacheKey);
    if (cached) {
      perfLog("sample.cacheHit", { width: cached.bitmap.width, height: cached.bitmap.height });
      return cached;
    }
  }

  let result: Jimp;
  if (sampling.rectSpec) {
    perfLog("sample.rect.start");
    const { sourceRect, targetCropRect, docWidth, docHeight } = sampling.rectSpec;
    if (image.bitmap.width !== docWidth || image.bitmap.height !== docHeight) {
      console.warn("[combineByCBM] filehost dimensions differ from boundary projection", {
        boundaryUri,
        resourceUri,
        expectedWidth: docWidth,
        expectedHeight: docHeight,
        actualWidth: image.bitmap.width,
        actualHeight: image.bitmap.height
      });
    }
    result = image.clone();
    const cropX = Math.max(0, Math.round(sourceRect.leftDistance));
    const cropY = Math.max(0, Math.round(sourceRect.topDistance));
    const cropWidth = Math.max(1, Math.round(sourceRect.width));
    const cropHeight = Math.max(1, Math.round(sourceRect.height));
    result.crop({
      x: cropX,
      y: cropY,
      w: cropWidth,
      h: cropHeight
    });
    const targetWidth = Math.max(1, Math.round(targetCropRect.width));
    const targetHeight = Math.max(1, Math.round(targetCropRect.height));
    if (result.bitmap.width !== targetWidth || result.bitmap.height !== targetHeight) {
      result.resize({ w: targetWidth, h: targetHeight });
    }
    perfLog("sample.rect.completed", {
      width: result.bitmap.width,
      height: result.bitmap.height
    });
  } else {
    perfLog("sample.scale.start");
    result = rescaleImageToBoundaryMaxSize(image, sampling.parsed.imageSize);
    perfLog("sample.scale.completed", {
      width: result.bitmap.width,
      height: result.bitmap.height
    });
  }

  if (cacheKey) {
    cacheBoundarySample(cacheKey, result);
  }
  perfLog("sample.completed", {
    width: result.bitmap.width,
    height: result.bitmap.height
  });
  return result;
}

function rescaleImageToBoundaryMaxSize(image: Jimp, imageSize?: number): Jimp {
  if (!(imageSize && imageSize > 0)) {
    return image.clone();
  }
  const maxSide = Math.max(image.bitmap.width, image.bitmap.height);
  if (maxSide <= imageSize) {
    return image.clone();
  }
  const scale = imageSize / maxSide;
  const targetWidth = Math.max(1, Math.round(image.bitmap.width * scale));
  const targetHeight = Math.max(1, Math.round(image.bitmap.height * scale));
  const resized = image.clone();
  resized.resize({ w: targetWidth, h: targetHeight });
  return resized;
}

function createFilehostBoundaryCacheKey(resourceUri: string, boundaryUri: string, image: Jimp): string | null {
  try {
    const parsed = new URL(resourceUri);
    parsed.search = "";
    parsed.hash = "";
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}::${boundaryUri}::${image.bitmap.width}x${image.bitmap.height}`;
  } catch {
    return null;
  }
}

function takeCachedBoundarySample(key: string): Jimp | null {
  const entry = filehostBoundarySampleCache.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    filehostBoundarySampleCache.delete(key);
    return null;
  }
  return entry.image.clone();
}

function cacheBoundarySample(key: string, image: Jimp): void {
  filehostBoundarySampleCache.set(key, {
    expiresAt: Date.now() + FILEHOST_BOUNDARY_CACHE_TTL_MS,
    image: image.clone()
  });
}

function pruneExpiredBoundarySamples(): void {
  const now = Date.now();
  for (const [key, entry] of filehostBoundarySampleCache.entries()) {
    if (entry.expiresAt <= now) {
      filehostBoundarySampleCache.delete(key);
    }
  }
}
