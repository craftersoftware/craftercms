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

package org.craftercms.studio.impl.v2.service.dependency.internal;

import org.apache.commons.collections4.CollectionUtils;
import org.craftercms.studio.api.v1.constant.DmConstants;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.service.GeneralLockService;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v1.service.dependency.DependencyResolver;
import org.craftercms.studio.api.v1.service.dependency.DependencyResolver.ResolvedDependency;
import org.craftercms.studio.api.v2.annotation.logging.LogExecutionTime;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteExists;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.dal.Dependency;
import org.craftercms.studio.api.v2.dal.DependencyDAO;
import org.craftercms.studio.api.v2.dal.RetryingDatabaseOperationFacade;
import org.craftercms.studio.api.v2.dal.item.LightItem;
import org.craftercms.studio.api.v2.service.dependency.DependencyService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Path;
import java.util.*;

import static java.lang.String.format;
import static java.util.Collections.emptyList;
import static org.apache.commons.collections4.CollectionUtils.isEmpty;
import static org.apache.commons.collections4.CollectionUtils.isNotEmpty;
import static org.apache.commons.lang3.Strings.CS;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_DEPENDENCY_ITEM_SPECIFIC_PATTERNS;
import static org.craftercms.studio.api.v2.utils.StudioUtils.matchesPatterns;
import static org.craftercms.studio.impl.v2.utils.DependencyUtils.isValidDependencyPath;

public class DependencyServiceInternalImpl implements DependencyService {

	private static final Logger logger = LoggerFactory.getLogger(DependencyServiceInternalImpl.class);
	private static final String UPSERT_DEPENDENCIES_LOCK = ":upsertDependencies";

	private StudioConfiguration studioConfiguration;
	private DependencyDAO dependencyDao;
	private DependencyResolver dependencyResolver;
	private ServicesConfig servicesConfig;
	private GeneralLockService generalLockService;
	private RetryingDatabaseOperationFacade retryingDatabaseOperationFacade;

	@Override
	@LogExecutionTime
	public Collection<LightItem> getSoftDependencies(String site, Set<String> paths) {
		logger.trace("Get all soft dependencies for site '{}' paths '{}'", site, paths);
		return dependencyDao.getSoftDependenciesForList(site, paths, getItemSpecificDependenciesPatterns());
	}

	@Override
	@LogExecutionTime
	public Collection<LightItem> getPublishingSoftDependencies(final String site, final Set<String> paths, String target) {
		logger.trace("Get all publishing soft dependencies for site '{}' paths '{}'", site, paths);
		if (isEmpty(paths)) {
			return emptyList();
		}
		return dependencyDao.getPublishingSoftDependenciesForList(site, paths, getItemSpecificDependenciesPatterns(),
			target);
	}

	protected List<String> getItemSpecificDependenciesPatterns() {
		StringTokenizer st = new StringTokenizer(
			studioConfiguration.getProperty(CONFIGURATION_DEPENDENCY_ITEM_SPECIFIC_PATTERNS), ",");
		List<String> itemSpecificDependenciesPatterns = new ArrayList<>(st.countTokens());
		while (st.hasMoreTokens()) {
			itemSpecificDependenciesPatterns.add(st.nextToken().trim());
		}
		return itemSpecificDependenciesPatterns;
	}

	@Override
	@RequireSiteExists
	public Collection<LightItem> getHardDependencies(@SiteId String site, String publishingTarget, Collection<String> paths) throws SiteNotFoundException {
		if (isEmpty(paths)) {
			return emptyList();
		}
		boolean isLiveTarget = CS.equals(servicesConfig.getLiveEnvironment(site), publishingTarget);
		return dependencyDao.getHardDependenciesForList(site, publishingTarget, paths,
			getItemSpecificDependenciesPatterns(), isLiveTarget);
	}

	@Override
	public Collection<LightItem> getHardDependencies(String site, Collection<String> paths) throws SiteNotFoundException {
		String liveTarget = servicesConfig.getLiveEnvironment(site);
		// Default to live target for backwards compatibility
		return getHardDependencies(site, liveTarget, paths);
	}

	@Override
	public Collection<LightItem> getDependentPaths(String siteId, List<String> paths) {
		if (CollectionUtils.isEmpty(paths)) {
			return new ArrayList<>();
		}
		return dependencyDao.getDependentItems(siteId, paths);
	}

	@Override
	public Collection<LightItem> getDependentItems(String siteId, String path) {
		return dependencyDao.getDependentItems(siteId, List.of(path));
	}

	@Override
	public List<LightItem> getItemSpecificDependencies(String siteId, Collection<String> paths) {
		if (isNotEmpty(paths)) {
			// TODO: consider making this recursive
			return dependencyDao.getItemSpecificDependencies(siteId, paths, getItemSpecificDependenciesPatterns());
		}
		return new ArrayList<>();
	}

	@Override
	public Collection<LightItem> getDependencies(String siteId, String path) {
		return dependencyDao.getDependencies(siteId, path);
	}

	@Override
	public Collection<String> getDependencyPaths(String siteId, String path) {
		return dependencyDao.getDependencyPaths(siteId, path);
	}

