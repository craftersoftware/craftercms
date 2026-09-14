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

package org.craftercms.studio.impl.v2.service.security.internal;

import java.beans.ConstructorProperties;
import static java.lang.String.format;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.Collections;
import static java.util.Collections.emptyList;
import static java.util.Collections.singletonMap;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.StringTokenizer;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import static java.util.stream.Collectors.toMap;

import org.apache.commons.collections4.CollectionUtils;
import static org.apache.commons.collections4.CollectionUtils.isNotEmpty;
import org.apache.commons.collections4.MapUtils;
import static org.apache.commons.collections4.MapUtils.isNotEmpty;
import org.apache.commons.lang3.StringUtils;
import static org.apache.commons.lang3.StringUtils.defaultIfBlank;
import static org.apache.commons.lang3.StringUtils.joinWith;
import static org.apache.commons.lang3.Strings.CS;
import org.craftercms.commons.crypto.CryptoException;
import org.craftercms.commons.crypto.CryptoUtils;
import org.craftercms.commons.crypto.TextEncryptor;
import org.craftercms.commons.entitlements.exception.EntitlementException;
import org.craftercms.commons.entitlements.model.EntitlementType;
import org.craftercms.commons.entitlements.validator.EntitlementValidator;
import static org.craftercms.studio.api.v1.constant.StudioConstants.SYSTEM_ADMIN_NORMALIZED_ROLE;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.exception.security.PasswordDoesNotMatchException;
import org.craftercms.studio.api.v1.exception.security.UserAlreadyExistsException;
import org.craftercms.studio.api.v1.exception.security.UserExternallyManagedException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v2.dal.AuditLog;
import static org.craftercms.studio.api.v2.dal.AuditLog.createAuditLogEntry;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_CREATE;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_DISABLE;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_ENABLE;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_UPDATE;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.TARGET_TYPE_USER;
import org.craftercms.studio.api.v2.dal.AuditLogParameter;
import org.craftercms.studio.api.v2.dal.Group;
import static org.craftercms.studio.api.v2.dal.QueryParameterNames.EMAIL;
import static org.craftercms.studio.api.v2.dal.QueryParameterNames.ENABLED;
import static org.craftercms.studio.api.v2.dal.QueryParameterNames.EXTERNALLY_MANAGED;
import static org.craftercms.studio.api.v2.dal.QueryParameterNames.FIRST_NAME;
import static org.craftercms.studio.api.v2.dal.QueryParameterNames.ID;
import static org.craftercms.studio.api.v2.dal.QueryParameterNames.LAST_NAME;
import static org.craftercms.studio.api.v2.dal.QueryParameterNames.LOCALE;
import static org.craftercms.studio.api.v2.dal.QueryParameterNames.PASSWORD;
import static org.craftercms.studio.api.v2.dal.QueryParameterNames.TIMEZONE;
import static org.craftercms.studio.api.v2.dal.QueryParameterNames.USERNAME;
import static org.craftercms.studio.api.v2.dal.QueryParameterNames.USER_ID;
import static org.craftercms.studio.api.v2.dal.QueryParameterNames.USER_IDS;
import org.craftercms.studio.api.v2.dal.RetryingDatabaseOperationFacade;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.dal.User;
import org.craftercms.studio.api.v2.dal.UserDAO;
import org.craftercms.studio.api.v2.dal.UserProperty;
import org.craftercms.studio.api.v2.dal.security.NormalizedGroup;
import org.craftercms.studio.api.v2.dal.security.NormalizedRole;
import org.craftercms.studio.api.v2.event.user.DisabledUserEvent;
import org.craftercms.studio.api.v2.event.user.UserUpdatedEvent;
import org.craftercms.studio.api.v2.exception.PasswordRequirementsFailedException;
import org.craftercms.studio.api.v2.exception.security.ActionsDeniedException;
import org.craftercms.studio.api.v2.service.audit.AuditService;
import org.craftercms.studio.api.v2.service.config.ConfigurationService;
import org.craftercms.studio.api.v2.service.security.UserService;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.craftercms.studio.api.v2.service.system.InstanceService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_GLOBAL_SYSTEM_SITE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.SECURITY_CIPHER_SALT;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.SECURITY_FORGOT_PASSWORD_TOKEN_TIMEOUT;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.SECURITY_PASSWORD_REQUIREMENTS_MINIMUM_COMPLEXITY;
import static org.craftercms.studio.impl.v1.repository.git.GitContentRepositoryConstants.GIT_REPO_USER_USERNAME;
import org.craftercms.studio.api.v2.security.PermissionMappingsProvider;
import org.craftercms.studio.impl.v2.security.password.ForgotPasswordTaskFactory;
import org.craftercms.studio.impl.v2.utils.security.SecurityUtils;
import static org.craftercms.studio.impl.v2.utils.security.SecurityUtils.getAuthentication;
import static org.craftercms.studio.impl.v2.utils.security.SecurityUtils.getCurrentUser;
import static org.craftercms.studio.impl.v2.utils.security.SecurityUtils.getCurrentUsername;
import org.craftercms.studio.model.AuthenticatedUser;
import org.craftercms.studio.model.rest.UserResponse;
import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.ApplicationEventPublisherAware;
import org.springframework.context.annotation.Lazy;
import org.springframework.core.task.TaskExecutor;

