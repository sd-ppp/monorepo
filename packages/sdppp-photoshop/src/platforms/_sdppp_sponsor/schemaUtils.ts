import type { ISchema } from '@formily/json-schema';

export type FormilySchema = ISchema;

const UNSUPPORTED_COMPONENTS = new Set(['Upload.Dragger']);

export function sanitizeSchema(schema: FormilySchema | null | undefined): FormilySchema | null {
  if (!schema || typeof schema !== 'object') return null;

  let current = removeFieldPresentationHints(schema as FormilySchema);

  if (isUnsupportedField(current)) {
    return null;
  }

  if (isUploadField(current)) {
    current = transformUploadField(current);
  }

  if (current.properties && typeof current.properties === 'object') {
    const nextProperties: NonNullable<FormilySchema['properties']> = {};
    for (const key of Object.keys(current.properties)) {
      const field = current.properties[key];
      if (!field || typeof field !== 'object') continue;
      const sanitized = sanitizeSchema(field as FormilySchema);
      if (sanitized) {
        nextProperties[key] = sanitized;
      }
    }
    current.properties = nextProperties;
  }

  if (current.items) {
    const sanitizedItems = sanitizeItems(current.items);
    if (sanitizedItems) {
      current.items = sanitizedItems;
    } else {
      delete current.items;
    }
  }

  return current;
}

function isUnsupportedField(field: FormilySchema): boolean {
  const component = field['x-component'];
  if (typeof component === 'string') {
    if (UNSUPPORTED_COMPONENTS.has(component)) return true;
  }
  return false;
}

function isUploadField(field: FormilySchema): boolean {
  const component = field['x-component'];
  return typeof component === 'string' && component === 'Upload';
}

function transformUploadField(field: FormilySchema): FormilySchema {
  const componentProps = (field['x-component-props'] as Record<string, unknown> | undefined) ?? {};
  const normalizedProps = normalizeAutoImageComponentProps(componentProps);

  // 🎯 关键判断：如果有 sourceHints，使用 DeferredUploadSelector（延迟上传）
  // 否则使用 UploadSelector（手动上传）
  const hasSourceHints = normalizedProps.sourceHints && typeof normalizedProps.sourceHints === 'object';
  
  const nextField: FormilySchema = { ...field };
  
  if (hasSourceHints) {
    // 使用延迟上传组件
    nextField['x-component'] = 'DeferredUploadSelector';
    nextField.type = 'object';  // DeferredUploadValue 是对象类型
    nextField.default = undefined;  // 延迟组件自己生成值
  } else {
    // 使用手动上传组件
    nextField['x-component'] = 'UploadSelector';
    nextField.type = 'array';
    
    // Ensure the new component always receives an array value.
    const defaultValue = nextField.default;
    if (!Array.isArray(defaultValue)) {
      nextField.default = [];
    }
  }

  nextField['x-component-props'] = normalizedProps;

  return nextField;
}

function normalizeAutoImageComponentProps(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};

  if (typeof props.label === 'string' && props.label.trim()) {
    next.label = props.label.trim();
  }

  // 处理 variant 字段
  if (typeof props.variant === 'string' && props.variant.trim()) {
    const variant = props.variant.trim();
    // 验证 variant 是否为合法值
    const validVariants = ['nomask', 'deferred'];
    if (validVariants.includes(variant)) {
      next.variant = variant;
    }
  }

  // 🎯 处理 maxCount 字段（支持多图上传）
  if (typeof props.maxCount === 'number' && props.maxCount > 0) {
    next.maxCount = props.maxCount;
  }

  // sourceHints 由外部 Schema 提供，直接透传
  const rawHints =
    (props.sourceHints as Record<string, unknown> | undefined) ??
    (props.autoSourceHints as Record<string, unknown> | undefined);

  const normalizedHints = normalizeSourceHints(rawHints);
  if (normalizedHints) {
    next.sourceHints = normalizedHints;
  }

  return next;
}

function normalizeSourceHints(
  hints: Record<string, unknown> | undefined,
): { content?: string; mask?: string; boundary?: string } | undefined {
  if (!hints || typeof hints !== 'object') return undefined;

  const content = normalizeHintValue(hints.content);
  const mask = normalizeHintValue(hints.mask);
  const boundary = normalizeHintValue(hints.boundary);

  if (!content && !mask && !boundary) {
    return undefined;
  }

  const result: { content?: string; mask?: string; boundary?: string } = {};
  if (content) result.content = content;
  if (mask) result.mask = mask;
  if (boundary) result.boundary = boundary;
  return result;
}

function normalizeHintValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function sanitizeItems(items: FormilySchema['items']): FormilySchema['items'] | undefined {
  if (Array.isArray(items)) {
    const sanitizedList = items
      .map(item => (item && typeof item === 'object' ? sanitizeSchema(item as FormilySchema) : null))
      .filter(Boolean) as FormilySchema[];
    return sanitizedList.length ? sanitizedList : undefined;
  }

  if (items && typeof items === 'object') {
    const sanitized = sanitizeSchema(items as FormilySchema);
    return sanitized ?? undefined;
  }

  return undefined;
}

function removeFieldPresentationHints(field: FormilySchema): FormilySchema {
  const nextField: FormilySchema = { ...field };
  delete (nextField as Record<string, unknown>).description;

  const decoratorProps = clonePropsRecord(nextField['x-decorator-props']);
  if (decoratorProps) {
    delete decoratorProps.description;
    delete decoratorProps.extra;
    // 保留 hidden 属性，不删除
    if (Object.keys(decoratorProps).length) {
      nextField['x-decorator-props'] = decoratorProps;
    } else {
      delete nextField['x-decorator-props'];
    }
  }

  const componentProps = clonePropsRecord(nextField['x-component-props']);
  if (componentProps) {
    delete componentProps.description;
    delete componentProps.extra;
    if (Object.keys(componentProps).length) {
      nextField['x-component-props'] = componentProps;
    } else {
      delete nextField['x-component-props'];
    }
  }

  return nextField;
}

function clonePropsRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return { ...(value as Record<string, unknown>) };
}
