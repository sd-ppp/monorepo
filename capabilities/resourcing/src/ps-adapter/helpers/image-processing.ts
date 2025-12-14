import { unTrimImageData } from "../utils/image";
import type { BoundaryRect } from "../types/boundary-rect-utils";

export interface PixelsAndSize<T> {
    dataFromAPI: T;
    width: number;
    height: number;
}

export interface ImageBounds {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
}

export interface SDPPPBounds {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
}

export function applyLayerDataWithTransparent(pixelData: Uint8Array, maskData: Uint8Array | null): Uint8Array {
    for (let i = 0, length = pixelData.length / 4; i < length; i++) {
        const maskPixel = maskData ? maskData[i] / 255 : 1;
        pixelData[4 * i + 3] = maskPixel * pixelData[4 * i + 3];

        if (!pixelData[4 * i + 3]) {
            pixelData[4 * i] = pixelData[4 * i + 1] = pixelData[4 * i + 2] = 0;
        }
    }
    return pixelData;
}

export function fixAlphaChannel(pixelDataWithSize: PixelsAndSize<Uint8Array>): PixelsAndSize<Uint8Array> {
    if (pixelDataWithSize.dataFromAPI.length !== pixelDataWithSize.width * pixelDataWithSize.height * 3) {
        throw new Error(
            `unsupported channel counts: ${pixelDataWithSize.dataFromAPI.length / (pixelDataWithSize.width * pixelDataWithSize.height)}`
        );
    }
    const uint8Data = new Uint8Array(pixelDataWithSize.width * pixelDataWithSize.height * 4);

    for (let i = 0; i < pixelDataWithSize.width * pixelDataWithSize.height; i++) {
        uint8Data[i * 4] = pixelDataWithSize.dataFromAPI[i * 3];
        uint8Data[i * 4 + 1] = pixelDataWithSize.dataFromAPI[i * 3 + 1];
        uint8Data[i * 4 + 2] = pixelDataWithSize.dataFromAPI[i * 3 + 2];
        uint8Data[i * 4 + 3] = 255;
    }

    return {
        dataFromAPI: uint8Data,
        width: pixelDataWithSize.width,
        height: pixelDataWithSize.height
    };
}

export function alignPixelBit(pixelAndSize: PixelsAndSize<Uint8Array | Uint16Array | Float32Array>): PixelsAndSize<Uint8Array> {
    if (pixelAndSize.dataFromAPI instanceof Uint8Array) {
        return pixelAndSize as PixelsAndSize<Uint8Array>;
    }
    const { dataFromAPI, width, height } = pixelAndSize;
    const uint8Data = new Uint8Array(dataFromAPI.length);
    for (let i = 0; i < dataFromAPI.length; i++) {
        if (dataFromAPI instanceof Uint16Array) {
            if (dataFromAPI[i] === 32768) {
                uint8Data[i] = 255;
            } else {
                uint8Data[i] = Math.floor(dataFromAPI[i] / 128);
            }
        } else {
            throw new Error("32-bit color not supported");
        }
    }
    return {
        dataFromAPI: uint8Data,
        width,
        height
    };
}

export function padAndTrimToDesireBounds(
    pixelDataAndSize: PixelsAndSize<Uint8Array>,
    fromBounds: ImageBounds,
    toBounds: ImageBounds,
    components = 4
): Uint8Array {
    if (
        pixelDataAndSize.width === toBounds.width &&
        pixelDataAndSize.height === toBounds.height &&
        pixelDataAndSize.dataFromAPI.length === toBounds.width * toBounds.height * components
    ) {
        return pixelDataAndSize.dataFromAPI;
    }
    const resPixelData = new Uint8Array(toBounds.width * toBounds.height * components);
    resPixelData.fill(0);
    unTrimImageData(pixelDataAndSize.dataFromAPI, resPixelData, fromBounds, toBounds, components);
    return resPixelData;
}

export function scaleBounds(bounds: ImageBounds, scaleRatio: number): ImageBounds {
    const newLeft = Math.floor(bounds.left * scaleRatio);
    const newTop = Math.floor(bounds.top * scaleRatio);
    const newWidth = Math.ceil((bounds.width || bounds.right - bounds.left) * scaleRatio);
    const newHeight = Math.ceil((bounds.height || bounds.bottom - bounds.top) * scaleRatio);
    return {
        left: newLeft,
        top: newTop,
        right: newLeft + newWidth,
        bottom: newTop + newHeight,
        width: newWidth,
        height: newHeight
    };
}

export function getScaleRatio(bounds: ImageBounds, maxWidthHeight?: number): number {
    const boundWidth = bounds.width || bounds.right - bounds.left;
    const boundHeight = bounds.height || bounds.bottom - bounds.top;
    if (maxWidthHeight && (boundWidth > maxWidthHeight || boundHeight > maxWidthHeight)) {
        return maxWidthHeight / Math.max(boundWidth, boundHeight);
    }
    return 1;
}

export function getDesireBounds(
    docWidth: number,
    docHeight: number,
    boundary?: BoundaryRect | null
): ImageBounds | null {
    if (!boundary) {
        return {
            left: 0,
            top: 0,
            right: docWidth,
            bottom: docHeight,
            width: docWidth,
            height: docHeight
        };
    }

    const width = boundary.width ?? docWidth - boundary.leftDistance - boundary.rightDistance;
    const height = boundary.height ?? docHeight - boundary.topDistance - boundary.bottomDistance;

    return {
        left: boundary.leftDistance,
        top: boundary.topDistance,
        right: docWidth - boundary.rightDistance,
        bottom: docHeight - boundary.bottomDistance,
        width,
        height
    };
}

export function convertSDPPPBoundsToBoundaryRect(
    bounds: SDPPPBounds,
    docWidth: number,
    docHeight: number
): BoundaryRect {
    return {
        leftDistance: bounds.left,
        topDistance: bounds.top,
        rightDistance: docWidth - bounds.right,
        bottomDistance: docHeight - bounds.bottom,
        width: bounds.width,
        height: bounds.height
    };
}
