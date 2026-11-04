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
		filename: `monaco.${pkg.dependencies['monaco-editor']}.js`,
		globalObject: 'self'
	},
	module: {
		rules: [
			{
				test: /\.css$/,
				use: ['style-loader', 'css-loader']
			},
			{
				test: /\.ttf$/,
				type: 'asset/resource'
			}
		]
	}
};