import com.google.common.cache.Cache;
import com.nulabinc.zxcvbn.Strength;
import com.nulabinc.zxcvbn.Zxcvbn;

public class UserServiceInternalImpl implements UserService, ApplicationEventPublisherAware {

	private static final Logger logger = LoggerFactory.getLogger(UserServiceInternalImpl.class);
	private static final String TOKEN_DELIMITER = "|";

	private final UserDAO userDao;
	private ConfigurationService configurationService;
	private final StudioConfiguration studioConfiguration;
	private SitesService siteService;
	private final RetryingDatabaseOperationFacade retryingDatabaseOperationFacade;
	private final Cache<String, User> userCache;
	private final Zxcvbn zxcvbn;
	private final AuditService auditService;
	private final EntitlementValidator entitlementValidator;
	private final TaskExecutor taskExecutor;
	private final ObjectFactory<ForgotPasswordTaskFactory> forgotPasswordTaskFactory;
	private final TextEncryptor encryptor;
	private final InstanceService instanceService;
	private PermissionMappingsProvider permissionMappingsProvider;

	private ApplicationEventPublisher eventPublisher;

	@ConstructorProperties({"userDao", "studioConfiguration",
			"retryingDatabaseOperationFacade", "userCache", "zxcvbn",
			"auditService", "entitlementValidator", "taskExecutor", "forgotPasswordTaskFactory",
			"encryptor", "instanceService"})
	public UserServiceInternalImpl(UserDAO userDao,
								   StudioConfiguration studioConfiguration,
								   RetryingDatabaseOperationFacade retryingDatabaseOperationFacade,
								   Cache<String, User> userCache, Zxcvbn zxcvbn,
								   AuditService auditService, EntitlementValidator entitlementValidator,
								   TaskExecutor taskExecutor, ObjectFactory<ForgotPasswordTaskFactory> forgotPasswordTaskFactory,
								   TextEncryptor encryptor, InstanceService instanceService) {
		this.userDao = userDao;
		this.studioConfiguration = studioConfiguration;
		this.retryingDatabaseOperationFacade = retryingDatabaseOperationFacade;
		this.userCache = userCache;
		this.zxcvbn = zxcvbn;
		this.auditService = auditService;
		this.entitlementValidator = entitlementValidator;
		this.taskExecutor = taskExecutor;
		this.forgotPasswordTaskFactory = forgotPasswordTaskFactory;
		this.encryptor = encryptor;
		this.instanceService = instanceService;
	}

	protected void invalidateCache(String username) {
		userCache.invalidate(username);
	}

	protected void invalidateCache(List<String> usernames) {
		userCache.invalidateAll(usernames);
	}

	protected void invalidateCache(Collection<User> users) {
		invalidateCache(users.stream().map(User::getUsername).collect(Collectors.toList()));
	}

	@Override
	public boolean isSiteAdmin(String username, String siteId) throws ServiceLayerException, UserNotFoundException {
		return isSystemAdmin(username) || permissionMappingsProvider.getPermissionMappings(siteId).isSiteAdmin(username, getUserGroups(-1, username));
	}

	protected Set<String> getUserPermission(String siteId, String username)
			throws ExecutionException, ServiceLayerException, UserNotFoundException {
		return permissionMappingsProvider.getPermissionMappings(siteId).getUserPermissions(username, getUserGroups(-1, username), isSystemAdmin(username));
	}

	@Override
	public Set<String> getUserPermissions(String siteId, String path, String username) throws ServiceLayerException, UserNotFoundException {
		return permissionMappingsProvider.getPermissionMappings(siteId).getUserPermissions(username, getUserGroups(-1, username), path, isSystemAdmin(username));
	}

	@NonNull
	@Override
	public User getUserByIdOrUsername(long userId, String username)
			throws ServiceLayerException, UserNotFoundException {
		Map<String, Object> params = new HashMap<>();
		params.put(USER_ID, userId);
		params.put(USERNAME, username);
		User user;

		try {
			user = userDao.getUserByIdOrUsername(params);
		} catch (Exception e) {
			throw new ServiceLayerException("Unknown database error", e);
		}

		if (user == null) {
			throw new UserNotFoundException("No user found for username '" + username + "' or id '" + userId + "'");
		}

		return user;
	}

