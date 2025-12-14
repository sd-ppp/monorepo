import { BoundaryRectSchema } from "@sdppp/common/schemas/schemas";
import { z } from "zod";

export type BoundaryRect = z.infer<typeof BoundaryRectSchema>;

/**
 * Helper functions for working with BoundaryRect
 */
export const BoundaryRectUtils = {
    /**
     * Calculate width from a BoundaryRect
     */
    getWidth: (rect: BoundaryRect): number => {
        return rect.width;
    },

    /**
     * Calculate height from a BoundaryRect
     */
    getHeight: (rect: BoundaryRect): number => {
        return rect.height;
    },

    /**
     * Create a BoundaryRect from legacy Rect format (left, top, right, bottom)
     * where right and bottom are absolute coordinates
     */
    fromLegacyRect: (rect: { left: number; top: number; right: number; bottom: number }): BoundaryRect => {
        return {
            leftDistance: rect.left,
            topDistance: rect.top,
            rightDistance: rect.right,
            bottomDistance: rect.bottom,
            width: rect.right - rect.left,
            height: rect.bottom - rect.top
        };
    },

    /**
     * Create a BoundaryRect from position and size
     */
    fromPositionAndSize: (
        x: number,
        y: number,
        width: number,
        height: number,
        docWidth: number,
        docHeight: number
    ): BoundaryRect => {
        return {
            leftDistance: x,
            topDistance: y,
            rightDistance: docWidth - (x + width),
            bottomDistance: docHeight - (y + height),
            width,
            height
        };
    },

    /**
     * Convert BoundaryRect to legacy format for compatibility
     */
    toLegacyRect: (
        rect: BoundaryRect,
        docWidth: number,
        docHeight: number
    ): { left: number; top: number; right: number; bottom: number } => {
        const left = rect.leftDistance;
        const top = rect.topDistance;
        const right = Math.max(left, docWidth - rect.rightDistance);
        const bottom = Math.max(top, docHeight - rect.bottomDistance);
        return { left, top, right, bottom };
    },

    /**
     * Convert BoundaryRect to SDPPPBounds format
     */
    toSDPPPBounds: (
        rect: BoundaryRect,
        docWidth: number,
        docHeight: number
    ): {
        left: number;
        top: number;
        right: number;
        bottom: number;
        width: number;
        height: number;
    } => {
        const left = rect.leftDistance;
        const top = rect.topDistance;
        const right = Math.max(left, docWidth - rect.rightDistance);
        const bottom = Math.max(top, docHeight - rect.bottomDistance);
        return { left, top, right, bottom, width: rect.width, height: rect.height };
    },

    /**
     * Convert BoundaryRect to SDPPPBounds without explicit document dimensions.
     * The document size is inferred from the distances and width/height.
     */
    toSDPPPBoundsAuto: (
        rect: BoundaryRect
    ): {
        left: number;
        top: number;
        right: number;
        bottom: number;
        width: number;
        height: number;
    } => {
        const docWidth = rect.leftDistance + rect.width + rect.rightDistance;
        const docHeight = rect.topDistance + rect.height + rect.bottomDistance;
        return BoundaryRectUtils.toSDPPPBounds(rect, docWidth, docHeight);
    },

    /**
     * Get the inferred document width/height from a BoundaryRect.
     */
    getDocumentSize: (rect: BoundaryRect): { width: number; height: number } => {
        return {
            width: rect.leftDistance + rect.width + rect.rightDistance,
            height: rect.topDistance + rect.height + rect.bottomDistance
        };
    },

    /**
     * Validate that a BoundaryRect has valid dimensions
     */
    isValid: (rect: BoundaryRect): boolean => {
        return (
            rect.width > 0 &&
            rect.height > 0 &&
            rect.leftDistance >= 0 &&
            rect.topDistance >= 0 &&
            rect.rightDistance >= 0 &&
            rect.bottomDistance >= 0
        );
    },

    /**
     * Clamp a BoundaryRect to fit within document bounds
     */
    clampToDocument: (rect: BoundaryRect, docWidth: number, docHeight: number): BoundaryRect => {
        const actualRight = docWidth - rect.rightDistance;
        const actualBottom = docHeight - rect.bottomDistance;

        const clampedLeft = Math.max(0, Math.min(rect.leftDistance, docWidth));
        const clampedTop = Math.max(0, Math.min(rect.topDistance, docHeight));
        const clampedRight = Math.max(clampedLeft, Math.min(actualRight, docWidth));
        const clampedBottom = Math.max(clampedTop, Math.min(actualBottom, docHeight));

        const finalRight = Math.min(clampedRight, docWidth);
        const finalBottom = Math.min(clampedBottom, docHeight);

        const clampedWidth = finalRight - clampedLeft;
        const clampedHeight = finalBottom - clampedTop;

        return {
            leftDistance: clampedLeft,
            topDistance: clampedTop,
            rightDistance: Math.max(0, docWidth - finalRight),
            bottomDistance: Math.max(0, docHeight - finalBottom),
            width: clampedWidth,
            height: clampedHeight
        };
    },

    /**
     * Convert Photoshop Bounds object to BoundaryRect
     * Photoshop Bounds has { left, top, right, bottom } where right/bottom are absolute coordinates
     */
    fromPhotoshopBounds: (
        bounds: { left: number; top: number; right: number; bottom: number },
        docWidth: number,
        docHeight: number
    ): BoundaryRect => {
        return {
            leftDistance: bounds.left,
            topDistance: bounds.top,
            rightDistance: docWidth - bounds.right,
            bottomDistance: docHeight - bounds.bottom,
            width: bounds.right - bounds.left,
            height: bounds.bottom - bounds.top
        };
    },

    /**
     * Convert SDPPP Bounds format to BoundaryRect
     */
    fromSDPPPBounds: (bounds: {
        left: number;
        top: number;
        right: number;
        bottom: number;
        width: number;
        height: number;
    }): BoundaryRect => {
        return {
            leftDistance: bounds.left,
            topDistance: bounds.top,
            rightDistance: bounds.right,
            bottomDistance: bounds.bottom,
            width: bounds.width,
            height: bounds.height
        };
    }
};
