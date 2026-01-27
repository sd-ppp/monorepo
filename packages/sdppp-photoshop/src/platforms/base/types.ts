// Photoshop parameters interfaces
export interface PhotoshopParams {
    content?: 'canvas' | 'curlayer' | 'selection';
    boundary?: 'canvas' | 'curlayer' | 'selection';
    imageSize?: number;
    imageQuality?: number;
    cropBySelection?: 'no' | 'positive' | 'negative';
}

export interface PhotoshopMaskParams {
    content?: 'canvas' | 'curlayer' | 'selection';
    reverse?: boolean;
    imageSize?: number;
}

// Source info interface
export interface SourceInfo {
    type: 'remote' | 'disk' | 'photoshop_image' | 'photoshop_mask' | 'unknown';
    params?: PhotoshopParams;
    maskParams?: PhotoshopMaskParams;
}