	@Override
	public List<User> getUsersByIdOrUsername(List<Long> userIds, List<String> usernames)
			throws ServiceLayerException, UserNotFoundException {
		List<User> users = new LinkedList<>();
		for (long userId : userIds) {
			users.add(getUserByIdOrUsername(userId, StringUtils.EMPTY));
		}
		for (String username : usernames) {
			if (username != null) {
				Optional<User> user = users.stream().filter(u -> u.getUsername().equals(username)).findFirst();
				if (user.isEmpty()) {
					users.add(getUserByIdOrUsername(-1, username));
				}
			}
		}

		return users;
	}

	@Override
	public Collection<User> getAllUsersForSite(String siteId, String keyword, int offset, int limit,
											   String sort, boolean showDisabled)
			throws ServiceLayerException {
		List<NormalizedGroup> groupNames = configurationService.getSiteGroups(siteId);
		try {
			return userDao.getAllUsersForSite(
					groupNames.stream()
							.map(NormalizedGroup::toString)
							.toList(), keyword, offset, limit, sort, showDisabled);
		} catch (Exception e) {
			throw new ServiceLayerException("Unknown database error", e);
		}
	}

	@Override
	public Collection<User> getAllUsers(String keyword, int offset, int limit, String sort, boolean showDisabled)
		throws ServiceLayerException {
		try {
			return userDao.getAllUsers(keyword, offset, limit, sort, showDisabled);
		} catch (Exception e) {
			throw new ServiceLayerException("Unknown database error", e);
		}
	}

	@Override
	public int getAllUsersForSiteTotal(String siteId, String keyword, boolean showDisabled)
		throws ServiceLayerException {
		List<NormalizedGroup> groupNames = configurationService.getSiteGroups(siteId);
		try {
			return userDao.getAllUsersForSiteTotal(
					groupNames.stream().map(NormalizedGroup::toString).toList(), keyword, showDisabled
			);
		} catch (Exception e) {
			throw new ServiceLayerException("Unknown database error", e);
		}
	}

	@Override
	public int getAllUsersTotal(String keyword, boolean showDisabled) throws ServiceLayerException {
		try {
			return userDao.getAllUsersTotal(keyword, showDisabled);
		} catch (Exception e) {
			throw new ServiceLayerException("Unknown database error", e);
		}
	}

	@Override
	public User createUser(User user) throws UserAlreadyExistsException, ServiceLayerException {
		try {
			entitlementValidator.validateEntitlement(EntitlementType.USER, 1);
		} catch (EntitlementException e) {
			throw new ServiceLayerException("Unable to complete request due to entitlement limits. Please contact " +
					"your system administrator.", e);
		}

		if (userExists(user.getUsername())) {
			throw new UserAlreadyExistsException(format("User '%s' already exists", user.getUsername()));
		}
		if (!user.isExternallyManaged() && !verifyPasswordRequirements(user.getPassword())) {
			throw new PasswordRequirementsFailedException();
		}
		Map<String, Object> params = new HashMap<>();
		params.put(USERNAME, user.getUsername());
		params.put(PASSWORD, CryptoUtils.hashPassword(user.getPassword()));
		params.put(FIRST_NAME, user.getFirstName());
		params.put(LAST_NAME, user.getLastName());
		params.put(EMAIL, user.getEmail());
		params.put(EXTERNALLY_MANAGED, user.getExternallyManagedAsInt());
		params.put(TIMEZONE, StringUtils.EMPTY);
		params.put(LOCALE, StringUtils.EMPTY);
		params.put(ENABLED, user.getEnabledAsInt());

		User result;
		try {
			retryingDatabaseOperationFacade.retry(() -> userDao.createUser(params));
			user.setId((Long) params.get(ID));
			result = user;
		} catch (Exception e) {
			throw new ServiceLayerException("Unknown database error", e);
		}

		Site site = siteService.getSite(studioConfiguration.getProperty(CONFIGURATION_GLOBAL_SYSTEM_SITE));
		AuditLog auditLog = createAuditLogEntry();
		auditLog.setOperation(OPERATION_CREATE);
		auditLog.setSiteId(site.getId());
		// No authenticated user happens during user login for externally managed users
		auditLog.setActorId(defaultIfBlank(getCurrentUsername(), user.getUsername()));
		auditLog.setPrimaryTargetId(user.getUsername());
		auditLog.setPrimaryTargetType(TARGET_TYPE_USER);
		auditLog.setPrimaryTargetValue(user.getUsername());
		auditService.insertAuditLog(auditLog);

		return result;
	}

