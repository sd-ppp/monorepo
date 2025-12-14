export class SpeicialIDManager {
    private static SPECIAL_DOCUMENT_CURRENT: "### Active Document ###" = "### Active Document ###";
    public static is_SPECIAL_DOCUMENT_CURRENT(str: string): boolean { return this.SPECIAL_DOCUMENT_CURRENT === str; }
    public static get_SPECIAL_DOCUMENT_CURRENT(): string { return this.SPECIAL_DOCUMENT_CURRENT; }

    private static SPECIAL_LAYER_KEEP_SIZE: "### Keep Size or Fit Canvas ###" = "### Keep Size or Fit Canvas ###";
    public static is_SPECIAL_LAYER_FIT(str: string): boolean { return this.SPECIAL_LAYER_KEEP_SIZE === str; }
    public static get_SPECIAL_LAYER_FIT(): string { return this.SPECIAL_LAYER_KEEP_SIZE; }

    private static SPECIAL_LAYER_USE_CANVAS: "### The Canvas ###" = "### The Canvas ###";
    public static is_SPECIAL_LAYER_USE_CANVAS(str: string): boolean { return this.SPECIAL_LAYER_USE_CANVAS === str; }
    public static get_SPECIAL_LAYER_USE_CANVAS(): string { return this.SPECIAL_LAYER_USE_CANVAS; }

    private static SPECIAL_LAYER_NEW_LAYER: "### New Layer ###" = "### New Layer ###";
    public static is_SPECIAL_LAYER_NEW_LAYER(str: string): boolean { return this.SPECIAL_LAYER_NEW_LAYER === str; }
    public static get_SPECIAL_LAYER_NEW_LAYER(): string { return this.SPECIAL_LAYER_NEW_LAYER; }

    private static SPECIAL_LAYER_SELECTED_LAYER: "### Selected Layer ###" = "### Selected Layer ###";
    public static is_SPECIAL_LAYER_SELECTED_LAYER(str: string): boolean { return this.SPECIAL_LAYER_SELECTED_LAYER === str; }
    public static get_SPECIAL_LAYER_SELECTED_LAYER(): string { return this.SPECIAL_LAYER_SELECTED_LAYER; }

    private static SPECIAL_LAYER_PREVIEW_DOCUMENT: "_SDPPP_PSD_" = "_SDPPP_PSD_";
    public static is_SPECIAL_LAYER_PREVIEW_DOCUMENT(str: string): boolean { return this.SPECIAL_LAYER_PREVIEW_DOCUMENT === str; }
    public static get_SPECIAL_LAYER_PREVIEW_DOCUMENT(): string { return this.SPECIAL_LAYER_PREVIEW_DOCUMENT; }

    static getSpecialDocumentCurrent(): string {
        return SpeicialIDManager.SPECIAL_DOCUMENT_CURRENT;
    }

    static getSpecialLayerForGet(): string[] {
        return [
            SpeicialIDManager.SPECIAL_LAYER_USE_CANVAS,
            SpeicialIDManager.SPECIAL_LAYER_SELECTED_LAYER
        ];
    }

    static getSpecialLayerForSend(): string[] {
        return [
            SpeicialIDManager.SPECIAL_LAYER_NEW_LAYER,
            SpeicialIDManager.SPECIAL_LAYER_SELECTED_LAYER
        ];
    }

    static getSpecialDocumentForPreview(): string {
        return SpeicialIDManager.SPECIAL_LAYER_PREVIEW_DOCUMENT;
    }

    static fix(str: string): string {
        if (this.is_SPECIAL_DOCUMENT_CURRENT(str)) {
            return this.SPECIAL_DOCUMENT_CURRENT;
        }
        if (this.is_SPECIAL_LAYER_NEW_LAYER(str)) {
            return this.SPECIAL_LAYER_NEW_LAYER;
        }
        if (this.is_SPECIAL_LAYER_PREVIEW_DOCUMENT(str)) {
            return this.SPECIAL_LAYER_PREVIEW_DOCUMENT;
        }
        if (this.is_SPECIAL_LAYER_USE_CANVAS(str)) {
            return this.SPECIAL_LAYER_USE_CANVAS;
        }
        if (this.is_SPECIAL_LAYER_SELECTED_LAYER(str)) {
            return this.SPECIAL_LAYER_SELECTED_LAYER;
        }
        return str;
    }
}
