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
package org.craftercms.engine.service.context;

import java.net.URLClassLoader;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;

import static org.apache.commons.collections4.CollectionUtils.isNotEmpty;
import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.lang3.time.StopWatch;
import org.craftercms.commons.http.RequestContext;
import org.craftercms.commons.lang.Callback;
import static org.craftercms.commons.locale.LocaleUtils.CONFIG_KEY_DEFAULT_LOCALE;
import static org.craftercms.commons.locale.LocaleUtils.CONFIG_KEY_SUPPORTED_LOCALES;
import org.craftercms.core.exception.CrafterException;
import org.craftercms.core.service.ContentStoreService;
import org.craftercms.core.service.Context;
import org.craftercms.core.url.UrlTransformationEngine;
import org.craftercms.core.util.cache.CacheTemplate;
import org.craftercms.engine.cache.SiteCacheWarmer;
import org.craftercms.engine.event.CacheClearedEvent;
import org.craftercms.engine.event.GraphQLBuiltEvent;
import org.craftercms.engine.event.SiteContextCreatedEvent;
import org.craftercms.engine.event.SiteContextDestroyedEvent;
import org.craftercms.engine.event.SiteContextInitializedEvent;
import org.craftercms.engine.event.SiteEvent;
import org.craftercms.engine.exception.GraphQLBuildException;
import org.craftercms.engine.exception.SiteContextInitializationException;
import org.craftercms.engine.graphql.GraphQLFactory;
import org.craftercms.engine.scripting.ScriptFactory;
import org.craftercms.engine.util.GroovyScriptUtils;
import org.jenkinsci.plugins.scriptsecurity.sandbox.groovy.SandboxInterceptor;
import org.quartz.Scheduler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.view.freemarker.FreeMarkerConfig;
import org.tuckey.web.filters.urlrewrite.UrlRewriter;

import graphql.GraphQL;
import jakarta.servlet.ServletContext;

/**
 * Wrapper for a {@link Context} that adds properties specific to Crafter
 * Engine.
 *
 * @author Alfonso Vásquez
 */
@SuppressWarnings("rawtypes")
public class SiteContext {

	private static final Logger logger = LoggerFactory.getLogger(SiteContext.class);

	private static final String SITE_NAME_MDC_KEY = "siteName";

	private static ThreadLocal<SiteContext> threadLocal = new ThreadLocal<>();

	public enum State {
		INITIALIZING,
		READY,
		DESTROYED
	}

	protected ContentStoreService storeService;
	protected CacheTemplate cacheTemplate;
	protected String siteName;
	protected Context context;
	protected boolean fallback;
	protected String staticAssetsPath;
	protected String templatesPath;
	protected String[] allowedTemplatePaths;
	protected String restScriptsPath;
	protected String controllerScriptsPath;
	protected String initScriptPath;
	protected FreeMarkerConfig freeMarkerConfig;
	protected UrlTransformationEngine urlTransformationEngine;
	protected ScriptFactory scriptFactory;
	protected HierarchicalConfiguration config;
	protected ApplicationContext globalApplicationContext;
	protected ConfigurableApplicationContext applicationContext;
	protected URLClassLoader classLoader;
	protected UrlRewriter urlRewriter;
	protected Scheduler scheduler;
	protected GraphQLFactory graphQLFactory;
	protected SiteCacheWarmer cacheWarmer;
	protected HierarchicalConfiguration proxyConfig;
	protected HierarchicalConfiguration translationConfig;
	protected LocaleResolver localeResolver;

	protected long initTimeout;
	protected CountDownLatch initializationLatch;
	protected ExecutorService maintenanceTaskExecutor;
	protected GraphQL graphQL;
	protected State state;

	private ServletContext servletContext;

	private long shutdownTimeout;
	private final ReadWriteLock readWriteLock = new ReentrantReadWriteLock();
	private final Lock accessLock = readWriteLock.readLock();
	private final Lock shutdownLock = readWriteLock.writeLock();

	protected SandboxInterceptor scriptSandbox;

	/**
	 * Returns the context for the current thread.
	 */
	public static SiteContext getCurrent() {
		return threadLocal.get();
	}

