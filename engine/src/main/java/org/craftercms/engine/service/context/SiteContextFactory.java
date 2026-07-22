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

import java.io.File;
import java.io.InputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLClassLoader;
import java.util.ArrayList;
import static java.util.Collections.singletonList;
import java.util.HashMap;
import java.util.List;
import java.util.ListIterator;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executor;
import static java.util.stream.Collectors.toList;
import java.util.stream.Stream;

import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.craftercms.commons.config.ConfigurationException;
import org.craftercms.commons.config.EncryptionAwareConfigurationReader;
import org.craftercms.commons.config.PublishingTargetResolver;
import static org.craftercms.commons.locale.LocaleUtils.CONFIG_KEY_DEFAULT_LOCALE;
import org.craftercms.commons.spring.ApacheCommonsConfiguration2PropertySource;
import org.craftercms.commons.spring.context.RestrictedApplicationContext;
import org.craftercms.commons.spring.groovy.SandboxInterceptorFactory;
import org.craftercms.core.service.ContentStoreService;
import org.craftercms.core.service.Context;
import org.craftercms.core.url.UrlTransformationEngine;
import org.craftercms.core.util.cache.CacheTemplate;
import org.craftercms.engine.cache.SiteCacheWarmer;
import org.craftercms.engine.exception.SiteContextCreationException;
import org.craftercms.engine.graphql.GraphQLFactory;
import org.craftercms.engine.macro.MacroResolver;
import org.craftercms.engine.scripting.ScriptFactory;
import org.craftercms.engine.scripting.ScriptJobResolver;
import org.craftercms.engine.scripting.impl.GroovyScriptFactory;
import static org.craftercms.engine.util.GroovyScriptUtils.getCompilerConfiguration;
import org.craftercms.engine.util.SchedulingUtils;
import org.craftercms.engine.util.config.SiteAwarePublishingTargetResolver;
import org.craftercms.engine.util.groovy.ContentStoreGroovyResourceLoader;
import org.craftercms.engine.util.groovy.ContentStoreResourceConnector;
import org.craftercms.engine.util.groovy.Dom4jExtension;
import org.craftercms.engine.util.quartz.JobContext;
import org.craftercms.engine.util.spring.ContentStoreResourceLoader;
import org.craftercms.engine.util.spring.servlet.i18n.ChainLocaleResolver;
import org.quartz.Scheduler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.ObjectFactory;
import org.springframework.beans.factory.xml.XmlBeanDefinitionReader;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.core.env.MutablePropertySources;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.web.context.ServletContextAware;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.view.freemarker.FreeMarkerConfig;
import org.tuckey.web.filters.urlrewrite.Conf;
import org.tuckey.web.filters.urlrewrite.UrlRewriter;

import groovy.lang.GroovyClassLoader;
import jakarta.servlet.ServletContext;

/**
 * Factory for creating {@link SiteContext} with common properties. It also uses the {@link MacroResolver} to resolve
 * any macros specified in the {@code rootFolderPath} before creating the context (remember that macros can vary
 * between requests).
 *
 * @author Alfonso Vásquez
 */
@SuppressWarnings("rawtypes")
public class SiteContextFactory implements ApplicationContextAware, ServletContextAware {

	public static final String DEFAULT_SITE_NAME_MACRO_NAME = "siteName";
	public static final String SITE_NAME_CONFIG_VARIABLE = "siteName";
	public static final String SITE_ID_CONFIG_VARIABLE = "siteId";

	public static final long DEFAULT_INIT_TIMEOUT = 300000L;
	public static final String CONFIG_BEAN_NAME = "siteConfig";
	public static final long DEFAULT_SHUTDOWN_TIMEOUT = 5;
	public static final String DEFAULT_PUBLISHING_TARGET_MACRO_NAME = "publishingTarget";
	public static final String CONFIG_KEY_ALLOWED_TEMPLATE_PATHS = "templates.allowed";

	private static final Logger logger = LoggerFactory.getLogger(SiteContextFactory.class);

