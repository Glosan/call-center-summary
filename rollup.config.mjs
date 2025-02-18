import typescript from '@rollup/plugin-typescript';
import deleteBeforeBuild from 'rollup-plugin-delete';
import { nodeExternals } from 'rollup-plugin-node-externals';
import json from '@rollup/plugin-json';

// eslint-disable-next-line import/no-default-export
export default {
	input: './src/server.ts',
	output: {
		file: `./build/server.mjs`,
		format: 'esm',
		sourcemap: false,
		exports: 'named'
	},
	plugins: [
		deleteBeforeBuild({
			runOnce: true,
			targets: `./build/*`
		}),
		typescript(),
		nodeExternals(),
		json()
	]
};
