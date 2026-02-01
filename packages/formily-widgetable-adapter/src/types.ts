import type { FormilySchema } from '@sdppp/pptask';
import type { WidgetableNode, WidgetableWidget } from '@sdppp/common/schemas/schemas';

export type OutputType = WidgetableWidget['outputType'];

export type AdapterWarning = {
  field: string;
  message: string;
};

export type FieldOverride = {
  outputType: OutputType;
  title?: string;
  options?: Record<string, any>;
};

export type AdapterOptions = {
  fieldOverrides?: Record<string, FieldOverride>;
  componentMap?: Record<string, OutputType>;
  orderBy?: 'x-order' | 'x-index' | 'property';
  fillDefaults?: boolean;
};

export type AdapterResult = {
  nodes: WidgetableNode[];
  defaultValues: Record<string, any>;
  warnings: AdapterWarning[];
};

export type { FormilySchema };