	protected ServletContext servletContext;
	protected String siteNameMacroName;
	protected String storeType;
	protected String rootFolderPath;
	protected String staticAssetsPath;
	protected String templatesPath;
	protected String initScriptPath;
	protected String restScriptsPath;
	protected String controllerScriptsPath;
	protected String[] configPaths;
	protected String[] applicationContextPaths;
	protected String[] urlRewriteConfPaths;
	protected String[] proxyConfigPaths;
	protected String[] translationConfigPaths;
	protected String groovyClassesPath;
	protected Map<String, Object> groovyGlobalVars;
	protected boolean mergingOn;
	protected boolean cacheOn;
	protected int maxAllowedItemsInCache;
	protected boolean ignoreHiddenFiles;
	protected ObjectFactory<FreeMarkerConfig> freeMarkerConfigFactory;
	protected UrlTransformationEngine urlTransformationEngine;
	protected ContentStoreService storeService;
	protected CacheTemplate cacheTemplate;
	protected MacroResolver macroResolver;
	protected ApplicationContext globalApplicationContext;
	protected List<ScriptJobResolver> jobResolvers;
	protected Executor jobThreadPoolExecutor;
	protected GraphQLFactory graphQLFactory;
	protected boolean cacheWarmUpEnabled;
	protected SiteCacheWarmer cacheWarmer;
	protected long initTimeout;
	protected EncryptionAwareConfigurationReader configurationReader;
	protected boolean disableVariableRestrictions;
	protected String[] defaultPublicBeans;
	protected long shutdownTimeout;
	protected PublishingTargetResolver publishingTargetResolver;
	protected String publishingTargetMacroName;
	protected boolean enableScriptSandbox;
	protected boolean enableSandboxBlacklist;
	protected String sandboxBlacklist;
	protected boolean enableSandboxWhitelist;
	protected String sandboxWhitelist;
	protected boolean enableExpressions;
	protected boolean enableTranslation;
	protected String[] whitelistGetEnvRegex;

	public SiteContextFactory(String storeType, String rootFolderPath, String staticAssetsPath, String templatesPath,
							  String initScriptPath, String restScriptsPath, final String controllerScriptsPath,
							  String[] configPaths, String[] applicationContextPaths, String[] urlRewriteConfPaths,
							  String[] proxyConfigPaths, String groovyClassesPath, Map<String, Object> groovyGlobalVars,
							  ObjectFactory<FreeMarkerConfig> freeMarkerConfigFactory, UrlTransformationEngine urlTransformationEngine,
							  ContentStoreService storeService, CacheTemplate cacheTemplate, MacroResolver macroResolver,
							  List<ScriptJobResolver> jobResolvers, Executor jobThreadPoolExecutor, GraphQLFactory graphQLFactory,
							  boolean cacheWarmUpEnabled, SiteCacheWarmer cacheWarmer, EncryptionAwareConfigurationReader configurationReader,
							  String[] whitelistGetEnvRegex) {
		siteNameMacroName = DEFAULT_SITE_NAME_MACRO_NAME;
		mergingOn = Context.DEFAULT_MERGING_ON;
		cacheOn = Context.DEFAULT_CACHE_ON;
		maxAllowedItemsInCache = Context.DEFAULT_MAX_ALLOWED_ITEMS_IN_CACHE;
		ignoreHiddenFiles = Context.DEFAULT_IGNORE_HIDDEN_FILES;
		initTimeout = DEFAULT_INIT_TIMEOUT;
		defaultPublicBeans = new String[0];
		shutdownTimeout = DEFAULT_SHUTDOWN_TIMEOUT;
		publishingTargetMacroName = DEFAULT_PUBLISHING_TARGET_MACRO_NAME;

		this.storeType = storeType;
		this.rootFolderPath = rootFolderPath;
		this.staticAssetsPath = staticAssetsPath;
		this.templatesPath = templatesPath;
		this.initScriptPath = initScriptPath;
		this.restScriptsPath = restScriptsPath;
		this.controllerScriptsPath = controllerScriptsPath;
		this.configPaths = configPaths;
		this.applicationContextPaths = applicationContextPaths;
		this.urlRewriteConfPaths = urlRewriteConfPaths;
		this.proxyConfigPaths = proxyConfigPaths;
		this.groovyClassesPath = groovyClassesPath;
		this.groovyGlobalVars = groovyGlobalVars;
		this.freeMarkerConfigFactory = freeMarkerConfigFactory;
		this.urlTransformationEngine = urlTransformationEngine;
		this.storeService = storeService;
		this.cacheTemplate = cacheTemplate;
		this.macroResolver = macroResolver;
		this.jobResolvers = jobResolvers;
		this.jobThreadPoolExecutor = jobThreadPoolExecutor;
		this.graphQLFactory = graphQLFactory;
		this.cacheWarmUpEnabled = cacheWarmUpEnabled;
		this.cacheWarmer = cacheWarmer;
		this.configurationReader = configurationReader;
		this.whitelistGetEnvRegex = whitelistGetEnvRegex;
	}

