import {terser} from 'rollup-plugin-terser';

export default {
  input: './src/index.js',
  plugins: [terser()],
  output: [
    {
      file: './dist/cjss.min.js',
      format: 'iife',
      name: 'cjss'
    },
    {
      file: './dist/cjss.js',
      format: 'iife',
      name: 'cjss',
      sourcemap: 'inline'
    }
  ]
};