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
package org.craftercms.studio.api.v1.script;

import java.util.Map;

import javax.script.ScriptException;

public interface ScriptExecutor {

	/**
	 * Execute a Groovy script string using the script engine for the given site
	 *
	 * @param siteId the site id
	 * @param script the script to execute
	 * @param model bindings available to the script
	 */
	void executeScriptString(String siteId, String script, Map<String, Object> model) throws ScriptException;
}