	@Override
	public void setServletContext(ServletContext servletContext) {
		this.servletContext = servletContext;
	}

	public void setSiteNameMacroName(String siteNameMacroName) {
		this.siteNameMacroName = siteNameMacroName;
	}

	public void setTranslationConfigPaths(String[] translationConfigPaths) {
		this.translationConfigPaths = translationConfigPaths;
	}

	public void setMergingOn(boolean mergingOn) {
		this.mergingOn = mergingOn;
	}

	public void setCacheOn(boolean cacheOn) {
		this.cacheOn = cacheOn;
	}

	public void setMaxAllowedItemsInCache(int maxAllowedItemsInCache) {
		this.maxAllowedItemsInCache = maxAllowedItemsInCache;
	}

	public void setIgnoreHiddenFiles(boolean ignoreHiddenFiles) {
		this.ignoreHiddenFiles = ignoreHiddenFiles;
	}

	public void setInitTimeout(final long initTimeout) {
		this.initTimeout = initTimeout;
	}

	public void setDisableVariableRestrictions(boolean disableVariableRestrictions) {
		this.disableVariableRestrictions = disableVariableRestrictions;
	}

	public void setDefaultPublicBeans(String[] defaultPublicBeans) {
		this.defaultPublicBeans = defaultPublicBeans;
	}

	public void setShutdownTimeout(long shutdownTimeout) {
		this.shutdownTimeout = shutdownTimeout;
	}

	public void setPublishingTargetResolver(PublishingTargetResolver publishingTargetResolver) {
		this.publishingTargetResolver = publishingTargetResolver;
	}

	public void setEnableScriptSandbox(boolean enableScriptSandbox) {
		this.enableScriptSandbox = enableScriptSandbox;
	}

	public void setEnableSandboxBlacklist(boolean enableSandboxBlacklist) {
		this.enableSandboxBlacklist = enableSandboxBlacklist;
	}

	public void setSandboxBlacklist(String sandboxBlacklist) {
		this.sandboxBlacklist = sandboxBlacklist;
	}

	public void setEnableSandboxWhitelist(boolean enableSandboxWhitelist) {
		this.enableSandboxWhitelist = enableSandboxWhitelist;
	}

	public void setSandboxWhitelist(String sandboxWhitelist) {
		this.sandboxWhitelist = sandboxWhitelist;
	}

	public void setEnableExpressions(boolean enableExpressions) {
		this.enableExpressions = enableExpressions;
	}

	public void setEnableTranslation(boolean enableTranslation) {
		this.enableTranslation = enableTranslation;
	}

	@Override
	public void setApplicationContext(ApplicationContext applicationContext) throws BeansException {
		this.globalApplicationContext = applicationContext;
	}

