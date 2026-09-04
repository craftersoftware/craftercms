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

(function () {
	try {
		var xhr = new XMLHttpRequest();
		xhr.open('GET', '/studio/api/2/ui/bootstrap', false);
		xhr.withCredentials = true;
		xhr.send(null);
		
		if (xhr.status === 200) {
			var response = JSON.parse(xhr.responseText);
			var bootstrap = response && response.bootstrap;
			if (bootstrap) {
				window.__crafterUiBootstrap = bootstrap;
				if (bootstrap.cookieDomain) {
					document.domain = bootstrap.cookieDomain;
				}
			}
		} else {
			document.domain = location.hostname;
		}
	} catch (e) {
		document.domain = location.hostname;
	}
})();
