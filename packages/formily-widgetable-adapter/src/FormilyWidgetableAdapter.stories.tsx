import React from 'react';
import type { FormilySchema } from '@sdppp/pptask';
import { adaptFormilySchemaToWidgetable } from './adapter';

const schema: FormilySchema = {
  type: 'object',
  properties: {
    image_input: {
      type: 'string',
      title: 'Image Input',
      'x-component': 'Input.TextArea',
      'x-component-props': {
        placeholder: 'data:image/png;base64,...',
        rows: 2,
      },
      required: true,
    },
    prompt: {
      type: 'string',
      title: 'Prompt',
      'x-component': 'Input.TextArea',
      'x-component-props': {
        rows: 4,
      },
      required: true,
    },
    style: {
      type: 'string',
      title: 'Style',
      'x-component': 'Select',
      enum: [
        { label: 'Vivid', value: 'vivid' },
        { label: 'Natural', value: 'natural' },
      ],
      default: 'vivid',
    },
    count: {
      type: 'number',
      title: 'Count',
      'x-component': 'InputNumber',
      'x-component-props': {
        min: 1,
        max: 4,
        step: 1,
      },
      default: 1,
    },
    use_mask: {
      type: 'boolean',
      title: 'Use Mask',
      'x-component': 'Switch',
      default: false,
    },
  },
  required: ['image_input', 'prompt'],
};

const output = adaptFormilySchemaToWidgetable(schema, {
  fieldOverrides: {
    image_input: {
      outputType: 'images',
      options: {
        maxCount: 1,
      },
    },
  },
});

const AdapterPreview = () => {
  return (
    <div style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}>
      {JSON.stringify(output, null, 2)}
    </div>
  );
};

export default {
  title: 'Formily Adapter/Preview',
  component: AdapterPreview,
};

export const Default = {
  render: () => <AdapterPreview />,
};
