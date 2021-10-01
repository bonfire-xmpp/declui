import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';
import { babel } from '@rollup/plugin-babel';

const name = require('./package.json').main.replace(/\.js$/, '');

const bundle = (config) => ({
  ...config,
  input: 'src/index.tsx',
  external: (id) => !/^[./]/.test(id),
});

export default [
  bundle({
    plugins: [babel({ babelHelpers: 'bundled' }), esbuild()],
    output: [
      {
        file: `${name}.js`,
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: `${name}.esm.js`,
        format: 'es',
        sourcemap: true,
      },
    ],
  }),
  bundle({
    plugins: [babel({ babelHelpers: 'bundled' }), dts()],
    output: {
      file: `${name}.d.ts`,
      format: 'es',
    },
  }),
];
