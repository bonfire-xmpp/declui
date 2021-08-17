module.exports = api => {
  const isTest = api.env('test');
  const transpileTS = isTest ? ['@babel/preset-typescript'] : [];

  return {
    "presets": ['@babel/preset-env', ...transpileTS],
    "plugins": ["@vue/babel-plugin-jsx"]
  }
}
