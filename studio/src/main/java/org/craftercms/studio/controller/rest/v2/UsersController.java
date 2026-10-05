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

package org.craftercms.studio.controller.rest.v2;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import org.apache.commons.lang3.StringUtils;
import org.craftercms.commons.validation.ValidationException;
import org.craftercms.commons.validation.annotations.param.EsapiValidatedParam;
import org.craftercms.commons.validation.annotations.param.SqlSort;
import org.craftercms.commons.validation.annotations.param.ValidSiteId;
import org.craftercms.commons.validation.validators.impl.EsapiValidator;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.security.*;
import org.craftercms.studio.api.v2.dal.User;
import org.craftercms.studio.api.v2.dal.security.NormalizedRole;
import org.craftercms.studio.api.v2.service.security.UserService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.controller.rest.ValidationUtils;
import org.craftercms.studio.impl.v2.utils.PaginationUtils;
import org.craftercms.studio.impl.v2.utils.security.SecurityUtils;
import org.craftercms.studio.model.AuthenticatedUser;
import org.craftercms.studio.model.Site;
import org.craftercms.studio.model.rest.*;
import org.craftercms.studio.model.users.HasPermissionsRequest;
import org.craftercms.studio.model.users.UpdateUserPropertiesRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.util.CollectionUtils;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.beans.ConstructorProperties;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import static org.apache.commons.lang3.StringUtils.isEmpty;
import static org.apache.commons.lang3.StringUtils.isNumeric;
import static org.craftercms.commons.validation.annotations.param.EsapiValidationType.SEARCH_KEYWORDS;
import static org.craftercms.commons.validation.annotations.param.EsapiValidationType.USERNAME;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.SECURITY_SET_PASSWORD_DELAY;
import static org.craftercms.studio.controller.rest.v2.RequestConstants.*;
import static org.craftercms.studio.controller.rest.v2.RequestMappingConstants.*;
import static org.craftercms.studio.controller.rest.v2.ResultConstants.*;
import static org.craftercms.studio.model.rest.ApiResponse.*;
import static org.craftercms.studio.model.rest.UserResponse.convert;
import static org.springframework.http.MediaType.ALL_VALUE;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

@Validated
@RestController
@RequestMapping(API_2 + USERS)
public class UsersController {

	private static final Logger logger = LoggerFactory.getLogger(UsersController.class);

	private final UserService userService;
	private final StudioConfiguration studioConfiguration;

	@ConstructorProperties({"userService", "studioConfiguration"})
	public UsersController(UserService userService, StudioConfiguration studioConfiguration) {
		this.userService = userService;
		this.studioConfiguration = studioConfiguration;
	}

	/**
	 * Get all users API
	 *
	 * @param siteId Site identifier
	 * @param offset Result set offset
	 * @param limit  Result set limit
	 * @param sort   Sort order
	 * @return Response containing list of users
	 */
	@GetMapping(produces = APPLICATION_JSON_VALUE)
	public PaginatedResultList<UserResponse> getAllUsers(
		@ValidSiteId @RequestParam(value = REQUEST_PARAM_SITE_ID, required = false) String siteId,
		@EsapiValidatedParam(type = SEARCH_KEYWORDS) @RequestParam(value = REQUEST_PARAM_KEYWORD, required = false) String keyword,
		@PositiveOrZero @RequestParam(value = REQUEST_PARAM_OFFSET, required = false, defaultValue = "0") int offset,
		@PositiveOrZero @RequestParam(value = REQUEST_PARAM_LIMIT, required = false, defaultValue = "10") int limit,
		@SqlSort(columns = USER_SORT_COLUMNS) @RequestParam(value = REQUEST_PARAM_SORT, required = false,
			defaultValue = "id asc") String sort,
		@RequestParam(value = REQUEST_PARAM_SHOW_DISABLED, required = false, defaultValue = "false") boolean showDisabled)
		throws ServiceLayerException {
		Collection<User> users;
		int total;
		if (isEmpty(siteId)) {
			total = userService.getAllUsersTotal(keyword, showDisabled);
			users = userService.getAllUsers(keyword, offset, limit, sort, showDisabled);
		} else {
			total = userService.getAllUsersForSiteTotal(siteId, keyword, showDisabled);
			users = userService.getAllUsersForSite(siteId, keyword, offset, limit, sort, showDisabled);
		}

		PaginatedResultList<UserResponse> result = new PaginatedResultList<>();
		result.setTotal(total);
		result.setOffset(offset);
		result.setLimit(CollectionUtils.isEmpty(users) ? 0 : users.size());
		result.setResponse(OK);
		result.setEntities(RESULT_KEY_USERS, convert(users));
		return result;
	}

