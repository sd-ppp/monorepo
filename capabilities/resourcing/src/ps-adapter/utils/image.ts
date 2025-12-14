export function unTrimImageData(
    fromImageDataArray: Uint8Array,
    toImageDataArray: Uint8Array,
    fromImageBounds: {
        left: number;
        top: number;
        right: number;
        bottom: number;
    },
    toImageBounds: {
        left: number;
        top: number;
        right: number;
        bottom: number;
    },
    components: number
): Uint8Array {
    const fromLeft = fromImageBounds.left;
    const fromTop = fromImageBounds.top;
    const fromRight = fromImageBounds.right;
    const fromBottom = fromImageBounds.bottom;
    const fromWidth = fromRight - fromLeft;
    const fromHeight = fromBottom - fromTop;

    const toLeft = toImageBounds.left;
    const toTop = toImageBounds.top;
    const toRight = toImageBounds.right;
    const toBottom = toImageBounds.bottom;
    const toWidth = toRight - toLeft;
    const toHeight = toBottom - toTop;

    const toLength = toWidth * toHeight * components;
    if (toImageDataArray.length !== toLength) {
        throw new Error(`toImageDataArray.length(${toImageDataArray.length}) !== toLength(${toLength})`);
    }
    const fromLength = fromWidth * fromHeight * components;
    if (fromImageDataArray.length !== fromLength) {
        throw new Error(`fromImageDataArray.length(${fromImageDataArray.length}) !== fromLength(${fromLength})`);
    }

    for (let i = 0; i < toLength; i += components) {
        const currentLeft = (i / components) % toWidth + toLeft;
        const currentTop = Math.floor((i / components) / toWidth) + toTop;
        if (
            currentLeft >= fromLeft &&
            currentLeft < fromRight &&
            currentTop >= fromTop &&
            currentTop < fromBottom
        ) {
            const fromIndex = ((currentTop - fromTop) * fromWidth + (currentLeft - fromLeft)) * components;
            for (let j = 0; j < components; j++) {
                toImageDataArray[i + j] = fromImageDataArray[fromIndex + j];
            }
        }
    }
    return toImageDataArray;
}

export function getIntersectBounds(
    fromImageBounds: {
        left: number;
        top: number;
        right: number;
        bottom: number;
    },
    toImageBounds: {
        left: number;
        top: number;
        right: number;
        bottom: number;
    }
): {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
} {
    const intersectLeft = Math.max(fromImageBounds.left, toImageBounds.left);
    const intersectTop = Math.max(fromImageBounds.top, toImageBounds.top);
    const intersectRight = Math.min(fromImageBounds.right, toImageBounds.right);
    const intersectBottom = Math.min(fromImageBounds.bottom, toImageBounds.bottom);
    const intersectWidth = intersectRight - intersectLeft;
    const intersectHeight = intersectBottom - intersectTop;
    return {
        left: intersectLeft,
        top: intersectTop,
        right: intersectRight,
        bottom: intersectBottom,
        width: intersectWidth,
        height: intersectHeight
    };
}

export function getIntersectWidth(
    fromImageBounds: {
        left: number;
        right: number;
    },
    toImageBounds: {
        left: number;
        right: number;
    }
): number {
    const intersectLeft = Math.max(fromImageBounds.left, toImageBounds.left);
    const intersectRight = Math.min(fromImageBounds.right, toImageBounds.right);
    return intersectRight - intersectLeft;
}
