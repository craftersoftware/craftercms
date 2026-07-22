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
package org.craftercms.studio.api.v2.scripting;

import groovy.util.GroovyScriptEngine;

/**
 * Holds the {@link GroovyScriptEngine} instances for all sites
 *
 * @author joseross
 * @since 4.0
 */
public interface ScriptEngineManager {

	/**
	 * Returns the {@link GroovyScriptEngine} for the given site, if it doesn't
	 * exist then a new one is created
	 *
	 * @param siteId the id fo the site
	 * @return the script engine instance
	 */
	GroovyScriptEngine getScriptEngine(String siteId);

	/**
	 * Creates a new {@link GroovyScriptEngine} for the given site, closing the
	 * previous one if present
	 *
	 *
	 * @param siteId the id of the site
	 */
	void reloadScriptEngine(String siteId);

}