	/**
	 * Returns the item from the cache of the current site context. If there's no
	 * current site context, the loader
	 * is called directly to get the item.
	 *
	 * @param loader      the loader used to retrieve the item if it's not in cache
	 * @param keyElements the elements that conform the key
	 *
	 * @return the cached item
	 */
	public static <T> T getFromCurrentCache(Callback<T> loader, Object... keyElements) {
		SiteContext siteContext = getCurrent();
		if (siteContext != null) {
			return siteContext.getFromCache(loader, keyElements);
		} else {
			return loader.execute();
		}
	}

	/**
	 * Sets the context for the current thread.
	 */
	public static void setCurrent(SiteContext siteContext) {
		SiteContext current = threadLocal.get();
		if (current != null) {
			logger.debug("Overwriting previous site context {}", current);
			release(current);
		}

		logger.debug("Getting access lock for {}", siteContext);
		siteContext.accessLock.lock();

		try {
			if (siteContext.scriptSandbox != null) {
				siteContext.scriptSandbox.register();
			}

			threadLocal.set(siteContext);

			MDC.put(SITE_NAME_MDC_KEY, siteContext.getSiteName());
		} catch (RuntimeException | Error e) {
			siteContext.accessLock.unlock();
			throw e;
		}
	}

	/**
	 * Removes the context from the current thread.
	 */
	public static void clear() {
		MDC.remove(SITE_NAME_MDC_KEY);

		SiteContext current = threadLocal.get();

		if (current == null) {
			logger.debug("Current site context was already cleared");
			return;
		}

		release(current);

		threadLocal.remove();
	}

	protected static void release(SiteContext siteContext) {
		if (siteContext.scriptSandbox != null) {
			siteContext.scriptSandbox.unregister();
		}

		logger.debug("Releasing access lock for {}", siteContext);
		siteContext.accessLock.unlock();
	}

	public SiteContext() {
		// With this executor maintenance tasks are executed sequentially in the order
		// they're received. This is
		// important when a cache warm is submitted and a GraphQL re-build needs to wait
		// till the cache warm is
		// finished
		maintenanceTaskExecutor = createMaintenanceTaskExecutor();
		state = State.INITIALIZING;
		initializationLatch = new CountDownLatch(1);
	}

	private ExecutorService createMaintenanceTaskExecutor() {
		ThreadFactory threadFactory = runnable -> {
			Thread thread = Executors.defaultThreadFactory().newThread(runnable);
			thread.setName("site-context-maintenance-" + thread.threadId());
			return thread;
		};

		return new ThreadPoolExecutor(1, 1, 0L, TimeUnit.MILLISECONDS, new LinkedBlockingQueue<>(), threadFactory) {
			@Override
			protected void beforeExecute(Thread t, Runnable r) {
				clearSpringThreadContexts();
				super.beforeExecute(t, r);
			}

			@Override
			protected void afterExecute(Runnable r, Throwable t) {
				try {
					super.afterExecute(r, t);

					// Log errors from execute() tasks directly. For submit() tasks, the caller is
					// responsible
					// for calling future.get() and handling the exception, so we don't log here to
					// avoid duplicates.
					if (t != null) {
						logger.error("Error running maintenance task for site '{}'", siteName, t);
					}
				} finally {
					clearSpringThreadContexts();
				}
			}
		};
	}

	private void clearSpringThreadContexts() {
		RequestContextHolder.resetRequestAttributes();
		LocaleContextHolder.resetLocaleContext();
	}

	public ContentStoreService getStoreService() {
		return storeService;
	}

	public void setStoreService(ContentStoreService storeService) {
		this.storeService = storeService;
	}

	public CacheTemplate getCacheTemplate() {
		return cacheTemplate;
	}

	public void setCacheTemplate(CacheTemplate cacheTemplate) {
		this.cacheTemplate = cacheTemplate;
	}

	public String getSiteName() {
		return siteName;
	}

	public void setSiteName(String siteName) {
		this.siteName = siteName;
	}

	public Context getContext() {
		return context;
	}

	public void setContext(Context context) {
		this.context = context;
	}

	public boolean isFallback() {
		return fallback;
	}

	public void setFallback(boolean fallback) {
		this.fallback = fallback;
	}

	public String getStaticAssetsPath() {
		return staticAssetsPath;
	}

	public void setStaticAssetsPath(String staticAssetsPath) {
		this.staticAssetsPath = staticAssetsPath;
	}

