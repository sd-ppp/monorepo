import type { CreateFromCbmParams, ImagingActionContext } from "./context.js";
export declare function resolveEffectiveBoundaryUri(params: CreateFromCbmParams): Promise<string>;
export declare function loadContentSnapshotJimp(mesh: any, boundaryUri: string, contentUri: string): Promise<{
    jimp: any;
    thumbnail: string;
}>;
export declare function loadMaskSnapshotJimp(mesh: any, boundaryUri: string, maskUri: string): Promise<{
    jimp: any;
    thumbnail: string;
}>;
export declare function registerCreateFromCBMAction(context: ImagingActionContext): void;
//# sourceMappingURL=register-create-from-cbm.d.ts.map