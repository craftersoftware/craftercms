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
package org.craftercms.studio.impl.v2.scripting;

import java.beans.ConstructorProperties;
import java.io.File;
import java.net.MalformedURLException;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLStreamHandler;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.codehaus.groovy.control.CompilerConfiguration;
import org.craftercms.core.service.ContentStoreService;
import org.craftercms.engine.util.url.ContentStoreUrlConnection;
import org.craftercms.studio.api.v2.core.ContextManager;
import org.craftercms.studio.api.v2.event.site.SiteDeletingEvent;
import org.craftercms.studio.api.v2.scripting.ScriptEngineManager;
import org.craftercms.studio.impl.v2.utils.GroovyClassLoaderUtils;
import org.jenkinsci.plugins.scriptsecurity.sandbox.groovy.RejectASTTransformsCustomizer;
import org.kohsuke.groovy.sandbox.SandboxTransformer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;

import groovy.lang.GroovyClassLoader;
import groovy.lang.GroovyResourceLoader;
import groovy.util.GroovyScriptEngine;
import groovy.util.ResourceConnector;
import groovy.util.ResourceException;

/**
 * Default implementation of {@link ScriptEngineManager}
 *
 * @author joseross
 * @since 4.0
 */
public class ScriptEngineManagerImpl implements ScriptEngineManager {

	private static final Logger logger = LoggerFactory.getLogger(ScriptEngineManagerImpl.class);

	protected Map<String, GroovyScriptEngine> scriptEngines = new ConcurrentHashMap<>();

	protected ContextManager contextManager;

	protected ContentStoreService contentStoreService;

	protected boolean sandboxEnabled;

	protected String classesBasePath;

	protected String restBasePath;

	protected String scriptExtension;

	@ConstructorProperties({"contextManager", "contentStoreService", "sandboxEnabled", "classesBasePath",
		"restBasePath", "scriptExtension"})
	public ScriptEngineManagerImpl(ContextManager contextManager, ContentStoreService contentStoreService,
				       boolean sandboxEnabled, String classesBasePath, String restBasePath,
				       String scriptExtension) {
		this.contextManager = contextManager;
		this.contentStoreService = contentStoreService;
		this.sandboxEnabled = sandboxEnabled;
		this.classesBasePath = classesBasePath;
		this.restBasePath = restBasePath;
		this.scriptExtension = scriptExtension;
	}

	@Override
	public GroovyScriptEngine getScriptEngine(String siteId) {
		return scriptEngines.computeIfAbsent(siteId, this::createScriptEngine);
	}

	protected GroovyScriptEngine createScriptEngine(String siteId) {
		logger.debug("Create a Script Engine for site '{}'", siteId);
		var compilerConfig = new CompilerConfiguration();
		if (sandboxEnabled) {
			logger.debug("Enable the Groovy sandbox for site '{}'", siteId);
			compilerConfig.addCompilationCustomizers(new RejectASTTransformsCustomizer(), new SandboxTransformer());
		}

		var groovyClassloader = new GroovyClassLoader(getClass().getClassLoader(), compilerConfig);
		groovyClassloader.setResourceLoader(new StudioResourceLoader(siteId, classesBasePath, new StudioUrlStreamHandler(siteId)));

		return new GroovyScriptEngine(new StudioResourceConnector(siteId, restBasePath), groovyClassloader);
	}

	@Override
	public void reloadScriptEngine(String siteId) {
		logger.debug("Reload the Script Engine for site '{}'", siteId);
		scriptEngines.compute(siteId, (key, old) -> {
			GroovyScriptEngine fresh = createScriptEngine(siteId);
			if (old != null) {
				GroovyClassLoaderUtils.closeQuietly(old.getGroovyClassLoader());
			}
			return fresh;
		});
	}

	@EventListener
	public void onSiteDeleting(SiteDeletingEvent event) {
		logger.debug("Remove the Script Engine for site '{}'", event.getSiteId());
		GroovyScriptEngine removed = scriptEngines.remove(event.getSiteId());
		if (removed != null) {
			GroovyClassLoaderUtils.closeQuietly(removed.getGroovyClassLoader());
		}
	}

	// Internal classes used to load the scripts from the site

	protected class StudioUrlStreamHandler extends URLStreamHandler {

		private final String siteId;

		public StudioUrlStreamHandler(final String siteId) {
			this.siteId = siteId;
		}

		@Override
		protected URLConnection openConnection(URL url) {
			var context = contextManager.getContext(siteId);
			return new ContentStoreUrlConnection(url, contentStoreService.getContent(context, url.getFile()));
		}

	}

	protected class StudioResourceConnector implements ResourceConnector {

		private final String siteId;
		private final String basePath;

		public StudioResourceConnector(final String siteId, final String basePath) {
			this.siteId = siteId;
			this.basePath = basePath;
		}

		@Override
		public URLConnection getResourceConnection(String name) throws ResourceException {
			try {
				var context = contextManager.getContext(siteId);
				var path = basePath + "/" + name;
				return new ContentStoreUrlConnection(new File(path).toURI().toURL(),
					contentStoreService.getContent(context, path));
			} catch (Exception e) {
				throw new ResourceException(e);
			}
		}
	}

	protected class StudioResourceLoader implements GroovyResourceLoader {

		private final String siteId;
		private final String basePath;
		private final URLStreamHandler urlStreamHandler;

		public StudioResourceLoader(final String siteId, final String basePath, final URLStreamHandler urlStreamHandler) {
			this.siteId = siteId;
			this.basePath = basePath;
			this.urlStreamHandler = urlStreamHandler;
		}

		@Override
		public URL loadGroovySource(String filename) throws MalformedURLException {
			if (filename.contains(".")) {
				filename = filename.replace('.', '/');
			}
			if (!filename.endsWith(scriptExtension)) {
				filename += "." + scriptExtension;
			}

			var context = contextManager.getContext(siteId);
			var path = basePath + "/" + filename;
			if (contentStoreService.exists(context, path)) {
				return new URL(null, "site:" + path, urlStreamHandler);
			} else {
				return null;
			}
		}

	}

}