	public String getTemplatesPath() {
		return templatesPath;
	}

	public void setTemplatesPath(String templatesPath) {
		this.templatesPath = templatesPath;
	}

	public String[] getAllowedTemplatePaths() {
		return allowedTemplatePaths;
	}

	public void setAllowedTemplatePaths(String[] allowedTemplatePaths) {
		this.allowedTemplatePaths = allowedTemplatePaths;
	}

	public String getRestScriptsPath() {
		return restScriptsPath;
	}

	public void setRestScriptsPath(String restScriptsPath) {
		this.restScriptsPath = restScriptsPath;
	}

	public String getControllerScriptsPath() {
		return controllerScriptsPath;
	}

	public void setControllerScriptsPath(String controllerScriptsPath) {
		this.controllerScriptsPath = controllerScriptsPath;
	}

	public String getInitScriptPath() {
		return initScriptPath;
	}

	public void setInitScriptPath(String initScriptPath) {
		this.initScriptPath = initScriptPath;
	}

	public FreeMarkerConfig getFreeMarkerConfig() {
		return freeMarkerConfig;
	}

	public void setFreeMarkerConfig(FreeMarkerConfig freeMarkerConfig) {
		this.freeMarkerConfig = freeMarkerConfig;
	}

	public UrlTransformationEngine getUrlTransformationEngine() {
		return urlTransformationEngine;
	}

	public void setUrlTransformationEngine(UrlTransformationEngine urlTransformationEngine) {
		this.urlTransformationEngine = urlTransformationEngine;
	}

	public ScriptFactory getScriptFactory() {
		return scriptFactory;
	}

	public void setScriptFactory(ScriptFactory scriptFactory) {
		this.scriptFactory = scriptFactory;
	}

	public HierarchicalConfiguration getConfig() {
		return config;
	}

	public void setConfig(HierarchicalConfiguration config) {
		this.config = config;
	}

	public void setServletContext(ServletContext servletContext) {
		this.servletContext = servletContext;
	}

	public ApplicationContext getGlobalApplicationContext() {
		return globalApplicationContext;
	}

	public void setGlobalApplicationContext(ApplicationContext globalApplicationContext) {
		this.globalApplicationContext = globalApplicationContext;
	}

	public ConfigurableApplicationContext getApplicationContext() {
		return applicationContext;
	}

	public void setApplicationContext(ConfigurableApplicationContext applicationContext) {
		this.applicationContext = applicationContext;
	}

	public URLClassLoader getClassLoader() {
		return classLoader;
	}

	public void setClassLoader(URLClassLoader classLoader) {
		this.classLoader = classLoader;
	}

	public UrlRewriter getUrlRewriter() {
		return urlRewriter;
	}

	public void setUrlRewriter(UrlRewriter urlRewriter) {
		this.urlRewriter = urlRewriter;
	}

	public Scheduler getScheduler() {
		return scheduler;
	}

	public void setScheduler(Scheduler scheduler) {
		this.scheduler = scheduler;
	}

	public GraphQLFactory getGraphQLFactory() {
		return graphQLFactory;
	}

	public void setGraphQLFactory(GraphQLFactory graphQLFactory) {
		this.graphQLFactory = graphQLFactory;
	}

	public SiteCacheWarmer getCacheWarmer() {
		return cacheWarmer;
	}

	public void setCacheWarmer(SiteCacheWarmer cacheWarmer) {
		this.cacheWarmer = cacheWarmer;
	}

	public void setInitTimeout(final long initTimeout) {
		this.initTimeout = initTimeout;
	}

	public void setShutdownTimeout(long shutdownTimeout) {
		this.shutdownTimeout = shutdownTimeout;
	}

	public GraphQL getGraphQL() {
		return graphQL;
	}

	public HierarchicalConfiguration getProxyConfig() {
		return proxyConfig;
	}

	public void setProxyConfig(HierarchicalConfiguration proxyConfig) {
		this.proxyConfig = proxyConfig;
	}

	public HierarchicalConfiguration getTranslationConfig() {
		return translationConfig;
	}

	public void setTranslationConfig(HierarchicalConfiguration translationConfig) {
		this.translationConfig = translationConfig;
	}

