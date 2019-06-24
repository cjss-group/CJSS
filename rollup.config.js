import { terser } from 'rollup-plugin-terser';

export default [
  {
    input: './src/index.js',
    plugins: [],
    output: {
      file: './demo/dist/cjss.js',
      format: 'iife',
      name: 'CJSS',
      sourcemap: 'inline',
    },
  },
  {
    input: './src/index.js',
    plugins: [terser()],
    output: {
      file: './demo/dist/cjss.min.js',
      format: 'iife',
      name: 'CJSS',
    },
  },
];