	public SiteContext createContext(String siteName) {
		Map<String, String> macroValues = new HashMap<>();
		macroValues.put(siteNameMacroName, siteName);

		if (publishingTargetResolver instanceof SiteAwarePublishingTargetResolver) {
			String target = ((SiteAwarePublishingTargetResolver) publishingTargetResolver).getPublishingTarget(siteName);
			macroValues.put(publishingTargetMacroName, target);
		}

		String resolvedRootFolderPath = macroResolver.resolveMacros(rootFolderPath, macroValues);
		Map<String, String> configVariables = new HashMap<>();
		configVariables.put(SITE_NAME_CONFIG_VARIABLE, siteName);
		configVariables.put(SITE_ID_CONFIG_VARIABLE, siteName);
		Context context = storeService.getContext(UUID.randomUUID().toString(), storeType, resolvedRootFolderPath,
				mergingOn, cacheOn, maxAllowedItemsInCache, ignoreHiddenFiles,
				configVariables);

		SiteContext siteContext = null;
		try {
			siteContext = new SiteContext();
			siteContext.setInitTimeout(initTimeout);
			siteContext.setStoreService(storeService);
			siteContext.setCacheTemplate(cacheTemplate);
			siteContext.setSiteName(siteName);
			siteContext.setContext(context);
			siteContext.setStaticAssetsPath(staticAssetsPath);
			siteContext.setTemplatesPath(templatesPath);
			siteContext.setInitScriptPath(initScriptPath);
			siteContext.setFreeMarkerConfig(freeMarkerConfigFactory.getObject());
			siteContext.setUrlTransformationEngine(urlTransformationEngine);
			siteContext.setRestScriptsPath(restScriptsPath);
			siteContext.setControllerScriptsPath(controllerScriptsPath);
			siteContext.setGraphQLFactory(graphQLFactory);
			siteContext.setShutdownTimeout(shutdownTimeout);

			if (disableVariableRestrictions) {
				siteContext.setServletContext(servletContext);
			}

			if (cacheWarmUpEnabled) {
				siteContext.setCacheWarmer(cacheWarmer);
			}

			String[] resolvedConfigPaths = new String[configPaths.length];
			for (int i = 0; i < configPaths.length; i++) {
				resolvedConfigPaths[i] = macroResolver.resolveMacros(configPaths[i], macroValues);
			}

			String[] resolvedAppContextPaths = new String[applicationContextPaths.length];
			for (int i = 0; i < applicationContextPaths.length; i++) {
				resolvedAppContextPaths[i] = macroResolver.resolveMacros(applicationContextPaths[i], macroValues);
			}

			String[] resolvedUrlRewriteConfPaths = new String[urlRewriteConfPaths.length];
			for (int i = 0; i < urlRewriteConfPaths.length; i++) {
				resolvedUrlRewriteConfPaths[i] = macroResolver.resolveMacros(urlRewriteConfPaths[i], macroValues);
			}

			List<String> resolvedProxyConfPaths = Stream.of(proxyConfigPaths)
				.map(path -> macroResolver.resolveMacros(path, macroValues))
				.collect(toList());

			List<String> resolvedTranslationConfPaths = Stream.of(translationConfigPaths)
				.map(path -> macroResolver.resolveMacros(path, macroValues))
				.collect(toList());

			ResourceLoader resourceLoader = new ContentStoreResourceLoader(siteContext);
			HierarchicalConfiguration<?> config = getConfig(siteContext, resolvedConfigPaths, resourceLoader);

			configureScriptSandbox(siteContext, resourceLoader);
			URLClassLoader classLoader = getClassLoader(siteContext);
			siteContext.setClassLoader(classLoader);
			ScriptFactory scriptFactory = getScriptFactory(siteContext, classLoader);
			siteContext.setScriptFactory(scriptFactory);
			ConfigurableApplicationContext appContext = getApplicationContext(siteContext, classLoader, config,
				resolvedAppContextPaths, resourceLoader);
			siteContext.setApplicationContext(appContext);
			UrlRewriter urlRewriter = getUrlRewriter(siteContext, resolvedUrlRewriteConfPaths, resourceLoader);
			HierarchicalConfiguration proxyConfig = getProxyConfig(siteContext, resolvedProxyConfPaths, resourceLoader);
			HierarchicalConfiguration translationConfig =
				getTranslationConfig(siteContext, resolvedTranslationConfPaths, resourceLoader);

			siteContext.setConfig(config);
			siteContext.setGlobalApplicationContext(globalApplicationContext);
			siteContext.setUrlRewriter(urlRewriter);
			siteContext.setProxyConfig(proxyConfig);
			siteContext.setTranslationConfig(translationConfig);
			siteContext.setLocaleResolver(buildLocaleResolver(translationConfig));
			if (config != null) {
				siteContext.setAllowedTemplatePaths(config.getStringArray(CONFIG_KEY_ALLOWED_TEMPLATE_PATHS));
			}

			Scheduler scheduler = scheduleJobs(siteContext);
			siteContext.setScheduler(scheduler);

			return siteContext;
		} catch (Exception e) {
			logger.error("Error creating context for site '" + siteName + "'", e);

			try {
				// Release any Groovy class loaders / app context created before the failure
				if (siteContext != null) {
					try {
						siteContext.destroy();
					} catch (Exception destroyEx) {
						logger.error("Error destroying partially created site context for site '{}'", siteName, destroyEx);
						storeService.destroyContext(context);
					}
				} else {
					storeService.destroyContext(context);
				}
			} catch (Exception destroyEx) {
				logger.error("Error destroying partially created site context for site '" + siteName + "'", e);
				e.addSuppressed(destroyEx);
			}
			throw e;
		}
	}

