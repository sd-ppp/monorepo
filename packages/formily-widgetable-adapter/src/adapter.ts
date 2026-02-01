import type { FormilyFieldSchema, FormilySchema } from '@sdppp/pptask';
import type { WidgetableNode, WidgetableWidget } from '@sdppp/common/schemas/schemas';
import { getDefaultValues } from '@sdppp/common/schemas/schemas';
import type { AdapterOptions, AdapterResult, AdapterWarning, FieldOverride, OutputType } from './types';

const DEFAULT_COMPONENT_MAP: Record<string, OutputType> = {
  'Input.TextArea': 'string',
  'Input': 'string',
  'InputNumber': 'number',
  'NumberPicker': 'number',
  'Select': 'combo',
  'Switch': 'boolean',
  'Upload': 'images',
  'Upload.Dragger': 'images',
  'UploadSelector': 'images',
  'DeferredUploadSelector': 'images',
};

const DEFAULT_UI_WEIGHT = 12;

export function adaptFormilySchemaToWidgetable(
  schema: FormilySchema,
  options: AdapterOptions = {}
): AdapterResult {
  const warnings: AdapterWarning[] = [];
  const nodes: WidgetableNode[] = [];
  const defaultValues: Record<string, any> = {};

  if (!schema || schema.type !== 'object' || !schema.properties) {
    return { nodes, defaultValues, warnings };
  }

  const requiredSet = new Set(schema.required ?? []);
  const entries = Object.entries(schema.properties) as Array<[string, FormilyFieldSchema]>;
  const orderBy = options.orderBy ?? 'x-order';

  const sortedEntries = entries
    .map(([name, field], index) => {
      return {
        name,
        field,
        index,
        order: getOrderValue(field, orderBy, index),
      };
    })
    .sort((a, b) => a.order - b.order);

  for (const { name, field } of sortedEntries) {
    const override = options.fieldOverrides?.[name];
    const outputType = resolveOutputType(name, field, override, options, warnings);
    const required = resolveRequired(name, field, requiredSet, override);
    const widgetOptions = buildWidgetOptions(outputType, field, required, override, warnings, name);

    const widget = {
      name: '',
      uiWeight: DEFAULT_UI_WEIGHT,
      outputType,
      options: widgetOptions,
    } as WidgetableWidget;

    nodes.push({
      id: name,
      title: override?.title ?? field.title ?? name,
      widgets: [widget],
      uiWeightSum: DEFAULT_UI_WEIGHT,
    });

    if (Object.prototype.hasOwnProperty.call(field, 'default')) {
      defaultValues[name] = field.default;
    } else if (options.fillDefaults !== false) {
      const defaultValue = getWidgetDefaultValue(outputType, widgetOptions);
      if (defaultValue !== undefined) {
        defaultValues[name] = defaultValue;
      }
    }
  }

  return { nodes, defaultValues, warnings };
}

function getOrderValue(field: FormilyFieldSchema, orderBy: AdapterOptions['orderBy'], index: number): number {
  if (orderBy === 'property') {
    return index;
  }
  const orderKey = orderBy === 'x-index' ? 'x-index' : 'x-order';
  const value = field?.[orderKey];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const fallback = field?.['x-order'];
  if (typeof fallback === 'number' && Number.isFinite(fallback)) {
    return fallback;
  }
  return index;
}

function resolveRequired(
  name: string,
  field: FormilyFieldSchema,
  requiredSet: Set<string>,
  override?: FieldOverride
): boolean {
  if (override?.options && Object.prototype.hasOwnProperty.call(override.options, 'required')) {
    return Boolean(override.options.required);
  }
  if (typeof field.required === 'boolean') {
    return field.required;
  }
  return requiredSet.has(name);
}

function resolveOutputType(
  name: string,
  field: FormilyFieldSchema,
  override: FieldOverride | undefined,
  options: AdapterOptions,
  warnings: AdapterWarning[]
): OutputType {
  if (override?.outputType) {
    return override.outputType;
  }

  const component = field?.['x-component'];
  const componentMap = { ...DEFAULT_COMPONENT_MAP, ...(options.componentMap ?? {}) };
  if (component && componentMap[component]) {
    return componentMap[component];
  }
  if (typeof component === 'string' && /upload/i.test(component)) {
    return 'images';
  }

  if (Array.isArray(field?.enum) || Array.isArray(field?.oneOf) || Array.isArray(field?.anyOf)) {
    return 'combo';
  }

  switch (field?.type) {
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      warnings.push({
        field: name,
        message: 'Array field mapped to string. Provide fieldOverrides for images or custom widgets.',
      });
      return 'string';
    case 'string':
    default:
      return 'string';
  }
}

function buildWidgetOptions(
  outputType: OutputType,
  field: FormilyFieldSchema,
  required: boolean,
  override: FieldOverride | undefined,
  warnings: AdapterWarning[],
  fieldName: string
) {
  const componentProps = field?.['x-component-props'] ?? {};

  let baseOptions: Record<string, any> = { required };

  if (outputType === 'combo') {
    const enumOptions = normalizeEnum(field);
    if (!enumOptions.values.length) {
      warnings.push({
        field: fieldName,
        message: 'Combo field missing enum values.',
      });
    }
    baseOptions = {
      required,
      values: enumOptions.values,
      labels: enumOptions.labels,
    };
  }

  if (outputType === 'number') {
    baseOptions = {
      required,
      min: coerceNumber(componentProps.min ?? field.minimum),
      max: coerceNumber(componentProps.max ?? field.maximum),
      step: coerceNumber(componentProps.step ?? field.step),
    };
  }

  if (outputType === 'images') {
    baseOptions = {
      required,
      maxCount: coerceNumber(componentProps.maxCount ?? componentProps.max_count) ?? 1,
    };
  }

  if (outputType === 'masks') {
    baseOptions = { required };
  }

  if (outputType === 'boolean') {
    baseOptions = { required };
  }

  if (outputType === 'string') {
    baseOptions = { required };
  }

  const merged = {
    ...baseOptions,
    ...(override?.options ?? {}),
  };

  if (typeof merged.required !== 'boolean') {
    merged.required = required;
  }

  return merged;
}

function normalizeEnum(field: FormilyFieldSchema): { values: string[]; labels?: string[] } {
  const source = field?.enum ?? field?.oneOf ?? field?.anyOf ?? [];
  if (!Array.isArray(source)) {
    return { values: [] };
  }

  const values: string[] = [];
  const labels: string[] = [];
  for (const item of source) {
    if (item && typeof item === 'object') {
      const value = item.value ?? item.const ?? item.label;
      if (value !== undefined) {
        values.push(String(value));
        if (item.label) {
          labels.push(String(item.label));
        }
      }
      continue;
    }
    values.push(String(item));
  }

  if (labels.length > 0 && labels.length === values.length) {
    return { values, labels };
  }
  return { values };
}

function coerceNumber(value: any): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function getWidgetDefaultValue(outputType: OutputType, options: Record<string, any>) {
  if (outputType === 'combo' && (!Array.isArray(options.values) || options.values.length === 0)) {
    return undefined;
  }
  return getDefaultValues(outputType, options);
}
