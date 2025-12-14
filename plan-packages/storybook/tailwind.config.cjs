const path = require('node:path');

const storybookRoot = __dirname;
const workspaceRoots = ['packages', 'plan-packages', 'capabilities', 'internals', 'release-repos'];

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.join(storybookRoot, '.storybook/**/*.{ts,tsx,js,jsx,mdx}'),
    path.join(storybookRoot, 'src/**/*.{ts,tsx,js,jsx,mdx}'),
    path.join(storybookRoot, 'stories/**/*.{ts,tsx,js,jsx,mdx}'),
    ...workspaceRoots.map(dir =>
      path.join(storybookRoot, `../${dir}/**/*.{ts,tsx,js,jsx,mdx}`)
    )
  ],
  theme: {
    extend: {}
  },
  plugins: []
};
