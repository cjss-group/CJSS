import { terser } from 'rollup-plugin-terser';

export default [
  {
    input: './src/index.js',
    plugins: [terser()],
    output: {
      file: './demo/dist/cjss.min.js',
      sourcemap: process.argv.includes('-w') ? 'inline' : false,
      format: 'iife',
      name: 'cjss',
    },
  },
];