	/**
	 * Resolve root folder path
	 *
	 * @param siteName site name
	 * @return the root folder absolute path
	 */
	public String resolveRootFolderPath(String siteName) throws URISyntaxException {
		Map<String, String> macroValues = new HashMap<>();
		macroValues.put(siteNameMacroName, siteName);

		if (publishingTargetResolver instanceof SiteAwarePublishingTargetResolver) {
			String target = ((SiteAwarePublishingTargetResolver) publishingTargetResolver).getPublishingTarget(siteName);
			macroValues.put(publishingTargetMacroName, target);
		}

		String resolvedRootFolderPath = macroResolver.resolveMacros(rootFolderPath, macroValues);

		return new File(new URI(resolvedRootFolderPath)).getAbsolutePath();
	}

	protected HierarchicalConfiguration getConfig(SiteContext siteContext, String[] configPaths,
						      ResourceLoader resourceLoader) {
		String siteName = siteContext.getSiteName();

		logger.info("--------------------------------------------------");
		logger.info("<Loading configuration for site: " + siteName + ">");
		logger.info("--------------------------------------------------");

		try {
			for (int i = configPaths.length - 1; i >= 0; i--) {
				Resource config = resourceLoader.getResource(configPaths[i]);
				if (config.exists()) {
					return configurationReader.readXmlConfiguration(config, siteContext.getContext().getConfigLookupVariables());
				}
			}
			return null;
		} catch (ConfigurationException e) {
			throw new SiteContextCreationException("Unable to load configuration for site '" + siteName + "'", e);
		} finally {
			logger.info("--------------------------------------------------");
			logger.info("</Loading configuration for site: " + siteName + ">");
			logger.info("--------------------------------------------------");
		}
	}

	/**
	 * Configure script sandbox for the given site context
	 * If sandbox is enabled, it will set the sandbox interceptor in the site context
	 *
	 * @param siteContext    the site context to configure
	 * @param resourceLoader the resource loader to use to load the whitelist/blacklist resources
	 */
	protected void configureScriptSandbox(SiteContext siteContext, ResourceLoader resourceLoader) {
		try {
			if (enableScriptSandbox) {
				Resource whitelistResource = enableSandboxWhitelist ? resourceLoader.getResource(sandboxWhitelist) : null;
				Resource blacklistResource = enableSandboxBlacklist ? resourceLoader.getResource(sandboxBlacklist) : null;
				SandboxInterceptorFactory sandboxInterceptorFactory = new SandboxInterceptorFactory(enableScriptSandbox, enableSandboxBlacklist, blacklistResource,
						enableSandboxWhitelist, whitelistResource, whitelistGetEnvRegex, singletonList(Dom4jExtension.class));
				sandboxInterceptorFactory.afterPropertiesSet();
				siteContext.scriptSandbox = sandboxInterceptorFactory.getObject();
			}
		} catch (Exception e) {
			throw new SiteContextCreationException("Unable to load sandbox whitelist for site '" +
					siteContext.getSiteName() + "'", e);
		}
	}

	protected URLClassLoader getClassLoader(SiteContext siteContext) {
		GroovyClassLoader classLoader =
				new GroovyClassLoader(getClass().getClassLoader(), getCompilerConfiguration(enableScriptSandbox));
		ContentStoreGroovyResourceLoader resourceLoader = new ContentStoreGroovyResourceLoader(siteContext,
				groovyClassesPath);

		classLoader.setResourceLoader(resourceLoader);

		return classLoader;
	}