	@Override
	@LogExecutionTime
	public Map<String, Set<ResolvedDependency>> resolveDependencies(String siteId, String path) throws SiteNotFoundException {
		Map<String, Set<ResolvedDependency>> dependencies = null;
		if (isValidDependencySource(siteId, path)) {
			dependencies = dependencyResolver.resolve(siteId, path);
		}
		return dependencies;
	}

	@Override
	@Transactional
	public void upsertDependencies(String site, String path) throws ServiceLayerException {
		Map<String, Set<ResolvedDependency>> resolveDependencies = dependencyResolver.resolve(site, path);
		List<Dependency> dependencies = new LinkedList<>();
		for (Map.Entry<String, Set<ResolvedDependency>> entry : resolveDependencies.entrySet()) {
			dependencies.addAll(
				entry.getValue().stream()
					.filter(dep -> isValidDependencyPath(dep.path()))
					.map(dep -> {
						Dependency dependency = new Dependency();
						dependency.setSite(site);
						// Remove multiple slashes
						dependency.setSourcePath(Path.of(path).toString());
						dependency.setTargetPath(Path.of(dep.path()).toString());
						dependency.setType(entry.getKey());
						dependency.setValid(dep.valid());
						return dependency;
					}).toList());
		}
		String lock = site + UPSERT_DEPENDENCIES_LOCK;
		generalLockService.lock(lock);
		try {
			logger.debug("Upserting dependencies for site '{}' path '{}'", site, path);
			retryingDatabaseOperationFacade.retry(() -> dependencyDao.deleteItemDependencies(site, path));
			if (isNotEmpty(dependencies)) {
				retryingDatabaseOperationFacade.retry(() -> dependencyDao.insertItemDependencies(dependencies));
			}
		} catch (Exception e) {
			logger.error("Failed to upsert dependencies for site '{}' path '{}'", site, path, e);
			throw new ServiceLayerException(format("Failed to upsert dependencies for site '%s' path '%s'",
				site, path), e);
		} finally {
			generalLockService.unlock(lock);
		}
	}

	@Override
	public void deleteItemDependencies(String site, String sourcePath) throws ServiceLayerException {
		try {
			retryingDatabaseOperationFacade.retry(() -> dependencyDao.deleteItemDependencies(site, sourcePath));
		} catch (Exception e) {
			logger.error("Failed to delete dependencies for site '{}' path '{}'", site, sourcePath, e);
			throw new ServiceLayerException(format("Failed to delete dependencies for site '%s' path '%s'",
				site, sourcePath), e);
		}
	}

	@Override
	public void invalidateDependencies(String siteId, String targetPath) throws ServiceLayerException {
		try {
			retryingDatabaseOperationFacade.retry(() -> dependencyDao.invalidateDependencies(siteId, targetPath));
		} catch (Exception e) {
			logger.error("Failed to invalidate dependencies for site '{}' path '{}'", siteId, targetPath, e);
			throw new ServiceLayerException(format("Failed to invalidate dependencies for site '%s' path '%s'",
				siteId, targetPath), e);
		}
	}

	@Override
	public void validateDependencies(String siteId, String targetPath) throws ServiceLayerException {
		try {
			retryingDatabaseOperationFacade.retry(() -> dependencyDao.validateDependencies(siteId, targetPath));
		} catch (Exception e) {
			logger.error("Failed to validate dependencies for site '{}' path '{}'", siteId, targetPath, e);
			throw new ServiceLayerException(format("Failed to validate dependencies for site '%s' path '%s'",
				siteId, targetPath), e);
		}
	}

	@Override
	public boolean isValidDependencySource(final String siteId, final String path) throws SiteNotFoundException {
		boolean isXml = path.endsWith(DmConstants.XML_PATTERN);
		boolean isCss = path.endsWith(DmConstants.CSS_PATTERN);
		boolean isJs = path.endsWith(DmConstants.JS_PATTERN);
		boolean isTemplate = matchesPatterns(path, servicesConfig.getRenderingTemplatePatterns(siteId));

		return isXml || isCss || isJs || isTemplate;
	}

	@Override
	public void updateDependenciesOnTreeDelete(final String siteId, final String path) {
		retryingDatabaseOperationFacade.retry(() -> dependencyDao.updateDependenciesOnTreeDelete(siteId, path));
	}

	@Override
	public void validateDependenciesForTree(String siteId, String path) {
		retryingDatabaseOperationFacade.retry(() -> dependencyDao.validateDependenciesForTree(siteId, path));
	}

	public void setStudioConfiguration(StudioConfiguration studioConfiguration) {
		this.studioConfiguration = studioConfiguration;
	}

	@SuppressWarnings("unused")
	public void setDependencyDao(DependencyDAO dependencyDao) {
		this.dependencyDao = dependencyDao;
	}

	@SuppressWarnings("unused")
	public void setDependencyResolver(DependencyResolver dependencyResolver) {
		this.dependencyResolver = dependencyResolver;
	}

	public void setServicesConfig(ServicesConfig servicesConfig) {
		this.servicesConfig = servicesConfig;
	}

	public void setGeneralLockService(GeneralLockService generalLockService) {
		this.generalLockService = generalLockService;
	}

	public void setRetryingDatabaseOperationFacade(RetryingDatabaseOperationFacade retryingDatabaseOperationFacade) {
		this.retryingDatabaseOperationFacade = retryingDatabaseOperationFacade;
	}
}