	/**
	 * Create user API
	 *
	 * @param user User to create
	 * @return Response object
	 */
	@ResponseStatus(HttpStatus.CREATED)
	@PostMapping(consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public ResultOne<UserResponse> createUser(@Valid @RequestBody CreateUserRequest user)
		throws UserAlreadyExistsException, ServiceLayerException, AuthenticationException {
		UserResponse newUser = new UserResponse(userService.createUser(buildUser(user)));
		ResultOne<UserResponse> result = new ResultOne<>();
		result.setResponse(CREATED);
		result.setEntity(RESULT_KEY_USER, newUser);
		return result;
	}

	private User buildUser(final CreateUserRequest userRequest) {
		User user = new User();
		user.setUsername(userRequest.getUsername());
		user.setPassword(userRequest.getPassword());
		user.setFirstName(userRequest.getFirstName());
		user.setLastName(userRequest.getLastName());
		user.setExternallyManaged(userRequest.isExternallyManaged());
		user.setEmail(userRequest.getEmail());
		user.setEnabled(userRequest.isEnabled());

		return user;
	}

	private User buildUser(final UpdateUserRequest userRequest) {
		User user = new User();
		user.setId(userRequest.getId());
		user.setFirstName(userRequest.getFirstName());
		user.setLastName(userRequest.getLastName());
		user.setEmail(userRequest.getEmail());
		user.setEnabled(userRequest.isEnabled());

		return user;
	}

	/**
	 * Update user API
	 *
	 * @param user User to update
	 * @return Response object
	 */
	@PatchMapping(consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public ResultOne<UserResponse> updateUser(@Valid @RequestBody UpdateUserRequest user)
		throws ServiceLayerException, UserNotFoundException, AuthenticationException, UserExternallyManagedException {
		User userRequest = buildUser(user);
		userService.updateUser(userRequest);

		ResultOne<UserResponse> result = new ResultOne<>();
		result.setResponse(OK);
		result.setEntity(RESULT_KEY_USER, new UserResponse(userRequest));
		return result;
	}

	/**
	 * Get user API
	 *
	 * @param userId User identifier
	 * @return Response containing user
	 */
	@GetMapping(value = PATH_PARAM_ID, consumes = ALL_VALUE, produces = APPLICATION_JSON_VALUE)
	public ResultOne<UserResponse> getUser(@PathVariable(REQUEST_PARAM_ID) String userId)
		throws ServiceLayerException, UserNotFoundException, ValidationException {
		int uId = -1;
		String username = StringUtils.EMPTY;
		if (isNumeric(userId)) {
			uId = Integer.parseInt(userId);
		} else {
			ValidationUtils.validateValue(new EsapiValidator(USERNAME), userId, REQUEST_PARAM_ID);
			username = userId;
		}
		User user = userService.getUserByIdOrUsername(uId, username);

		ResultOne<UserResponse> result = new ResultOne<>();
		result.setResponse(OK);
		result.setEntity(RESULT_KEY_USER, new UserResponse(user));
		return result;
	}

	/**
	 * Enable users API
	 *
	 * @param enableUsers Enable users request body (json representation)
	 * @return Response object
	 */
	@PatchMapping(value = ENABLE, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public ResultList<UserResponse> enableUsers(@Valid @RequestBody EnableUsers enableUsers)
		throws ServiceLayerException, UserNotFoundException, UserExternallyManagedException {
		ValidationUtils.validateEnableUsers(enableUsers);

		List<User> users = userService.enableUsers(enableUsers.getIds(), enableUsers.getUsernames(), true);

		ResultList<UserResponse> result = new ResultList<>();
		result.setResponse(OK);
		result.setEntities(RESULT_KEY_USERS, users.stream().map(UserResponse::new).toList());
		return result;
	}

	/**
	 * Disable users API
	 *
	 * @param enableUsers Disable users request body (json representation)
	 * @return Response object
	 */
	@PatchMapping(value = DISABLE, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public ResultList<UserResponse> disableUsers(@Valid @RequestBody EnableUsers enableUsers)
		throws ServiceLayerException, UserNotFoundException, UserExternallyManagedException {
		ValidationUtils.validateEnableUsers(enableUsers);

		List<UserResponse> users = userService.enableUsers(enableUsers.getIds(), enableUsers.getUsernames(), false).stream()
			.map(UserResponse::new).collect(Collectors.toList());

		ResultList<UserResponse> result = new ResultList<>();
		result.setResponse(OK);
		result.setEntities(RESULT_KEY_USERS, users);
		return result;
	}

	/**
	 * Get user sites API
	 *
	 * @param userId User identifier
	 * @return Response containing list of sites
	 */
	@GetMapping(value = PATH_PARAM_ID + SITES, produces = APPLICATION_JSON_VALUE)
	public PaginatedResultList<Site> getUserSites(
		@NotNull @PathVariable(REQUEST_PARAM_ID) String userId,
		@PositiveOrZero @RequestParam(value = REQUEST_PARAM_OFFSET, required = false, defaultValue = "0") int offset,
		@PositiveOrZero @RequestParam(value = REQUEST_PARAM_LIMIT, required = false, defaultValue = "10") int limit)
		throws ServiceLayerException, UserNotFoundException, ValidationException {
		int uId = -1;
		String username = StringUtils.EMPTY;
		if (isNumeric(userId)) {
			uId = Integer.parseInt(userId);
		} else {
			ValidationUtils.validateValue(new EsapiValidator(USERNAME), userId, REQUEST_PARAM_ID);
			username = userId;
		}
		List<Site> allSites = userService.getUserSites(uId, username);
		List<Site> paginatedSites = PaginationUtils.paginate(allSites, offset, limit, "siteId");

		PaginatedResultList<Site> result = new PaginatedResultList<>();
		result.setResponse(OK);
		result.setTotal(allSites.size());
		result.setOffset(offset);
		result.setLimit(limit);
		result.setEntities(RESULT_KEY_SITES, paginatedSites);

		return result;
	}

	/**
	 * Get user roles for a site API
	 *
	 * @param userId User identifier
	 * @param siteId The site ID
	 * @return Response containing list of roles
	 */
	@GetMapping(value = PATH_PARAM_ID + SITES + PATH_PARAM_SITE + ROLES, produces = APPLICATION_JSON_VALUE)
	public ResultList<String> getUserSiteRoles(@NotNull @PathVariable(REQUEST_PARAM_ID) String userId,
						   @NotNull @ValidSiteId @PathVariable(REQUEST_PARAM_SITEID) String siteId)
		throws ServiceLayerException, UserNotFoundException, ValidationException {
		int uId = -1;
		String username = StringUtils.EMPTY;
		if (isNumeric(userId)) {
			uId = Integer.parseInt(userId);
		} else {
			ValidationUtils.validateValue(new EsapiValidator(USERNAME), userId, REQUEST_PARAM_ID);
			username = userId;
		}

		List<String> roles = userService.getUserSiteRoles(uId, username, siteId)
			.stream()
			.map(NormalizedRole::toString)
			.toList();
		ResultList<String> result = new ResultList<>();
		result.setResponse(OK);
		result.setEntities(RESULT_KEY_ROLES, roles);

		return result;
	}

	/**
	 * Get current authenticated user API
	 *
	 * @return Response containing current authenticated user
	 */
	@GetMapping(value = ME, produces = APPLICATION_JSON_VALUE)
	public ResultOne<AuthenticatedUser> getCurrentUser() throws AuthenticationException, ServiceLayerException {
		AuthenticatedUser user = SecurityUtils.getCurrentUser();

		ResultOne<AuthenticatedUser> result = new ResultOne<>();
		result.setResponse(OK);
		result.setEntity(RESULT_KEY_CURRENT_USER, user);

		return result;
	}

	/**
	 * Get the sites of the current authenticated user API
	 *
	 * @return Response containing current authenticated user sites
	 */
	@GetMapping(value = ME + SITES, produces = APPLICATION_JSON_VALUE)
	public PaginatedResultList<Site> getCurrentUserSites(
		@PositiveOrZero @RequestParam(value = REQUEST_PARAM_OFFSET, required = false, defaultValue = "0") int offset,
		@PositiveOrZero @RequestParam(value = REQUEST_PARAM_LIMIT, required = false, defaultValue = "10") int limit)
		throws AuthenticationException, ServiceLayerException {
		List<Site> allSites = userService.getCurrentUserSites();
		List<Site> paginatedSites = PaginationUtils.paginate(allSites, offset, limit, "name");

		PaginatedResultList<Site> result = new PaginatedResultList<>();
		result.setResponse(OK);
		result.setTotal(allSites.size());
		result.setOffset(offset);
		result.setLimit(limit);
		result.setEntities(RESULT_KEY_SITES, paginatedSites);

		return result;
	}

	/**
	 * Get the roles in a site of the current authenticated user API
	 *
	 * @return Response containing current authenticated user roles
	 */
	@GetMapping(value = ME + SITES + PATH_PARAM_SITE + ROLES, produces = APPLICATION_JSON_VALUE)
	public ResultList<String> getCurrentUserSiteRoles(@NotBlank @ValidSiteId @PathVariable(REQUEST_PARAM_SITEID) String siteId)
		throws AuthenticationException, ServiceLayerException, UserNotFoundException {
		List<String> roles = userService.getCurrentUserSiteRoles(siteId);

		ResultList<String> result = new ResultList<>();
		result.setResponse(OK);
		result.setEntities(RESULT_KEY_ROLES, roles);

		return result;
	}

	@GetMapping(value = FORGOT_PASSWORD, produces = APPLICATION_JSON_VALUE)
	public ResultOne<String> forgotPassword(@NotBlank @RequestParam(value = REQUEST_PARAM_USERNAME) String username) {
		int delay = studioConfiguration.getProperty(SECURITY_SET_PASSWORD_DELAY, Integer.class);
		try {
			TimeUnit.SECONDS.sleep(delay);
			ValidationUtils.validateValue(new EsapiValidator(USERNAME), username, REQUEST_PARAM_USERNAME);
			userService.forgotPassword(username);
		} catch (ServiceLayerException e) {
			logger.error("Failed to process forgot password for user '{}'", username, e);
		} catch (ValidationException e) {
			logger.error("Validation error while processing forgot password for user '{}'", username, e);
		} catch (InterruptedException e) {
			logger.debug("Interrupted while delaying request by '{}' seconds", delay, e);
		}
		ResultOne<String> result = new ResultOne<>();
		result.setEntity(RESULT_KEY_MESSAGE, "If the user exists, a password recovery email has been sent to them.");
		result.setResponse(OK);
		return result;
	}

	@PostMapping(value = ME + CHANGE_PASSWORD, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public ResultOne<UserResponse> changePassword(@Valid @RequestBody ChangePasswordRequest changePasswordRequest)
		throws PasswordDoesNotMatchException, ServiceLayerException, UserExternallyManagedException,
		AuthenticationException, UserNotFoundException {
		int delay = studioConfiguration.getProperty(SECURITY_SET_PASSWORD_DELAY, Integer.class);
		try {
			TimeUnit.SECONDS.sleep(delay);
		} catch (InterruptedException e) {
			logger.debug("Interrupted while delaying request by '{}' seconds", delay, e);
		}
		UserResponse user = new UserResponse(userService.changePassword(changePasswordRequest.getUsername(),
			changePasswordRequest.getCurrent(), changePasswordRequest.getNewPassword()));

		ResultOne<UserResponse> result = new ResultOne<>();
		result.setEntity(RESULT_KEY_USER, user);
		result.setResponse(OK);
		return result;
	}

	@PostMapping(value = SET_PASSWORD, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public ResultOne<UserResponse> setPassword(@Valid @RequestBody SetPasswordRequest setPasswordRequest)
		throws UserNotFoundException, UserExternallyManagedException, ServiceLayerException {
		int delay = studioConfiguration.getProperty(SECURITY_SET_PASSWORD_DELAY, Integer.class);
		try {
			TimeUnit.SECONDS.sleep(delay);
		} catch (InterruptedException e) {
			logger.debug("Interrupted while delaying request by '{}' seconds", delay, e);
		}
		UserResponse user = new UserResponse(userService.setPassword(setPasswordRequest.getToken(), setPasswordRequest.getNewPassword()));

		ResultOne<UserResponse> result = new ResultOne<>();
		result.setEntity(RESULT_KEY_USER, user);
		result.setResponse(OK);
		return result;
	}

	@PostMapping(value = PATH_PARAM_ID + RESET_PASSWORD, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public Result resetPassword(@NotBlank @EsapiValidatedParam(type = USERNAME) @PathVariable(REQUEST_PARAM_ID) String userId,
				    @Valid @RequestBody ResetPasswordRequest resetPasswordRequest)
		throws UserNotFoundException, UserExternallyManagedException, ServiceLayerException {
		userService.resetPassword(resetPasswordRequest.getUsername(), resetPasswordRequest.getNewPassword());

		Result result = new Result();
		result.setResponse(OK);
		return result;
	}

	@GetMapping(value = VALIDATE_TOKEN, produces = APPLICATION_JSON_VALUE)
	public Result validateToken(HttpServletResponse response,
				    @NotBlank @RequestParam(value = REQUEST_PARAM_TOKEN) String token)
		throws UserNotFoundException, UserExternallyManagedException, ServiceLayerException {
		int delay = studioConfiguration.getProperty(SECURITY_SET_PASSWORD_DELAY, Integer.class);
		try {
			TimeUnit.SECONDS.sleep(delay);
		} catch (InterruptedException e) {
			logger.debug("Interrupted while delaying request by '{}' seconds", delay, e);
		}

		boolean valid = userService.validateToken(token);
		Result result = new Result();
		if (valid) {
			result.setResponse(OK);
		} else {
			result.setResponse(UNAUTHORIZED);
			response.setStatus(HttpStatus.UNAUTHORIZED.value());
		}
		return result;
	}

	@GetMapping(value = ME + PROPERTIES, produces = APPLICATION_JSON_VALUE)
	public ResultOne<Map<String, Map<String, String>>> getUserProperties(
		@ValidSiteId @RequestParam(required = false, defaultValue = StringUtils.EMPTY) String siteId)
		throws ServiceLayerException {
		ResultOne<Map<String, Map<String, String>>> result = new ResultOne<>();
		result.setResponse(OK);
		result.setEntity("properties", userService.getUserProperties(siteId)); //TODO: Extract key
		return result;
	}

	@PostMapping(value = ME + PROPERTIES, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public ResultOne<Map<String, String>> updateUserProperties(@Valid @RequestBody UpdateUserPropertiesRequest request)
		throws ServiceLayerException {
		ResultOne<Map<String, String>> result = new ResultOne<>();
		result.setResponse(OK);
		result.setEntity("properties", userService.updateUserProperties(request.getSiteId(), request.getProperties())); //TODO: Extract key

		return result;
	}

	@DeleteMapping(value = ME + PROPERTIES, produces = APPLICATION_JSON_VALUE)
	public ResultOne<Map<String, String>> deleteUserProperties(
		@ValidSiteId @RequestParam(required = false, defaultValue = StringUtils.EMPTY) String siteId,
		@RequestParam @NotEmpty List<@NotBlank String> properties) throws ServiceLayerException {
		ResultOne<Map<String, String>> result = new ResultOne<>();
		result.setResponse(OK);
		result.setEntity("properties", userService.deleteUserProperties(siteId, properties)); //TODO: Extract key
		return result;
	}

	/**
	 * Get the permissions in a site of the current authenticated user API
	 *
	 * @return Response containing current authenticated user permissions
	 */
	@GetMapping(value = ME + SITES + PATH_PARAM_SITE + PERMISSIONS, produces = APPLICATION_JSON_VALUE)
	public ResultList<String> getCurrentUserSitePermissions(@ValidSiteId @PathVariable(REQUEST_PARAM_SITEID) String siteId)
		throws ServiceLayerException, UserNotFoundException, ExecutionException {
		List<String> permissions = userService.getCurrentUserSitePermissions(siteId).stream().sorted().toList();
		ResultList<String> result = new ResultList<>();
		result.setResponse(OK);
		result.setEntities(RESULT_KEY_PERMISSIONS, permissions);
		return result;
	}

	/**
	 * Check if user has permissions in a site of the current authenticated user API
	 *
	 * @return Response containing current authenticated user roles
	 */
	@PostMapping(value = ME + SITES + PATH_PARAM_SITE + HAS_PERMISSIONS, consumes = APPLICATION_JSON_VALUE,
		produces = APPLICATION_JSON_VALUE)
	public ResultOne<Map<String, Boolean>> checkCurrentUserHasSitePermissions(@ValidSiteId @PathVariable(REQUEST_PARAM_SITEID) String siteId,
										  @Valid @RequestBody HasPermissionsRequest permissionsRequest)
		throws ServiceLayerException, UserNotFoundException, ExecutionException {
		Map<String, Boolean> hasPermissions =
			userService.hasCurrentUserSitePermissions(siteId, permissionsRequest.getPermissions());

		ResultOne<Map<String, Boolean>> result = new ResultOne<>();
		result.setResponse(OK);
		result.setEntity(RESULT_KEY_PERMISSIONS, hasPermissions);
		return result;
	}

	/**
	 * Get the global permissions of the current authenticated user API
	 *
	 * @return Response containing current authenticated user global permissions
	 */
	@GetMapping(value = ME + GLOBAL + PERMISSIONS, produces = APPLICATION_JSON_VALUE)
	public ResultList<String> getCurrentUserGlobalPermissions()
		throws ServiceLayerException, UserNotFoundException, ExecutionException {
		List<String> permissions = userService.getCurrentUserGlobalPermissions().stream().sorted().toList();

		ResultList<String> result = new ResultList<>();
		result.setResponse(OK);
		result.setEntities(RESULT_KEY_PERMISSIONS, permissions);

		return result;
	}

	/**
	 * Check if the current authenticated user has global permissions
	 *
	 * @return Response containing current authenticated user roles
	 */
	@PostMapping(value = ME + GLOBAL + HAS_PERMISSIONS, consumes = APPLICATION_JSON_VALUE,
		produces = APPLICATION_JSON_VALUE)
	public ResultOne<Map<String, Boolean>> checkCurrentUserHasGlobalPermissions(@Valid @RequestBody HasPermissionsRequest permissionsRequest)
		throws ServiceLayerException, UserNotFoundException, ExecutionException {
		Map<String, Boolean> hasPermissions =
			userService.hasCurrentUserGlobalPermissions(permissionsRequest.getPermissions());

		ResultOne<Map<String, Boolean>> result = new ResultOne<>();
		result.setResponse(OK);
		result.setEntity(RESULT_KEY_PERMISSIONS, hasPermissions);
		return result;
	}
}
