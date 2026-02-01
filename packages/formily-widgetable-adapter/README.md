# @sdppp/formily-widgetable-adapter

Adapter utilities to convert Formily schemas (from pptask providers) into Widgetable nodes.

## Usage

```ts
import { adaptFormilySchemaToWidgetable } from '@sdppp/formily-widgetable-adapter';

const result = adaptFormilySchemaToWidgetable(schema, {
  fieldOverrides: {
    image_input: { outputType: 'images', options: { maxCount: 1 } },
  },
});
```

## Notes

- Unknown or array fields fall back to `string` with a warning.
- Use `fieldOverrides` to force `images`/`masks` or custom options.
