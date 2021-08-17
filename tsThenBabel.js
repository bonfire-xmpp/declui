const { createHash } = require('crypto');
const babelJest = require('babel-jest').default;
const tsJest = require('ts-jest').default.createTransformer();

module.exports = {
  getCacheKey(fileData, filename, ...rest) {
    const babelCacheKey = babelJest.getCacheKey(fileData, filename, ...rest);

    return createHash('md5')
      .update(babelCacheKey)
      .update('tsThenBabel')
      .digest('hex');
  },
  process(src, filename, ...rest) {
    const transformedContent = tsJest.process(src, filename, ...rest);
    return babelJest.process(
      transformedContent.code || transformedContent,
      filename,
      ...rest
    );
  },
};
