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
package org.craftercms.engine.scripting.impl;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.Map;

import org.craftercms.engine.exception.ScriptException;
import org.craftercms.engine.exception.ScriptNotFoundException;
import org.craftercms.engine.scripting.Script;
import org.craftercms.engine.scripting.ScriptFactory;
import org.craftercms.engine.service.context.SiteContext;
import static org.craftercms.engine.util.GroovyScriptUtils.getCompilerConfiguration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import groovy.lang.GroovyClassLoader;
import groovy.util.GroovyScriptEngine;
import groovy.util.ResourceConnector;
import groovy.util.ResourceException;

/**
 * {@link org.craftercms.engine.scripting.ScriptFactory} used specifically for
 * Groovy. Very useful when scripts have dependencies to other scripts.
 *
 * @author Alfonso Vásquez
 */
public class GroovyScriptFactory implements ScriptFactory {

	private static final Logger logger = LoggerFactory.getLogger(GroovyScriptFactory.class);
	public static final String CACHE_CONST_KEY_ELEM_SCRIPT = "groovyScript";

	public static final String GROOVY_FILE_EXTENSION = "groovy";

	protected SiteContext siteContext;
	protected GroovyScriptEngine scriptEngine;
	protected Map<String, Object> globalVariables;

	public GroovyScriptFactory(SiteContext siteContext, ResourceConnector resourceConnector,
			Map<String, Object> globalVariables, boolean enableScriptSandbox) {
		this.siteContext = siteContext;
		this.scriptEngine = new GroovyScriptEngine(resourceConnector);
		applyCompilerConfiguration(enableScriptSandbox);
		this.globalVariables = globalVariables;
	}

	public GroovyScriptFactory(SiteContext siteContext, ResourceConnector resourceConnector,
			ClassLoader parentClassLoader, Map<String, Object> globalVariables,
			boolean enableScriptSandbox) {
		this.siteContext = siteContext;
		this.scriptEngine = new GroovyScriptEngine(resourceConnector, parentClassLoader);
		applyCompilerConfiguration(enableScriptSandbox);
		this.globalVariables = globalVariables;
	}

	@Override
	public String getScriptFileExtension() {
		return GROOVY_FILE_EXTENSION;
	}

	@Override
	public Script getScript(String url) throws ScriptException {
		return siteContext.getCacheTemplate().getObject(siteContext.getContext(), () -> {
			try {
				return new GroovyScript(url, scriptEngine.loadScriptByName(url), globalVariables);
			} catch (Exception e) {
				Throwable cause = e.getCause();
				if (e instanceof ResourceException && cause instanceof FileNotFoundException) {
					throw new ScriptNotFoundException(cause.getMessage(), cause);
				} else {
					throw new ScriptException(e.getMessage(), e);
				}
			}
		}, url, CACHE_CONST_KEY_ELEM_SCRIPT);
	}

	@Override
	public void destroy() {
		closeGroovyClassLoader(scriptEngine != null ? scriptEngine.getGroovyClassLoader() : null);
	}

	/**
	 * {@link GroovyScriptEngine#setConfig} always replaces its internal
	 * {@link GroovyClassLoader}; close the previous one so it is not orphaned
	 * on every site context create.
	 */
	private void applyCompilerConfiguration(boolean enableScriptSandbox) {
		GroovyClassLoader previousLoader = scriptEngine.getGroovyClassLoader();
		scriptEngine.setConfig(getCompilerConfiguration(enableScriptSandbox));
		GroovyClassLoader currentLoader = scriptEngine.getGroovyClassLoader();
		if (previousLoader != null && previousLoader != currentLoader) {
			closeGroovyClassLoader(previousLoader);
		}
	}

	protected void closeGroovyClassLoader(GroovyClassLoader groovyClassLoader) {
		if (groovyClassLoader == null) {
			return;
		}
		try {
			// close() -> clearCache() also removes MetaClasses via InvokerHelper.removeClass
			groovyClassLoader.close();
		} catch (IOException e) {
			logger.error("Error while closing Groovy class loader", e);
		}
	}

}