	@Override
	public boolean userExists(String username) throws ServiceLayerException {
		return userExists(-1, username);
	}

	@Override
	public boolean userExists(long userId, String username) throws ServiceLayerException {
		Map<String, Object> params = new HashMap<>();
		params.put(USER_ID, userId);
		params.put(USERNAME, username);

		try {
			Integer result = userDao.userExists(params);
			return (result > 0);
		} catch (Exception e) {
			throw new ServiceLayerException("Unknown database error", e);
		}
	}

	@Override
	public void updateUser(User user) throws UserNotFoundException, ServiceLayerException, UserExternallyManagedException {
		long userId = user.getId();
		String username = user.getUsername() != null ? user.getUsername() : StringUtils.EMPTY;

		User oldUser = getUserByIdOrUsername(userId, username);

		Map<String, Object> params = new HashMap<>();
		params.put(USER_ID, oldUser.getId());
		params.put(FIRST_NAME, user.getFirstName());
		params.put(LAST_NAME, user.getLastName());
		params.put(EMAIL, user.getEmail());
		params.put(ENABLED, user.isEnabled());
		params.put(TIMEZONE, StringUtils.EMPTY);
		params.put(LOCALE, StringUtils.EMPTY);

		try {
			retryingDatabaseOperationFacade.retry(() -> userDao.updateUser(params));
			invalidateCache(oldUser.getUsername());
			if (oldUser.isEnabled() && !user.isEnabled()) {
				eventPublisher.publishEvent(new DisabledUserEvent(List.of(oldUser.getId())));
			} else {
				eventPublisher.publishEvent(new UserUpdatedEvent(oldUser.getId()));
			}
		} catch (Exception e) {
			throw new ServiceLayerException("Failed to update user", e);
		}

		User updatedUser = getUserByIdOrUsername(user.getId(), StringUtils.EMPTY);
		Site site = siteService.getSite(studioConfiguration.getProperty(CONFIGURATION_GLOBAL_SYSTEM_SITE));
		AuditLog auditLog = createAuditLogEntry();
		auditLog.setOperation(OPERATION_UPDATE);
		auditLog.setSiteId(site.getId());
		// No authenticated user happens during user login for externally managed users.
		auditLog.setActorId(defaultIfBlank(getCurrentUsername(), username));
		auditLog.setPrimaryTargetId(updatedUser.getUsername());
		auditLog.setPrimaryTargetType(TARGET_TYPE_USER);
		auditLog.setPrimaryTargetValue(updatedUser.getUsername());
		auditService.insertAuditLog(auditLog);
	}

	@Override
	public List<User> enableUsers(List<Long> userIds, List<String> usernames, boolean enabled)
			throws ServiceLayerException, UserNotFoundException {
		List<User> users = getUsersByIdOrUsername(userIds, usernames);

		Map<String, Object> params = new HashMap<>();
		params.put(USER_IDS, users.stream().map(User::getId).collect(Collectors.toList()));
		params.put(ENABLED, enabled ? 1 : 0);

		try {
			retryingDatabaseOperationFacade.retry(() -> userDao.enableUsers(params));
			invalidateCache(users);
		} catch (Exception e) {
			throw new ServiceLayerException("Unknown database error", e);
		}

		Site site = siteService.getSite(studioConfiguration.getProperty(CONFIGURATION_GLOBAL_SYSTEM_SITE));
		AuditLog auditLog = createAuditLogEntry();
		auditLog.setSiteId(site.getId());
		if (enabled) {
			auditLog.setOperation(OPERATION_ENABLE);
		} else {
			auditLog.setOperation(OPERATION_DISABLE);
		}
		auditLog.setActorId(getCurrentUsername());
		auditLog.setPrimaryTargetId(site.getSiteId());
		auditLog.setPrimaryTargetType(TARGET_TYPE_USER);
		auditLog.setPrimaryTargetValue(site.getName());
		List<AuditLogParameter> parameters = new ArrayList<>();
		for (User u : users) {
			AuditLogParameter parameter = new AuditLogParameter();
			parameter.setTargetId(Long.toString(u.getId()));
			parameter.setTargetType(TARGET_TYPE_USER);
			parameter.setTargetValue(u.getUsername());
			parameters.add(parameter);
		}
		auditLog.setParameters(parameters);
		auditService.insertAuditLog(auditLog);

		if (!enabled) {
			eventPublisher.publishEvent(new DisabledUserEvent(users.stream().map(User::getId).toList()));
		}

		return getUsersByIdOrUsername(userIds, usernames);
	}

	@Override
	public List<Group> getUserGroups(long userId, String username)
			throws UserNotFoundException, ServiceLayerException {
		return getUserGroups(userId, username, false);
	}

