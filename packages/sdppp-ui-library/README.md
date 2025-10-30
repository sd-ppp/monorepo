# React UI Package + Storybook Playground

This repo is organized as a workspace with a consumable UI package and a self-contained Storybook playground for development/testing.

Structure

- packages/ui: Publishable React component library (Ant Design based).
- playground: Storybook playground to develop and test the components.

Quick Start

- Install deps: `npm i`
- Run Storybook: `npm run dev`
- Run tests (library): `npm test`
- Build library: `npm run build:ui`

Usage

- In other apps or the playground, import directly from the TypeScript source:
  `import { SyncButton, ImageSyncGroup } from '@sdppp/ui-library'`
  No build step is required; bundlers like Vite/Storybook transpile TS from the workspace package.

Notes

- Tailwind is present but not required by the components.
- The old Vite app entry is deprecated; use Storybook in `playground/`.
