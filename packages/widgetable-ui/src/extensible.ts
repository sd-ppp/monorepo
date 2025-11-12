// Main extensibility exports for the widgetable system

// Core types and interfaces
export type { 
    WidgetRenderer, 
    WidgetRegistry, 
    WidgetRegistryContextType, 
    WidgetRendererProps,
    WidgetRenderMeta,
} from './widget-registry';

// Core registry functions
export { createDefaultWidgetRegistry } from './widget-registry';

// Context and provider
export { WidgetableProvider, useWidgetable } from './context';
export { useWidgetRenderMeta } from './render-tracker/context';

// Note: images and masks widget renderers are now in providers/base
// Individual widget renderers are no longer exported from core widgetable

// Default widget renderers (for fallback/reference)
export {
    renderToggleWidget,
    renderNumberWidget,
    renderComboWidget,
    renderSegmentWidget,
    renderStringWidget,
    renderErrorWidget
} from './widgetable-web/default-widgets';

// Note: renderMaskWidget, renderImageWidget, renderDeprecatedWidget are now in providers/base

// Example custom widgets
export {
    CustomImagesWidget,
    CustomMasksWidget,
    createCustomWidgetRegistry,
    CustomWidgetableProvider,
    useCustomWidgetRegistration
} from './examples/custom-widgets';

// Example usage components
export {
    Example1_ProviderBasedCustomization,
    Example2_RuntimeRegistration,
    Example3_SelectiveOverriding,
    Example4_RegistryInspection,
    Example5_CustomProviderWrapper,
    WidgetableExtensibilityExamples
} from './examples/usage-examples';