	@Override
	public List<Group> getUserGroups(long userId, String username, boolean filterExternallyManagedGroups) throws UserNotFoundException, ServiceLayerException {
		if (!userExists(userId, username)) {
			throw new UserNotFoundException("No user found for username '" + username + "' or id '" + userId + "'");
		}

		Map<String, Object> params = new HashMap<>();
		params.put(USER_ID, userId);
		params.put(USERNAME, username);
		if (filterExternallyManagedGroups) {
			params.put(EXTERNALLY_MANAGED, true);
		}

		try {
			return userDao.getUserGroups(params);
		} catch (Exception e) {
			throw new ServiceLayerException("Unknown database error", e);
		}
	}

	@Override
	public UserResponse changePassword(String username, String current, String newPassword)
			throws PasswordDoesNotMatchException, UserExternallyManagedException, ServiceLayerException, AuthenticationException, UserNotFoundException {
		AuthenticatedUser currentUser = getCurrentUser();
		if (currentUser == null || !CS.equals(username, currentUser.getUsername())) {
			throw new ActionsDeniedException("Cannot change password: current logged in user does not match provided username");
		}
		try {
			User user = getUserByIdOrUsername(-1, username);
			if (user.isExternallyManaged()) {
				throw new UserExternallyManagedException();
			}
			if (!CryptoUtils.matchPassword(user.getPassword(), current)) {
				throw new PasswordDoesNotMatchException();
			}
			if (!verifyPasswordRequirements(newPassword)) {
				throw new PasswordRequirementsFailedException();
			}
			String hashedPassword = CryptoUtils.hashPassword(newPassword);
			HashMap<String, Object> setPasswordParams = new HashMap<>();
			setPasswordParams.put(USERNAME, username);
			setPasswordParams.put(PASSWORD, hashedPassword);
			retryingDatabaseOperationFacade.retry(() -> userDao.setUserPassword(setPasswordParams));
			invalidateCache(username);

			user = getUserByIdOrUsername(-1, username);
			return new UserResponse(user);
		} catch (RuntimeException e) {
			throw new ServiceLayerException("Failed to change user password", e);
		}
	}

	@Override
	public boolean resetPassword(String username, String newPassword) throws UserNotFoundException,
			ServiceLayerException {
		if (!userExists(username)) {
			throw new UserNotFoundException();
		}
		if (!verifyPasswordRequirements(newPassword)) {
			throw new PasswordRequirementsFailedException("User password does not fulfill requirements");
		}
		Map<String, Object> params = new HashMap<>();
		params.put(USER_ID, -1);
		params.put(USERNAME, username);
		try {
			User user = userDao.getUserByIdOrUsername(params);
			if (user.isExternallyManaged()) {
				throw new UserExternallyManagedException();
			} else {
				String hashedPassword = CryptoUtils.hashPassword(newPassword);
				HashMap<String, Object> setPasswordParams = new HashMap<>();
				setPasswordParams.put(USERNAME, username);
				setPasswordParams.put(PASSWORD, hashedPassword);
				retryingDatabaseOperationFacade.retry(() -> userDao.setUserPassword(setPasswordParams));
				invalidateCache(username);
				return true;
			}
		} catch (Exception e) {
			throw new ServiceLayerException("Unknown database error", e);
		}
	}

	private boolean verifyPasswordRequirements(String password) {
		Strength strength = zxcvbn.measure(password);

		return strength.getScore() >= getPasswordRequirementMinimumComplexity();
	}

	private int getPasswordRequirementMinimumComplexity() {
		return Integer.parseInt(studioConfiguration.getProperty(SECURITY_PASSWORD_REQUIREMENTS_MINIMUM_COMPLEXITY));
	}

	@Override
	public User getUserByGitName(final String gitName) throws ServiceLayerException, UserNotFoundException {
		User user = userDao.getUserByGitName(gitName);
		if (Objects.isNull(user)) {
			logger.info("Git user '{}' was not found in the database", gitName);
			user = getUserByIdOrUsername(-1, GIT_REPO_USER_USERNAME);
		}
		return user;
	}

	protected Map<String, String> getUserProperties(User user, long siteId) {
		return userDao.getUserProperties(user.getId(), siteId).stream()
				.collect(toMap(UserProperty::getKey, UserProperty::getValue));
	}

	protected String getGlobalSiteName() {
		return studioConfiguration.getProperty(CONFIGURATION_GLOBAL_SYSTEM_SITE);
	}

	protected String getActualSiteId(String siteId) {
		return StringUtils.isEmpty(siteId) ? getGlobalSiteName() : siteId;
	}