	public boolean isTranslationEnabled() {
		return translationConfig != null &&
				translationConfig.containsKey(CONFIG_KEY_DEFAULT_LOCALE) &&
				isNotEmpty(translationConfig.configurationsAt(CONFIG_KEY_SUPPORTED_LOCALES));
	}

	public LocaleResolver getLocaleResolver() {
		return localeResolver;
	}

	public void setLocaleResolver(LocaleResolver localeResolver) {
		this.localeResolver = localeResolver;
	}

	public boolean isValid() throws CrafterException {
		try {
			if (state == State.INITIALIZING) {
				logger.debug("Waiting for initialization of {}", this);
				initializationLatch.await(initTimeout, TimeUnit.MILLISECONDS);
			}
			return state == State.READY && storeService.validate(context);
		} catch (InterruptedException e) {
			throw new CrafterException("Error while waiting for initialization of " + this);
		}
	}

	public State getState() {
		return state;
	}

	public void init(boolean waitTillFinished) throws SiteContextInitializationException {
		if (state == State.INITIALIZING) {
			publishEvent(new SiteContextCreatedEvent(this));

			Runnable initTask = () -> {
				SiteContext.setCurrent(this);
				try {
					logger.info("--------------------------------------------------");
					logger.info("<Initializing site context: " + siteName + ">");
					logger.info("--------------------------------------------------");

					if (cacheWarmer != null) {
						cacheWarmer.warmUpCache(this, false);
					}

					buildGraphQLSchema();
					executeInitScript();

					state = State.READY;

					logger.info("--------------------------------------------------");
					logger.info("</Initializing site context: " + siteName + ">");
					logger.info("--------------------------------------------------");

					publishEvent(new SiteContextInitializedEvent(this));
				} catch (Exception e) {
					// to avoid a deadlock during destroy()
					SiteContext.clear();
					// If there is any exception during the init process then release the resources
					// created so far
					this.destroy();
					throw e;
				} finally {
					initializationLatch.countDown();
					SiteContext.clear();
				}
			};

			if (waitTillFinished) {
				// Done through the executor so that maintenance tasks submitted while init are
				// queued
				Future<?> future = maintenanceTaskExecutor.submit(initTask);
				try {
					future.get();
				} catch (InterruptedException | ExecutionException e) {
					throw new SiteContextInitializationException("Error while waiting for context init", e);
				}
			} else {
				maintenanceTaskExecutor.execute(initTask);
			}
		}
	}

	public void startCacheClear() {
		startCacheClear(null);
	}

	public void startCacheClear(Runnable callback) {
		maintenanceTaskExecutor.execute(() -> {
			SiteContext.setCurrent(this);
			try {
				cacheClear();
				if (callback != null) {
					callback.run();
				}
			} finally {
				SiteContext.clear();
			}
		});
	}

	public void startGraphQLSchemaBuild() throws GraphQLBuildException {
		startGraphQLSchemaBuild(null);
	}

	public void startGraphQLSchemaBuild(Runnable callback) throws GraphQLBuildException {
		maintenanceTaskExecutor.execute(() -> {
			SiteContext.setCurrent(this);
			try {
				buildGraphQLSchema();
				if (callback != null) {
					callback.run();
				}
			} finally {
				SiteContext.clear();
			}
		});
	}

