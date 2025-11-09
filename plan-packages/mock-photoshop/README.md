# @sdppp/mock-photoshop

Konva-based implementation that mirrors the playground image-mask stage. It renders layers,
a marquee selection rectangle, and a thumbnail layer list while exposing the same `Stage`
reference and selection contract the mock external API expects.

## Getting started

1. Install workspace dependencies if you have not already:

   ```
   pnpm install
   ```

2. Launch the playground dev server:

   ```
   pnpm --filter @sdppp/mock-photoshop dev
   ```

   This starts a Vite server at http://localhost:5173 rendering the HTML canvas demo.

3. Build library output:

   ```
   pnpm --filter @sdppp/mock-photoshop build
   ```

## Usage

Import the default component if you want to embed the demo UI elsewhere:

```tsx
import React, { useMemo, useRef, useState } from 'react';
import { HtmlImageMaskCanvas, generateShapes } from '@sdppp/mock-photoshop';
import type { SelectionRect, ShapeDefinition } from '@sdppp/mock-photoshop';
import type { Stage as KonvaStage } from 'konva/lib/Stage';

const Demo: React.FC = () => {
  const shapes = useMemo<ShapeDefinition[]>(() => generateShapes(12, 480, 400), []);
  const stageRef = useRef<KonvaStage | null>(null);
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [activeLayer, setActiveLayer] = useState<string | null>(shapes[0]?.id ?? null);

  return (
    <HtmlImageMaskCanvas
      shapes={shapes}
      stageRef={stageRef}
      selectionRect={selection}
      onSelectionChange={setSelection}
      selectedLayerId={activeLayer}
      onLayerSelect={setActiveLayer}
    />
  );
};
```

The component can work in a fully controlled mode (providing shapes, selection and callbacks),
or fall back to its internal mock data for playground usage.
