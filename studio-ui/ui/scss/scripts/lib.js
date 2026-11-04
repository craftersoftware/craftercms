/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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

const fs = require('fs'),
	sass = require('sass'),
	OUT_DIR = '../../static-assets/styles',
	FILES = [
		'temp',
		{ input: 'user-dashboard/user-dashboard', output: 'main' },
		'search',
		'uppy',
		'tinymce-ace',
		'browse',
		{ input: 'guest/guest', output: 'guest' },
		{ input: 'base', output: '../themes/cstudioTheme/base' },
		{ input: 'global', output: '../themes/cstudioTheme/css/global' },
		'typography',
		'bootstrap-5.3'
	];

function processFile(data, devMode = false) {
	let input, output;
	if (typeof data === 'string') {
		input = output = data;
	} else {
		input = data.input;
		output = data.output;
	}
	sass.render(
		{
			file: `./src/${input}.scss`,
			outputStyle: 'compressed',
			sourceMap: devMode === true,
			sourceMapEmbed: devMode === true,
			sourceMapContents: devMode === true,
			outFile: `${OUT_DIR}/${output}.css`
		},
		function (error, result) {
			if (!error) {
				write({ file: output, content: result.css.toString(), map: result.map, devMode });
			} else {
				console.log(`Error compiling ${input}.scss`, error);
			}
		}
	);
}

function processFileDevMode(data) {
	processFile(data, true);
}

function write({ file, content, devMode }) {
	if (!fs.existsSync(OUT_DIR)) {
		fs.mkdirSync(OUT_DIR);
	}

	const regExp = /\/\*[^*]*\*+([^\/][^*]*)(Crafter Software)[^*]*\*+([^\/][^*]*\*+)*\//g,
		copyright = content.match(regExp),
		withoutCopyrights = content.replace(regExp, '').replace(String.fromCharCode(65279), ''),
		css = copyright ? `${copyright[0]}\n\n${withoutCopyrights}` : content;

	fs.writeFile(`${OUT_DIR}/${file}.css`, devMode ? content : css, function (error) {
		if (!error) {
			console.log(`[CSS] ${file}.css`);
		} else {
			console.log(`Error writing ${file}.css`);
			console.log(error);
		}
	});
}

module.exports = { processFile, write, FILES, OUT_DIR, processFileDevMode };
