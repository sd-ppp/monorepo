import { WidgetRegistry, WidgetRenderer } from '@sdppp/widgetable-ui';
import { imageMaskWidgetRouter } from '../widgetable-photoshop';

// Deprecated widgets for PS_DOCUMENT and PS_LAYER
export const renderDeprecatedWidget: WidgetRenderer = () => {
    return <span>SDPPP 2.0不需要这个节点了</span>;
};

// Create base widget registry for SDPPP-specific widgets
export const createImageMaskWidgetRegistry = (): WidgetRegistry => {
    return {
        'images': imageMaskWidgetRouter,
        'masks': imageMaskWidgetRouter,
        'PS_DOCUMENT': renderDeprecatedWidget,
        'PS_LAYER': renderDeprecatedWidget,
    };
};

export { imageMaskWidgetRouter };