	@Override
	public Map<String, Map<String, String>> getUserProperties(String siteId)
			throws ServiceLayerException {
		var actualSiteId = getActualSiteId(siteId);
		var dbSiteId = siteService.getSite(actualSiteId).getId();
		var username = SecurityUtils.getCurrentUsername();
		try {
			var user = getUserByIdOrUsername(0, username);
			// TODO: Properly support multiple sites when needed
			return singletonMap(siteId, getUserProperties(user, dbSiteId));
		} catch (UserNotFoundException e) {
			// This should never happen...
			logger.error("Failed to get the current user with username '{}' in site '{}'", username, siteId, e);
			return null;
		}
	}

	@Override
	public Map<String, String> updateUserProperties(String siteId, Map<String, String> propertiesToUpdate)
			throws ServiceLayerException {
		var actualSiteId = getActualSiteId(siteId);
		var dbSiteId = siteService.getSite(actualSiteId).getId();
		var username = SecurityUtils.getCurrentUsername();
		try {
			var user = getUserByIdOrUsername(0, username);
			retryingDatabaseOperationFacade.retry(() -> userDao.updateUserProperties(user.getId(), dbSiteId, propertiesToUpdate));

			return getUserProperties(user, dbSiteId);
		} catch (UserNotFoundException e) {
			// This should never happen...
			logger.error("Failed to get the current user with username '{}' in site '{}'", username, siteId, e);
			return null;
		}
	}

	@Override
	public Map<String, String> deleteUserProperties(String siteId,
													List<String> propertiesToDelete)
			throws ServiceLayerException {
		var actualSiteId = getActualSiteId(siteId);
		var dbSiteId = siteService.getSite(actualSiteId).getId();
		var username = SecurityUtils.getCurrentUsername();
		try {
			var user = getUserByIdOrUsername(0, username);
			retryingDatabaseOperationFacade.retry(() -> userDao.deleteUserProperties(user.getId(), dbSiteId, propertiesToDelete));

			return getUserProperties(user, dbSiteId);
		} catch (UserNotFoundException e) {
			// This should never happen...
			logger.error("Failed to get the current user with username '{}' in site '{}'", username, siteId, e);
			return null;
		}
	}

	@Override
	public boolean isSystemAdmin(final String username) {
		Collection<NormalizedRole> roles;
		try {
			roles = getUserGlobalRoles(username);
		} catch (UserNotFoundException e) {
			logger.info("Failed to find user '{}'", username, e);
			return false;
		} catch (ServiceLayerException e) {
			logger.warn("Failed to get site membership for user '{}'", username, e);
			return false;
		}

		boolean toRet = false;
		if (isNotEmpty(roles)) {
			for (NormalizedRole role : roles) {
				if (role.equals(SYSTEM_ADMIN_NORMALIZED_ROLE)) {
					toRet = true;
					break;
				}
			}
		}
		return toRet;
	}

	@Override
	public Collection<NormalizedRole> getUserGlobalRoles(String username)
			throws ServiceLayerException, UserNotFoundException {
		List<Group> groups = getUserGroups(-1, username);

		if (CollectionUtils.isEmpty(groups)) {
			return emptyList();
		}

		Map<NormalizedGroup, List<NormalizedRole>> roleMappings = configurationService.getGlobalRoleMappings();

		if (!isNotEmpty(roleMappings)) {
			return emptyList();
		}

		return groups.stream()
				.flatMap(group -> roleMappings.getOrDefault(new NormalizedGroup(group.getGroupName()), emptyList()).stream())
				.collect(Collectors.toSet());
	}

	@Override
	public void forgotPassword(String username) {
		try {
			ForgotPasswordTaskFactory taskFactory = forgotPasswordTaskFactory.getObject();
			taskExecutor.execute(taskFactory.prepareTask(username));
		} catch (Exception e) {
			logger.error("Failed to get forgot password task for username '{}'", username, e);
		}
	}

	@Override
	public String getForgotPasswordToken(final String username) throws ServiceLayerException {
		long timestamp = System.currentTimeMillis() + TimeUnit.MINUTES.toMillis(
				Long.parseLong(studioConfiguration.getProperty(SECURITY_FORGOT_PASSWORD_TOKEN_TIMEOUT)));
		String salt = studioConfiguration.getProperty(SECURITY_CIPHER_SALT);
		String studioId = instanceService.getInstanceId();
		String token = joinWith(TOKEN_DELIMITER, username, studioId, timestamp, salt);

		return encryptToken(token);
	}

	@Override
	public Set<String> getCurrentUserSitePermissions(String site)
			throws ServiceLayerException, UserNotFoundException, ExecutionException {
		String currentUser = getCurrentUsername();
		return getUserPermission(site, currentUser);
	}

