import type { WidgetableImagesWidget, WidgetableWidget } from '@sdppp/common/schemas/schemas';
import type { WidgetRenderer } from '@sdppp/widgetable-ui';
import { ImageSelector } from '../components/ImageSelector';
import { LocalImagePackSelector } from '../components/LocalImagePackSelector';
import { MaskSelector } from '../components/MaskSelector';
import { MultiImageSelector } from '../components/MultiImageSelector';
import { SingleVideoSelector } from '../components/SingleVideoSelector';
import { useWorkBoundaryResolver } from '../context/WidgetImageMaskContext';

type SelectorKind =
  | 'single-image'
  | 'multi-image'
  | 'masks'
  | 'local-image-pack'
  | 'single-video';

type AnyWidget = WidgetableWidget & { options?: Record<string, any> };

const resolveSelectorKind = (
  widget: AnyWidget,
  extraOptions: any,
): SelectorKind => {
  const override = extraOptions?.selectorKind as SelectorKind | undefined;
  if (override) return override;
  if (widget.outputType === 'masks') return 'masks';
  if (widget.outputType === 'images') {
    const maxCount = (widget as WidgetableImagesWidget).options?.maxCount;
    if (maxCount === undefined || maxCount <= 1) return 'single-image';
    if (maxCount <= 4) return 'multi-image';
    return 'local-image-pack';
  }
  if (widget.outputType === 'video') return 'single-video';
  return 'single-image';
};

const renderSelector = (
  selectorKind: SelectorKind,
  fieldInfo: Record<string, any>,
  widget: AnyWidget,
  value: any,
  extraOptions: any,
  resolveWorkBoundary: ReturnType<typeof useWorkBoundaryResolver>,
  onValueChange?: (next: string[]) => void,
) => {
  switch (selectorKind) {
    case 'single-image':
      return (
        <ImageSelector
          widgetableId={fieldInfo.id}
          value={value as string[]}
          workBoundary={resolveWorkBoundary()}
          onValueChange={onValueChange}
        />
      );
    case 'multi-image': {
      const maxCount = (widget as WidgetableImagesWidget).options?.maxCount ?? 1;
      return (
        <MultiImageSelector
          widgetableId={fieldInfo.id}
          value={value as string[]}
          maxCount={maxCount}
          workBoundary={resolveWorkBoundary()}
          onValueChange={onValueChange}
        />
      );
    }
    case 'masks':
      return (
        <MaskSelector
          widgetableId={fieldInfo.id}
          value={value as string[]}
          onValueChange={onValueChange}
        />
      );
    case 'local-image-pack':
      return (
        <LocalImagePackSelector
          widgetableId={fieldInfo.id}
          value={value as string[]}
          onValueChange={onValueChange}
        />
      );
    case 'single-video':
      return (
        <SingleVideoSelector
          widgetableId={fieldInfo.id}
          value={value as string[]}
          onValueChange={onValueChange}
        />
      );
    default:
      return null;
  }
};

export const createImageMaskWidgetRouter = (options: RouterOptions = {}): WidgetRenderer => {
  const renderer: WidgetRenderer = ({ fieldInfo, widget, value, extraOptions, onValueChange }) => {
    const resolveWorkBoundary = useWorkBoundaryResolver();
    const selectorKind = resolveSelectorKind(widget as AnyWidget, extraOptions);
    return renderSelector(
      selectorKind,
      fieldInfo as any,
      widget as AnyWidget,
      value,
      extraOptions,
      resolveWorkBoundary,
      typeof onValueChange === 'function' ? onValueChange : undefined,
    );
  };
  return renderer;
};

export const imageMaskWidgetRouter = createImageMaskWidgetRouter();
