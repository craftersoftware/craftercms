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

package org.craftercms.studio.impl.v1.script;

import java.beans.ConstructorProperties;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;
import javax.script.ScriptException;
import javax.script.SimpleBindings;

import org.apache.commons.lang3.StringUtils;
import org.codehaus.groovy.control.CompilerConfiguration;
import org.codehaus.groovy.jsr223.GroovyScriptEngineImpl;
import static org.craftercms.studio.api.v1.constant.GitRepositories.SANDBOX;
import static org.craftercms.studio.api.v1.constant.StudioConstants.FILE_SEPARATOR;
import org.craftercms.studio.api.v1.script.ScriptExecutor;
import org.craftercms.studio.api.v2.event.site.SiteDeletingEvent;
import org.craftercms.studio.api.v2.utils.GitRepositoryHelper;
import org.craftercms.studio.impl.v2.utils.GroovyClassLoaderUtils;
import org.jenkinsci.plugins.scriptsecurity.sandbox.groovy.RejectASTTransformsCustomizer;
import org.jenkinsci.plugins.scriptsecurity.sandbox.groovy.SandboxInterceptor;
import org.kohsuke.groovy.sandbox.SandboxTransformer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;

import groovy.lang.GroovyClassLoader;

public class GroovyScriptExecutor implements ScriptExecutor {

	protected final static String GROOVY_ENGINE_NAME = "groovy";
	private static final Logger logger = LoggerFactory.getLogger(GroovyScriptExecutor.class);

	protected GitRepositoryHelper gitRepositoryHelper;
	protected final SandboxInterceptor sandboxInterceptor;
	protected final boolean enableScriptSandbox;
	protected final List<String> scriptsClassPath;
	protected String pluginClassPath;

	protected CompilerConfiguration compilerConfig;
	protected GroovyClassLoader sharedClassLoader;
	protected ScriptEngineManager scriptEngineFactory;
	protected final Map<String, GroovyScriptEngineImpl> scriptEngines = new ConcurrentHashMap<>();

	@ConstructorProperties({"gitRepositoryHelper", "sandboxInterceptor", "scriptsClassPath", "pluginClassPath", "enableScriptSandbox"})
	public GroovyScriptExecutor(final GitRepositoryHelper gitRepositoryHelper, SandboxInterceptor sandboxInterceptor,
								List<String> scriptsClassPath, String pluginClassPath, boolean enableScriptSandbox) {
		this.gitRepositoryHelper = gitRepositoryHelper;
		this.sandboxInterceptor = sandboxInterceptor;
		this.scriptsClassPath = scriptsClassPath;
		this.pluginClassPath = pluginClassPath;
		this.enableScriptSandbox = enableScriptSandbox;

		compilerConfig = new CompilerConfiguration();
		if (enableScriptSandbox) {
			compilerConfig.addCompilationCustomizers(new RejectASTTransformsCustomizer(), new SandboxTransformer());
		}
		sharedClassLoader = new GroovyClassLoader(getClass().getClassLoader(), compilerConfig);
		scriptEngineFactory = new ScriptEngineManager();
		for (String classPath : scriptsClassPath) {
			sharedClassLoader.addClasspath(classPath);
		}
	}

	@Override
	public void executeScriptString(String siteId, String script, Map<String, Object> model) throws ScriptException {
		if(sharedClassLoader == null) {
			throw new IllegalStateException("GroovyScriptExecutor not initialized, call init() method first");
		}
		if (enableScriptSandbox && sandboxInterceptor != null) {
			sandboxInterceptor.register();
		}
		try {
			getScriptEngine(siteId).eval(script, new SimpleBindings(model));
		} finally {
			if (enableScriptSandbox && sandboxInterceptor != null) {
				sandboxInterceptor.unregister();
			}
		}
	}

	protected GroovyScriptEngineImpl getScriptEngine(String siteId) {
		return scriptEngines.computeIfAbsent(siteId, this::createScriptEngine);
	}

	protected GroovyScriptEngineImpl createScriptEngine(String siteId) {
		logger.debug("Create a lifecycle Script Engine for site '{}'", siteId);
		GroovyScriptEngineImpl scriptEngine = (GroovyScriptEngineImpl) scriptEngineFactory.getEngineByName(GROOVY_ENGINE_NAME);
		GroovyClassLoader siteClassLoader = new GroovyClassLoader(sharedClassLoader, compilerConfig);
		siteClassLoader.addClasspath(getPluginClassFullPath(siteId));
		scriptEngine.setClassLoader(siteClassLoader);
		return scriptEngine;
	}

	@EventListener
	public void onSiteDeleting(SiteDeletingEvent event) {
		removeScriptEngine(event.getSiteId());
	}

	protected void removeScriptEngine(String siteId) {
		logger.debug("Remove the lifecycle Script Engine for site '{}'", siteId);
		GroovyScriptEngineImpl removed = scriptEngines.remove(siteId);
		if (removed != null) {
			// Close the site child only; keep the shared parent classpath loader
			GroovyClassLoaderUtils.closeQuietly(removed.getClassLoader(), sharedClassLoader);
		}
	}

	/**
	 * Get plugin Groovy classes full path for a given site
	 *
	 * @param siteId the site identifier
	 * @return the plugin Groovy classes full path
	 */
	private String getPluginClassFullPath(String siteId) {
		Path repoRootPath = gitRepositoryHelper.buildRepoPath(SANDBOX, siteId);
		return repoRootPath.resolve(StringUtils.removeStart(pluginClassPath, FILE_SEPARATOR)).toAbsolutePath().toString();
	}
}
