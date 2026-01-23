const ensureStorybookExports = (pkg) => {
  if (pkg.name !== '@storybook/react' || !pkg.exports || typeof pkg.exports !== 'object') {
    return pkg;
  }

  const mappings = {
    './dist/entry-preview.mjs': './dist/entry-preview.js',
    './dist/entry-preview-argtypes.mjs': './dist/entry-preview-argtypes.js',
    './dist/entry-preview-docs.mjs': './dist/entry-preview-docs.js',
    './dist/entry-preview-rsc.mjs': './dist/entry-preview-rsc.js'
  };

  pkg.exports = { ...pkg.exports };

  for (const [key, value] of Object.entries(mappings)) {
    if (!pkg.exports[key]) {
      pkg.exports[key] = value;
    }
  }

  return pkg;
};

module.exports = {
  hooks: {
    readPackage(pkg) {
      return ensureStorybookExports(pkg);
    }
  }
};