	public void destroy() throws CrafterException {
		boolean locked;
		try {
			logger.debug("Getting shutdown lock for {}", this);
			locked = shutdownLock.tryLock(shutdownTimeout, TimeUnit.MINUTES);
			try {
				if (!locked) {
					logger.debug("Time out reached, proceeding to destroy {}", this);
				} else {
					logger.debug("All threads released, proceeding to destroy {}", this);
				}

				state = State.DESTROYED;

				try {
					publishEvent(new SiteContextDestroyedEvent(this));
				} catch (Exception e) {
					logger.error("Error while publishing SiteContextDestroyedEvent for {}", this, e);
				}

				try {
					maintenanceTaskExecutor.shutdownNow();
				} catch (Exception e) {
					logger.error("Error while shutting down maintenance task executor for {}", this, e);
				}

				if (scheduler != null) {
					try {
						scheduler.shutdown();
					} catch (Exception e) {
						logger.error("Error while shutting scheduler for {}", this, e);
					}
				}
				if (applicationContext != null) {
					try {
						applicationContext.close();
					} catch (Exception e) {
						logger.error("Error while closing application context for {}", this, e);
					}
				}                // Close the GroovyScriptEngine's ScriptClassLoader (child) before the parent site class loader
				if (scriptFactory != null) {
					try {
						scriptFactory.destroy();
					} catch (Exception e) {
						logger.error("Error while destroying script factory for {}", this, e);
					} finally {
						scriptFactory = null;
					}
				}
				if (classLoader != null) {
					try {
						classLoader.close();
					} catch (Exception e) {
						logger.error("Error while closing class loader for {}", this, e);
					} finally {
						classLoader = null;
					}
				}

				try {
					storeService.destroyContext(context);
				} catch (Exception e) {
					logger.error("Error while destroying core context for {}", this, e);
				}
			} finally {
				if (locked) {
					logger.debug("Releasing shutdown lock for {}", this);
					shutdownLock.unlock();
				}
			}
		} catch (InterruptedException e) {
			throw new CrafterException("Interrupted while trying to destroy " + this, e);
		}
	}

	public <T> T getFromCache(Callback<T> loader, Object... keyElements) {
		return cacheTemplate.getObject(context, loader, keyElements);
	}

	protected void cacheClear() {
		// If there's a cache warmer, do a content cache switch instead of aclear
		if (cacheWarmer != null) {
			cacheWarmer.warmUpCache(this, true);
			// Clear Freemarker cache
			freeMarkerConfig.getConfiguration().clearTemplateCache();
		} else {
			cacheTemplate.getCacheService().clearScope(context);
			// Clear Freemarker cache
			freeMarkerConfig.getConfiguration().clearTemplateCache();
		}

		publishEvent(new CacheClearedEvent(this));
	}

	protected void buildGraphQLSchema() {
		logger.info("Starting GraphQL schema build for site '{}'", siteName);

		StopWatch stopWatch = new StopWatch();
		stopWatch.start();

		try {
			GraphQL graphQL = graphQLFactory.getInstance(this);
			if (Objects.nonNull(graphQL)) {
				this.graphQL = graphQL;

				publishEvent(new GraphQLBuiltEvent(this));
			}
		} catch (Exception e) {
			logger.error("Error building the GraphQL schema for site '" + siteName + "'", e);
		}

		stopWatch.stop();

		logger.info("GraphQL schema build completed for site '{}' in {} secs", siteName,
				stopWatch.getTime(TimeUnit.SECONDS));
	}

	protected void executeInitScript() {
		if (storeService.exists(context, initScriptPath)) {
			try {
				Map<String, Object> variables = new HashMap<>();
				GroovyScriptUtils.addJobScriptVariables(variables, servletContext);

				logger.info("Executing init script for site '{}'", siteName);

				scriptFactory.getScript(initScriptPath).execute(variables);
			} catch (Exception e) {
				logger.error("Error executing init script for site '" + siteName + "'", e);
			}
		}
	}

	protected void publishEvent(SiteEvent event) {
		if (applicationContext != null) {
			applicationContext.publishEvent(event);
		} else {
			globalApplicationContext.publishEvent(event);
		}

		// Store a request attribute for the event so it's known later if the event was
		// fired during the request
		RequestContext requestContext = RequestContext.getCurrent();
		if (requestContext != null) {
			requestContext.getRequest().setAttribute(event.getClass().getName(), event);
		}
	}

	@Override
	public boolean equals(Object o) {
		if (this == o) {
			return true;
		}
		if (o == null || getClass() != o.getClass()) {
			return false;
		}

		SiteContext siteContext = (SiteContext) o;

		if (!siteName.equals(siteContext.siteName)) {
			return false;
		}

		return true;
	}

	@Override
	public int hashCode() {
		return siteName.hashCode();
	}

	@Override
	public String toString() {
		return "SiteContext{" +
				"siteName='" + siteName + '\'' +
				", context=" + context +
				", fallback=" + fallback +
				", staticAssetsPath='" + staticAssetsPath + '\'' +
				", templatesPath='" + templatesPath + '\'' +
				", restScriptsPath='" + restScriptsPath + '\'' +
				", controllerScriptsPath='" + controllerScriptsPath + '\'' +
				'}';
	}

}