	@Override
	public List<NormalizedRole> getUserSiteRoles(long userId, String username, String site)
			throws ServiceLayerException, UserNotFoundException {
		List<Group> groups = getUserGroups(userId, username);

		if (CollectionUtils.isEmpty(groups)) {
			return Collections.emptyList();
		}

		Map<NormalizedGroup, List<NormalizedRole>> roleMappings = configurationService.getRoleMappings(site);
		Set<NormalizedRole> userRoles = new LinkedHashSet<>();

		if (MapUtils.isEmpty(roleMappings)) {
			return Collections.emptyList();
		}

		if (isSystemAdmin(username)) {
			// If system_admin, return all roles
			Collection<List<NormalizedRole>> roleSets = roleMappings.values();
			for (List<NormalizedRole> roleSet : roleSets) {
				userRoles.addAll(roleSet);
			}
		} else {
			for (Group group : groups) {
				List<NormalizedRole> roles = roleMappings.get(new NormalizedGroup(group.getGroupName()));
				if (isNotEmpty(roles)) {
					userRoles.addAll(roles);
				}
			}
		}

		if (isNotEmpty(userRoles)) {
			userRoles.add(NormalizedRole.WILDCARD_ROLE);
		}
		return new ArrayList<>(userRoles);
	}

	@Override
	public List<org.craftercms.studio.model.Site> getCurrentUserSites() throws AuthenticationException, ServiceLayerException {
		var authentication = SecurityUtils.getAuthentication();
		if (authentication != null) {
			try {
				return getUserSites(-1, authentication.getName());
			} catch (UserNotFoundException e) {
				// Shouldn't happen
				throw new IllegalStateException(e);
			}
		} else {
			throw new AuthenticationException("User should be authenticated");
		}
	}

	@Override
	public List<String> getCurrentUserSiteRoles(final String site) throws AuthenticationException, ServiceLayerException, UserNotFoundException {
		var authentication = SecurityUtils.getAuthentication();
		if (authentication == null) {
			throw new AuthenticationException("User should be authenticated");
		}
		return getUserSiteRoles(-1, authentication.getName(), site)
				.stream()
				.map(NormalizedRole::toString)
				.toList();
	}

	@Override
	public Map<String, Boolean> hasCurrentUserSitePermissions(final String site, final Collection<String> permissions)
			throws ServiceLayerException, UserNotFoundException, ExecutionException {
		Map<String, Boolean> toRet = new HashMap<>();
		Collection<String> userPermissions = getCurrentUserSitePermissions(site);
		permissions.forEach(p -> toRet.put(p, userPermissions.contains(p)));
		return toRet;
	}

	@Override
	public Set<String> getCurrentUserGlobalPermissions() throws ServiceLayerException, UserNotFoundException, ExecutionException {
		String currentUser = getCurrentUsername();
		return getUserPermission(StringUtils.EMPTY, currentUser);
	}

	@Override
	public Map<String, Boolean> hasCurrentUserGlobalPermissions(List<String> permissions) throws ServiceLayerException, UserNotFoundException, ExecutionException {
		Map<String, Boolean> toRet = new HashMap<>();
		Collection<String> userPermissions = getCurrentUserGlobalPermissions();
		permissions.forEach(p -> toRet.put(p, userPermissions.contains(p)));
		return toRet;
	}

	/**
	 * Encrypts the forgot password token.
	 */
	protected String encryptToken(final String token) throws ServiceLayerException {
		try {
			String hashedToken = encryptor.encrypt(token);
			return Base64.getEncoder().encodeToString(hashedToken.getBytes(StandardCharsets.UTF_8));
		} catch (CryptoException e) {
			logger.error("Failed to encrypt the forgot password token", e);
			throw new ServiceLayerException("Failed to encrypt the forgot password token", e);
		}
	}

	/**
	 * Decrypts the forgot password token.
	 */
	protected String decryptToken(String hashedToken) {
		try {
			byte[] hashedTokenBytes = Base64.getDecoder().decode(hashedToken.getBytes(StandardCharsets.UTF_8));
			return encryptor.decrypt(new String(hashedTokenBytes, StandardCharsets.UTF_8));
		} catch (CryptoException e) {
			logger.error("Failed to decrypt the forgot password token", e);
			return null;
		}
	}

