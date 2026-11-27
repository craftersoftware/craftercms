/*
 * Copyright (C) 2007-2023 Crafter Software Corporation. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as published by
 * the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const path = require('path');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

const publicPath = '/studio/static-assets/libs/monaco/';
const pkg = require('../../package.json');
const rimraf = require('rimraf');
const targetPath = path.resolve(__dirname, '..', '..', '..', '..', 'static-assets', 'libs', 'monaco');

// Delete prior build
rimraf.sync(`${targetPath}/*`);

module.exports = {
	mode: 'production',
	entry: './src/monaco/index.js',
	output: {
		publicPath,
		path: targetPath,
		filename: `monaco.${pkg.dependencies['monaco-editor']}.js`
	},
	module: {
		rules: [
			{
				test: /\.css$/,
				use: ['style-loader', 'css-loader']
			},
			{
				// An asset module, not file-loader: file-loader emits JS (`export default __webpack_public_path__ + ...`), and
				// webpack 5 also runs that rule for the `url()` of codicon.css, so the .ttf the CSS pointed at was a few bytes
				// of JS instead of the font. The URL is resolved against output.publicPath.
				test: /\.ttf$/,
				type: 'asset/resource',
				generator: {
					filename: '[name].[contenthash][ext]'
				}
			}
		]
	},
	plugins: [
		new MonacoWebpackPlugin({
			publicPath,
			languages: [
				'css',
				'dockerfile',
				'graphql',
				'handlebars',
				'html',
				'java',
				'javascript',
				'json',
				'less',
				'markdown',
				'scss',
				'shell',
				'typescript',
				'xml',
				'yaml'
			]
		})
	]
};
