import React, { useMemo } from 'react';

import {
  HtmlImageMaskCanvas,
  generateShapes,
  type ShapeDefinition,
} from '@sdppp/mock-photoshop';

const STAGE_WIDTH = 480;
const STAGE_HEIGHT = 400;

export const App: React.FC = () => {
  const shapes = useMemo<ShapeDefinition[]>(
    () => generateShapes(12, STAGE_WIDTH, STAGE_HEIGHT),
    []
  );

  return (
    <main className="app-shell">
      <HtmlImageMaskCanvas shapes={shapes} />
    </main>
  );
};
