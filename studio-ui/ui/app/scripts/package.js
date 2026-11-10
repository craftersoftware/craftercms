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

const uppyPkg = require('../../uppy/package.json');

const path = require('path');
const fse = require('fs-extra');
const glob = require('glob');
const prettier = require('prettier');

const packagePath = process.cwd();
const buildPath = path.join(packagePath, './build_tsc');
const srcPath = path.join(packagePath, './src');

const optional = [];
const ignoreDeps = ['react-scripts', 'web-vitals', 'typescript'];
const peerDeps = [
	'@emotion/css',
	'@emotion/react',
	'@emotion/styled',
	'@mui/icons-material',
	'@mui/lab',
	'@mui/material',
	'@mui/styles',
	'query-string',
	'react',
	'react-dom',
	'react-intl',
	'react-redux',
	'react-router-dom',
	'redux',
	'redux-observable',
	'rxjs',
	'@videojs/react',
	'@videojs/hlsjs-video',
	'@videojs/dash-video'
];

async function createPackageFile() {
	const appPackageContent = await fse.readFile(path.resolve(packagePath, './package.json'), 'utf8');
	const appPackage = JSON.parse(appPackageContent);

	const { name, description, version, keywords, repository, license } = appPackage;

	const newPackageData = {
		private: false,
		name,
		description,
		version,
		keywords,
		repository,
		license,
		main: './index.js',
		module: './index.js',
		typings: './index.d.ts',
		dependencies: {},
		peerDependencies: {},
		peerDependenciesMeta: {}
	};

	Object.entries(appPackage.dependencies).forEach(([dep, version]) => {
		if (!ignoreDeps.includes(dep)) {
			if (dep === '@craftercms/uppy') {
				newPackageData.dependencies[dep] = uppyPkg.version;
			} else if (optional.includes(dep)) {
				newPackageData.peerDependenciesMeta[dep] = {
					optional: true
				};
			} else if (peerDeps.includes(dep)) {
				newPackageData.peerDependencies[dep] = version;
			} else {
				newPackageData.dependencies[dep] = version;
			}
		}
	});

	const targetPath = path.resolve(buildPath, './package.json');

	await fse.writeFile(targetPath, JSON.stringify(newPackageData, null, 2), { flag: 'w+', encoding: 'utf8' });
	console.log(`Created package.json`);
}

// TODO: This will likely screw up source maps
async function bannerAndFormat() {
	const filePattern = '**/**.{ts,js}';
	const filesToProcess = glob.sync(filePattern, { cwd: buildPath });
	console.log(`Beginning copyright & format of ${filesToProcess.length} files (${filePattern}).`);
	const banner = `${await fse.readFile(path.resolve(packagePath, './scripts/license.txt'), 'utf8')}\n`;
	const config = path.join(__dirname, '../../../prettier.config.js');
	filesToProcess.forEach(async (filePath) => {
		const fullPath = path.join(buildPath, filePath);
		const options = await prettier.resolveConfig(fullPath, { config });
		const code = await fse.readFile(fullPath, 'utf8');
		try {
			const formattedCode = await prettier.format(code, { ...options, filepath: fullPath });
			const output = `${banner}${formattedCode}`;
			await fse.writeFile(fullPath, output, 'utf8');
		} catch {
			console.log(`Error formatting "${filePath}"`);
		}
	});
	console.log(`Formatted and added license to "${filePattern}".`);
}

async function run() {
	try {
		await createPackageFile();

		const directoryPackages = glob.sync('**/**.scss', { cwd: srcPath });
		await Promise.all(
			directoryPackages.map((sassFilePath) =>
				fse.copyFile(path.join(srcPath, sassFilePath), path.join(buildPath, sassFilePath))
			)
		);
		console.log(`Copied scss to build`);

		fse.copy(path.join(srcPath, 'assets'), path.join(buildPath, 'assets'));
		console.log(`Copied assets to build`);

		await fse.copyFile(path.join(packagePath, 'scripts', 'LICENSE'), path.join(buildPath, 'LICENSE'));
		console.log('License file added');

		await fse.copyFile(path.join(packagePath, 'scripts', 'README.md'), path.join(buildPath, 'README.md'));
		console.log('Readme file added');

		await bannerAndFormat();
	} catch (err) {
		console.error(err);
		process.exit(1);
	}
}

async function renameNpmIndex(sourceFileName, destFileName) {
	let pathToNpmIndex = path.join(buildPath, sourceFileName);
	let sourceExists = await fse.pathExists(pathToNpmIndex);
	if (sourceExists) {
		try {
			await fse.move(pathToNpmIndex, path.join(buildPath, destFileName));
			console.log(`Renamed ${sourceFileName} to ${destFileName}`);
		} catch (e) {
			console.error(e);
		}
	} else {
		console.log(`File "${sourceFileName}" not found, skipping`);
	}
}

run();