	protected ConfigurableApplicationContext getApplicationContext(SiteContext siteContext, URLClassLoader classLoader,
																   HierarchicalConfiguration config,
																   String[] applicationContextPaths,
																   ResourceLoader resourceLoader) {
		String siteName = siteContext.getSiteName();

		logger.info("--------------------------------------------------");
		logger.info("<Loading application context for site: " + siteName + ">");
		logger.info("--------------------------------------------------");

		try {
			Resource appContextResource = null;

			for (int i = applicationContextPaths.length - 1; i >= 0; i--) {
				Resource resource = resourceLoader.getResource(applicationContextPaths[i]);
				if (resource.exists()) {
					appContextResource = resource;
					break;
				}
			}

			if (appContextResource != null) {
				GenericApplicationContext appContext;
				if (disableVariableRestrictions) {
					appContext = new GenericApplicationContext(globalApplicationContext);
				} else {
					appContext = new RestrictedApplicationContext(globalApplicationContext, defaultPublicBeans);
				}
				appContext.setClassLoader(classLoader);

				if (!enableExpressions) {
					appContext.addBeanFactoryPostProcessor(factory -> factory.setBeanExpressionResolver(null));
				}

				if (config != null) {
					MutablePropertySources propertySources = appContext.getEnvironment().getPropertySources();
					propertySources.addFirst(new ApacheCommonsConfiguration2PropertySource(CONFIG_BEAN_NAME, config));
					appContext.getBeanFactory().registerSingleton(CONFIG_BEAN_NAME, config);
				}

				XmlBeanDefinitionReader reader = new XmlBeanDefinitionReader(appContext);
				reader.setValidationMode(XmlBeanDefinitionReader.VALIDATION_XSD);

				reader.loadBeanDefinitions(appContextResource);

				appContext.refresh();

				return appContext;
			} else {
				return null;
			}
		} catch (Exception e) {
			throw new SiteContextCreationException("Unable to load application context for site '" + siteName + "'", e);
		} finally {
			logger.info("--------------------------------------------------");
			logger.info("</Loading application context for site: " + siteName + ">");
			logger.info("--------------------------------------------------");
		}
	}

	protected UrlRewriter getUrlRewriter(SiteContext siteContext, String[] urlRewriteConfPaths,
										 ResourceLoader resourceLoader) {
		String siteName = siteContext.getSiteName();
		String confPath = null;
		Resource confResource = null;
		Conf conf = null;
		UrlRewriter urlRewriter = null;

		logger.info("--------------------------------------------------");
		logger.info("<Loading URL rewrite engine for site: " + siteName + ">");
		logger.info("--------------------------------------------------");

		try {
			for (int i = urlRewriteConfPaths.length - 1; i >= 0; i--) {
				Resource resource = resourceLoader.getResource(urlRewriteConfPaths[i]);
				if (resource.exists()) {
					confPath = urlRewriteConfPaths[i];
					confResource = resource;
					break;
				}
			}

			if (confResource != null) {
				// By convention, if it ends in .xml, it's an XML-style url rewrite config, else it's a mod_rewrite-style
				// url rewrite config
				boolean modRewriteStyleConf = !confPath.endsWith(".xml");

				try (InputStream is = confResource.getInputStream()) {
					conf = new Conf(servletContext, is, confPath, "", modRewriteStyleConf);

					logger.info("URL rewrite configuration loaded @ " + confResource);
				}
			}

			if (conf != null) {
				if (conf.isOk() && conf.isEngineEnabled()) {
					urlRewriter = new UrlRewriter(conf);

					logger.info("URL rewrite engine loaded for site " + siteName + " (conf ok)");
				} else {
					logger.error("URL rewrite engine not loaded, there might have been conf errors");
				}
			}

			return urlRewriter;
		} catch (Exception e) {
			throw new SiteContextCreationException("Unable to load URL rewrite conf for site '" + siteName + "'", e);
		} finally {
			logger.info("--------------------------------------------------");
			logger.info("</Loading URL rewrite engine for site: " + siteName + ">");
			logger.info("--------------------------------------------------");
		}
	}

