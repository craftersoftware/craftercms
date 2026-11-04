/*
 * Copyright (C) 2007-2026 Crafter Software Corporation. All Rights Reserved.
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

self.MonacoEnvironment = {
	getWorker(_, label) {
		switch (label) {
			case 'json':
				return new Worker(new URL('monaco-editor/language/json/json.worker', import.meta.url));
			case 'css':
			case 'scss':
			case 'less':
				return new Worker(new URL('monaco-editor/language/css/css.worker', import.meta.url));
			case 'html':
			case 'handlebars':
			case 'razor':
				return new Worker(new URL('monaco-editor/language/html/html.worker', import.meta.url));
			case 'typescript':
			case 'javascript':
				return new Worker(new URL('monaco-editor/language/typescript/ts.worker', import.meta.url));
			default:
				return new Worker(new URL('monaco-editor/editor/editor.worker', import.meta.url));
		}
	}
};
