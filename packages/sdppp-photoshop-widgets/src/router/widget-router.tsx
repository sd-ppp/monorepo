import type { WidgetableImagesWidget, WidgetableWidget } from '@sdppp/common/schemas/schemas';
import type { WidgetRenderer, WidgetRendererProps } from '@sdppp/widgetable-ui';
import React from 'react';
import { useWorkBoundary } from 'sdppp-photoshop-widgets/context/WidgetImageMaskContext';
import { ImageSelector } from '../components/selectors/ImageSelector';
import { LocalImagePackSelector } from '../components/selectors/LocalImagePackSelector';
import { MaskSelector } from '../components/selectors/MaskSelector';
import { MultiImageSelector } from '../components/selectors/MultiImageSelector';
import { SingleVideoSelector } from '../components/selectors/SingleVideoSelector';

type SelectorKind =
  | 'single-image'
  | 'multi-image'
  | 'masks'
  | 'local-image-pack'
  | 'single-video';

type AnyWidget = WidgetableWidget & { options?: Record<string, any> };

export interface RouterOptions {
  selectorKind?: SelectorKind;
}

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
  workBoundaryUri: string,
  onValueChange?: (next: string[]) => void,
) => {
  switch (selectorKind) {
    case 'single-image':
      if (!(value instanceof Array)) value = [value];
      return (
        <ImageSelector
          widgetableId={fieldInfo.id}
          value={value as string[]}
          workBoundary={workBoundaryUri}
          onValueChange={(next: string[])=> {
            const singleOnValueChange = onValueChange as ((next: string) => void) | undefined;
            singleOnValueChange && singleOnValueChange(next[0]);
          }}
        />
      );
    case 'multi-image': {
      const maxCount = (widget as WidgetableImagesWidget).options?.maxCount ?? 1;
      return (
        <MultiImageSelector
          widgetableId={fieldInfo.id}
          value={value as string[]}
          maxCount={maxCount}
          workBoundary={workBoundaryUri}
          onValueChange={onValueChange}
        />
      );
    }
    case 'masks':
      if (!(value instanceof Array)) value = [value];
      return (
        <MaskSelector
          widgetableId={fieldInfo.id}
          value={value as string[]}
          workBoundary={workBoundaryUri}
          onValueChange={(next: string[])=> {
            const singleOnValueChange = onValueChange as ((next: string) => void) | undefined;
            singleOnValueChange && singleOnValueChange(next[0]);
          }}
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
      if (!(value instanceof Array)) value = [value];
      return (
        <SingleVideoSelector
          widgetableId={fieldInfo.id}
          value={value as string[]}
          onValueChange={(next: string[])=> {
            const singleOnValueChange = onValueChange as ((next: string) => void) | undefined;
            singleOnValueChange && singleOnValueChange(next[0]);
          }}
        />
      );
    default:
      return null;
  }
};

export const createImageMaskWidgetRouter = (options: RouterOptions = {}): WidgetRenderer => {
  const { selectorKind: configuredSelectorKind } = options;

  const Renderer: React.FC<WidgetRendererProps> = ({
    fieldInfo,
    widget,
    value,
    extraOptions,
    onValueChange,
  }) => {
    const workBoundaryUri = useWorkBoundary();
    const selectorKind =
      configuredSelectorKind ?? resolveSelectorKind(widget as AnyWidget, extraOptions);
    return renderSelector(
      selectorKind,
      fieldInfo as any,
      widget as AnyWidget,
      value,
      extraOptions,
      workBoundaryUri,
      typeof onValueChange === 'function' ? onValueChange : undefined,
    );
  };

  const renderer: WidgetRenderer = props => <Renderer {...props} />;
  return renderer;
};

export const imageMaskWidgetRouter = createImageMaskWidgetRouter();