	protected HierarchicalConfiguration getProxyConfig(SiteContext siteContext, List<String> configPaths,
													   ResourceLoader resourceLoader) {
		String siteName = siteContext.getSiteName();

		logger.info("-------------------------------------------------------");
		logger.info("<Loading proxy configuration for site: " + siteName + ">");
		logger.info("-------------------------------------------------------");

		try {
			ListIterator<String> iterator = configPaths.listIterator(configPaths.size());
			while (iterator.hasPrevious()) {
				Resource resource = resourceLoader.getResource(iterator.previous());
				if (resource.exists()) {
					return configurationReader.readXmlConfiguration(resource, siteContext.getContext().getConfigLookupVariables());
				}
			}
			return null;
		} catch (ConfigurationException e) {
			throw new SiteContextCreationException("Unable to load proxy configuration for site '" + siteName + "'", e);
		} finally {
			logger.info("---------------------------------------------------------");
			logger.info("</Loading proxy configuration for site: " + siteName + ">");
			logger.info("---------------------------------------------------------");
		}
	}

	protected HierarchicalConfiguration getTranslationConfig(SiteContext siteContext, List<String> configPaths,
															 ResourceLoader resourceLoader) {
		String siteName = siteContext.getSiteName();

		logger.info("-------------------------------------------------------");
		logger.info("<Loading translation configuration for site: " + siteName + ">");
		logger.info("-------------------------------------------------------");

		try {
			ListIterator<String> iterator = configPaths.listIterator(configPaths.size());
			while (iterator.hasPrevious()) {
				Resource resource = resourceLoader.getResource(iterator.previous());
				if (resource.exists()) {
					return configurationReader.readXmlConfiguration(resource, siteContext.getContext().getConfigLookupVariables());
				}
			}
			return null;
		} catch (ConfigurationException e) {
			throw new SiteContextCreationException("Unable to load translation configuration for site '" + siteName +
					"'", e);
		} finally {
			logger.info("---------------------------------------------------------");
			logger.info("</Loading translation configuration for site: " + siteName + ">");
			logger.info("---------------------------------------------------------");
		}
	}

	protected LocaleResolver buildLocaleResolver(HierarchicalConfiguration<?> configuration) {
		if (enableTranslation && configuration != null && configuration.containsKey(CONFIG_KEY_DEFAULT_LOCALE)) {
			return new ChainLocaleResolver(globalApplicationContext, configuration);
		}
		return null;
	}

	protected ScriptFactory getScriptFactory(SiteContext siteContext, URLClassLoader classLoader) {
		return new GroovyScriptFactory(siteContext, new ContentStoreResourceConnector(siteContext), classLoader,
				groovyGlobalVars, enableScriptSandbox);
	}

	protected Scheduler scheduleJobs(SiteContext siteContext) {
		String siteName = siteContext.getSiteName();

		logger.info("--------------------------------------------------");
		logger.info("<Scheduling job scripts for site: " + siteName + ">");
		logger.info("--------------------------------------------------");

		try {
			List<JobContext> allJobContexts = new ArrayList<>();

			for (ScriptJobResolver jobResolver : jobResolvers) {
				List<JobContext> jobContexts = jobResolver.resolveJobs(siteContext);
				if (CollectionUtils.isNotEmpty(jobContexts)) {
					allJobContexts.addAll(jobContexts);
				}
			}

			if (CollectionUtils.isNotEmpty(allJobContexts)) {
				Scheduler scheduler = SchedulingUtils.createScheduler(
						String.format("%s_%s_scheduler", siteName, siteContext.getContext().getId()),
						jobThreadPoolExecutor);

				for (JobContext jobContext : allJobContexts) {
					scheduler.scheduleJob(jobContext.getDetail(), jobContext.getTrigger());

					logger.info("Scheduled job: " + jobContext + " for site '" + siteName + "'");
				}

				scheduler.start();

				return scheduler;
			}
		} catch (Exception e) {
			logger.error("Unable to schedule jobs for site '" + siteName + "'", e);
		} finally {
			logger.info("--------------------------------------------------");
			logger.info("</Scheduling job scripts for site: " + siteName + ">");
			logger.info("--------------------------------------------------");
		}

		return null;
	}

}