	protected boolean validateDecryptedToken(String decryptedToken)
			throws UserNotFoundException, ServiceLayerException, UserExternallyManagedException {
		StringTokenizer tokenElements = new StringTokenizer(decryptedToken, TOKEN_DELIMITER);
		if (tokenElements.countTokens() != 4) {
			logger.warn("Failed to validate forgot password token. Found '{}' elements when expecting 4.",
					tokenElements.countTokens());
			return false;
		}

		String username = tokenElements.nextToken();
		User userProfile = getUserByIdOrUsername(-1, username);

		if (userProfile.isExternallyManaged()) {
			logger.warn("Failed to validate forgot password token. User '{}' is externally managed and therefore " +
					"the password is not managed by us.", username);
			throw new UserExternallyManagedException();
		}

		String studioId = tokenElements.nextToken();
		if (!CS.equals(studioId, instanceService.getInstanceId())) {
			logger.warn("Failed to validate forgot password token. Token's Studio instance ID is '{}' and " +
							"does not match the current value '{}'",
					studioId, instanceService.getInstanceId());
			return false;
		}

		long tokenTimestamp = Long.parseLong(tokenElements.nextToken());
		boolean isExpired = tokenTimestamp < System.currentTimeMillis();
		if (isExpired) {
			logger.info("Failed to validate forgot password token. The token timestamp '{}' is in the past.",
					tokenTimestamp);
		}

		return !isExpired;
	}

	@Override
	public UserResponse setPassword(String token, String newPassword) throws UserNotFoundException,
			UserExternallyManagedException, ServiceLayerException {
		if (!validateToken(token)) {
			return null;
		}
		String username = getUsernameFromToken(token);
		if (!StringUtils.isNotEmpty(username)) {
			throw new UserNotFoundException("User not found");
		}
		User user = getUserByIdOrUsername(-1, username);
		if (!user.isEnabled()) {
			return null;
		}
		boolean success = resetPassword(username, newPassword);
		if (success) {
			return new UserResponse(user);
		}
		return null;
	}

	private String getUsernameFromToken(String token) {
		String toRet = StringUtils.EMPTY;
		String decryptedToken = decryptToken(token);
		if (StringUtils.isNotEmpty(decryptedToken)) {
			StringTokenizer tokenElements = new StringTokenizer(decryptedToken, TOKEN_DELIMITER);
			if (tokenElements.countTokens() == 4) {
				toRet = tokenElements.nextToken();
			}
		}
		return toRet;
	}

	@Override
	public boolean validateToken(String token) throws UserNotFoundException,
			UserExternallyManagedException, ServiceLayerException {
		String decryptedToken = decryptToken(token);
		if (StringUtils.isEmpty(decryptedToken)) {
			logger.warn("Failed to validate forgot password token. The decrypted token is empty.");
			return false;
		}

		return validateDecryptedToken(decryptedToken);
	}

	@Override
	public List<org.craftercms.studio.model.Site> getUserSites(long userId, String username) throws ServiceLayerException, UserNotFoundException {
		List<org.craftercms.studio.model.Site> sites = new ArrayList<>();
		List<org.craftercms.studio.api.v2.dal.Site> allSites = siteService.getAllSites();
		List<Group> userGroups = getUserGroups(userId, username);
		boolean isSysAdmin = isSystemAdmin(username);

		// Iterate all sites. If the user has any of the site groups, it has access to the site
		for (org.craftercms.studio.api.v2.dal.Site site : allSites) {
			List<NormalizedGroup> siteGroups = configurationService.getSiteGroups(site.getSiteId());
			if (isSysAdmin || userGroups.stream().map(Group::getGroupName)
					.map(NormalizedGroup::new)
					.anyMatch(siteGroups::contains)) {
				sites.add(new org.craftercms.studio.model.Site(site));
			}
		}

		return sites;
	}

	@Override
	public boolean isSiteMember(String username, String siteId) {
		try {
			if (isSystemAdmin(username)) {
				return true;
			}

			List<Group> userGroups = getUserGroups(-1, username);
			List<NormalizedGroup> siteGroups = configurationService.getSiteGroups(siteId);
			return userGroups.stream()
					.map(group -> new NormalizedGroup((group.getGroupName())))
					.anyMatch(siteGroups::contains);
		} catch (ServiceLayerException | UserNotFoundException e) {
			logger.error("Failed to check the groups for user '{}' in site '{}'", getAuthentication().getName(), siteId, e);
		}
		return false;
	}

	@Override
	public void setApplicationEventPublisher(@NonNull ApplicationEventPublisher applicationEventPublisher) {
		this.eventPublisher = applicationEventPublisher;
	}

	// These setters are used to avoid circular dependencies
	@Autowired
	@Lazy
	@Qualifier("configurationServiceInternal")
	public void setConfigurationService(ConfigurationService configurationService) {
		this.configurationService = configurationService;
	}

	@Autowired
	@Lazy
	@Qualifier("sitesServiceInternal")
	public void setSiteService(SitesService siteService) {
		this.siteService = siteService;
	}

	@Autowired
	@Lazy
	public void setPermissionMappingsProvider(PermissionMappingsProvider permissionMappingsProvider) {
		this.permissionMappingsProvider = permissionMappingsProvider;
	}
}
