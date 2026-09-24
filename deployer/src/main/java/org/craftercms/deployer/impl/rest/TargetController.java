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
package org.craftercms.deployer.impl.rest;

import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.Strings;
import org.craftercms.commons.config.ConfigurationException;
import org.craftercms.commons.exceptions.InvalidManagementTokenException;
import org.craftercms.commons.rest.RestServiceUtils;
import org.craftercms.commons.rest.Result;
import org.craftercms.commons.validation.annotations.param.*;
import org.craftercms.deployer.api.Deployment;
import org.craftercms.deployer.api.DeploymentService;
import org.craftercms.deployer.api.Target;
import org.craftercms.deployer.api.TargetService;
import org.craftercms.deployer.api.exceptions.DeployerException;
import org.craftercms.deployer.api.exceptions.TargetAlreadyExistsException;
import org.craftercms.deployer.api.exceptions.TargetNotFoundException;
import org.craftercms.deployer.api.exceptions.TargetServiceException;
import org.craftercms.deployer.impl.rest.model.CreateTargetRequest;
import org.craftercms.deployer.impl.rest.model.DuplicateTargetRequest;
import org.craftercms.deployer.impl.rest.model.TargetTemplateParams;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.craftercms.commons.validation.annotations.param.EsapiValidationType.SITE_ID;
import static org.craftercms.deployer.impl.rest.RestConstants.*;
import static org.craftercms.deployer.utils.BooleanUtils.toBoolean;

/**
 * Main controller for target related operations.
 *
 * @author avasquez
 */
@Validated
@RestController
@RequestMapping(TargetController.BASE_URL)
public class TargetController {

    public static final String BASE_URL = "/api/1/target";
    public static final String CREATE_TARGET_URL = "/create";
    public static final String CREATE_TARGET_IF_NOT_EXISTS_URL = "/create_if_not_exists";
    public static final String DUPLICATE_TARGET_URL = "/duplicate/{" + ENV_PATH_VAR_NAME + "}/" +
            "{" + SITE_NAME_PATH_VAR_NAME + "}";
    public static final String GET_TARGET_URL = "/get/{" + ENV_PATH_VAR_NAME + "}/" +
            "{" + SITE_NAME_PATH_VAR_NAME + "}";
    public static final String GET_ALL_TARGETS_URL = "/get-all";
    public static final String DELETE_TARGET_URL = "/delete/{" + ENV_PATH_VAR_NAME + "}/" +
            "{" + SITE_NAME_PATH_VAR_NAME + "}";
    public static final String DELETE_IF_EXIST_TARGET_URL = "/delete-if-exists/{" + ENV_PATH_VAR_NAME + "}/" +
            "{" + SITE_NAME_PATH_VAR_NAME + "}";
    public static final String DEPLOY_TARGET_URL = "/deploy/{" + ENV_PATH_VAR_NAME + "}/" +
            "{" + SITE_NAME_PATH_VAR_NAME + "}";
    public static final String DEPLOY_ALL_TARGETS_URL = "/deploy-all";
    public static final String GET_PENDING_DEPLOYMENTS_URL = "/deployments/get-pending/{" + ENV_PATH_VAR_NAME + "}/" +
            "{" + SITE_NAME_PATH_VAR_NAME + "}";
    public static final String GET_CURRENT_DEPLOYMENT_URL = "/deployments/get-current/{" + ENV_PATH_VAR_NAME + "}/" +
            "{" + SITE_NAME_PATH_VAR_NAME + "}";
    public static final String GET_ALL_DEPLOYMENTS_URL = "/deployments/get-all/{" + ENV_PATH_VAR_NAME + "}/" +
            "{" + SITE_NAME_PATH_VAR_NAME + "}";
    public static final String UNLOCK_TARGET_URL = "/unlock/{" + ENV_PATH_VAR_NAME + "}/" +
            "{" + SITE_NAME_PATH_VAR_NAME + "}";
    public static final String RECREATE_INDEX_URL = "/recreate/{" + ENV_PATH_VAR_NAME + "}/" +
            "{" + SITE_NAME_PATH_VAR_NAME + "}";

    public static final String REPO_URL_PARAM_NAME = "repo_url";
    public static final String REPO_BRANCH_PARAM_NAME = "repo_branch";
    public static final String REPO_USERNAME_PARAM_NAME = "repo_username";
    public static final String SSH_PRIVATE_KEY_PATH_PARAM_NAME = "ssh_private_key_path";
    public static final String ENGINE_URL_PARAM_NAME = "engine_url";
    public static final String NOTIFICATION_ADDRESSESS_PARAM_NAME = "notification_addresses";


    private static final String DEPLOY_TARGET_VALID_PARAMS = "reprocess_all_files|from_commit_id|deployment_mode|wait_till_done";

    private static final String DEPLOY_ALL_TARGETS_VALID_PARAMS = "reprocess_all_files|deployment_mode|wait_till_done";

    protected final TargetService targetService;
    protected final DeploymentService deploymentService;

    @Value("${deployer.main.management.authorizationToken}")
    protected String managementToken;

    @Autowired
    public TargetController(TargetService targetService, DeploymentService deploymentService) {
        this.targetService = targetService;
        this.deploymentService = deploymentService;
    }

    /**
     * Creates a Deployer {@link Target}.
     *
     * @param params the body of the request with the template parameters that will
     *               be used to create the target.
     *               The body must contain at least a {@code env} and
     *               {@code site_name} parameter. Other required
     *               parameters depend on the template used.
     * @param token the management token
     * @return the response entity 201 CREATED status
     * @throws DeployerException               if an error occurred during target
     *                                         creation
     * @throws InvalidManagementTokenException
     */
    @RequestMapping(value = CREATE_TARGET_URL, method = RequestMethod.POST)
    public ResponseEntity<Result> createTarget(@Valid @RequestBody CreateTargetRequest params,
            @RequestParam String token) throws DeployerException, InvalidManagementTokenException {
        validateToken(token);
        return createTarget(params, false);
    }

    @RequestMapping(value = CREATE_TARGET_IF_NOT_EXISTS_URL, method = RequestMethod.POST)
    public ResponseEntity<Result> createTargetIfNotExists(@Valid @RequestBody CreateTargetRequest params,
    @RequestParam String token) throws DeployerException, InvalidManagementTokenException {
        validateToken(token);
        return createTarget(params, true);
    }

    /**
     * Returns a {@link Target}.
     *
     * @param env      the target's environment
     * @param siteName the target's site name
     * @param token the management token
     * @return the response entity with the target's properties and 200 OK status
     * @throws DeployerException if an error occurred
     */
    @RequestMapping(value = GET_TARGET_URL, method = RequestMethod.GET)
    public ResponseEntity<Target> getTarget(@NotBlank @ValidateNoTagsParam @ValidateSecurePathParam @PathVariable(ENV_PATH_VAR_NAME) String env,
                                            @NotBlank @EsapiValidatedParam(type = SITE_ID) @PathVariable(SITE_NAME_PATH_VAR_NAME) String siteName,
                                            @RequestParam String token)
            throws DeployerException, InvalidManagementTokenException {
        validateToken(token);
        Target target = targetService.getTarget(env, siteName);

        return new ResponseEntity<>(target,
                createResponseHeaders(BASE_URL + GET_TARGET_URL, env, siteName),
                HttpStatus.OK);
    }

    /**
     * Returns all current {@link Target}s
     *
     * @param token the management token
     * @return the response entity with all the properties of the targets and 200 OK status
     * @throws DeployerException if an error occurred
     */
    @RequestMapping(value = GET_ALL_TARGETS_URL, method = RequestMethod.GET)
    public ResponseEntity<List<Target>> getAllTargets(@RequestParam String token) throws DeployerException, InvalidManagementTokenException {
        validateToken(token);
        List<Target> targets = targetService.getAllTargets();

        return new ResponseEntity<>(targets,
                createResponseHeaders(BASE_URL + GET_ALL_TARGETS_URL),
                HttpStatus.OK);
    }

    /**
     * Deletes the {@link Target} with the specified environment and site name.
     *
     * @param env      the target's environment
     * @param siteName the target's site name
     * @param token the management token
     * @return the response entity with a 204 NO CONTENT status
     * @throws DeployerException if an error occurred
     */
    @RequestMapping(value = DELETE_TARGET_URL, method = RequestMethod.POST)
    public ResponseEntity<Void> deleteTarget(@NotBlank @ValidateNoTagsParam @ValidateSecurePathParam @PathVariable(ENV_PATH_VAR_NAME) String env,
                                             @NotBlank @EsapiValidatedParam(type = SITE_ID) @PathVariable(SITE_NAME_PATH_VAR_NAME) String siteName,
                                             @RequestParam String token)
                                             throws DeployerException, InvalidManagementTokenException {
        validateToken(token);
        targetService.deleteTarget(env, siteName);

        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    /**
     * Deletes the {@link Target} with the specified environment and site name, does nothing if the target is not found.
     *
     * @param env      the target's environment
     * @param siteName the target's site name
     * @param token the management token
     * @return the response entity with a 204 NO CONTENT status
     * @throws DeployerException if an error occurred
     */
    @RequestMapping(value = DELETE_IF_EXIST_TARGET_URL, method = RequestMethod.POST)
    public ResponseEntity<Void> deleteTargetIfExists(@NotBlank @ValidateNoTagsParam @ValidateSecurePathParam @PathVariable(ENV_PATH_VAR_NAME) String env,
                                                     @NotBlank @EsapiValidatedParam(type = SITE_ID) @PathVariable(SITE_NAME_PATH_VAR_NAME) String siteName,
                                                     @RequestParam String token)
            throws DeployerException, InvalidManagementTokenException {
        validateToken(token);

        try {
            targetService.deleteTarget(env, siteName);
        } catch (TargetNotFoundException e) {
            // do nothing
        }

        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    /**
     * Deploys the {@link Target} with the specified environment and site name.
     *
     * @param env      the target's environment
     * @param siteName the target's site name
     * @param params   any additional parameters that can be used by the
     *                 {@link org.craftercms.deployer.api.DeploymentProcessor}s, for
     *                 example {@code reprocess_all_files}
     * @param token the management token
     * @return the response entity with a 200 OK status
     * @throws DeployerException if an error occurred
     */
    @RequestMapping(value = DEPLOY_TARGET_URL, method = RequestMethod.POST)
    public ResponseEntity<Result> deployTarget(@NotBlank @ValidateNoTagsParam
                                               @ValidateSecurePathParam @PathVariable(ENV_PATH_VAR_NAME) String env,
                                               @NotBlank @EsapiValidatedParam(type = SITE_ID)
                                               @PathVariable(SITE_NAME_PATH_VAR_NAME) String siteName,
                                               @RequestBody(required = false)
                                               Map<@ValidateStringParam(whitelistedPatterns = DEPLOY_TARGET_VALID_PARAMS) String, Object> params,
                                               @RequestParam String token)
            throws DeployerException, InvalidManagementTokenException {
        validateToken(token);
        if (params == null) {
            params = new HashMap<>();
        }

        boolean waitTillDone = toBoolean(params.remove(WAIT_TILL_DONE_PARAM_NAME));

        deploymentService.deployTarget(env, siteName, waitTillDone, params);

        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Result.OK);
    }

    /**
     * Deploys all current {@link Target}s.
     *
     * @param params any additional parameters that can be used by the
     *               {@link org.craftercms.deployer.api.DeploymentProcessor}s, for
     *               example {@code reprocess_all_files}
     * @param token the management token
     * @return the response entity with a 200 OK status
     * @throws DeployerException if an error occurred
     */
    @RequestMapping(value = DEPLOY_ALL_TARGETS_URL, method = RequestMethod.POST)
    public ResponseEntity<Result> deployAllTargets(
            @RequestBody(required = false) Map<@ValidateStringParam(whitelistedPatterns = DEPLOY_ALL_TARGETS_VALID_PARAMS) String, Object> params,
            @RequestParam String token)
            throws DeployerException, InvalidManagementTokenException {
        validateToken(token);
        if (params == null) {
            params = new HashMap<>();
        }

        boolean waitTillDone = toBoolean(params.remove(WAIT_TILL_DONE_PARAM_NAME));

        deploymentService.deployAllTargets(waitTillDone, params);

        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Result.OK);
    }

    /**
     * Gets the pending deployments for a target.
     *
     * @param env      the target's environment
     * @param siteName the target's site name
     * @param token the management token
     * @return the pending deployments for the target
     * @throws DeployerException if an error occurred
     */
    @RequestMapping(value = GET_PENDING_DEPLOYMENTS_URL, method = RequestMethod.GET)
    public ResponseEntity<Collection<Deployment>> getPendingDeployments(
            @NotBlank @ValidateNoTagsParam
            @ValidateSecurePathParam @PathVariable(ENV_PATH_VAR_NAME) String env,
            @NotBlank @EsapiValidatedParam(type = SITE_ID) @PathVariable(SITE_NAME_PATH_VAR_NAME) String siteName,
            @RequestParam String token) throws DeployerException, InvalidManagementTokenException {
        validateToken(token);
        Target target = targetService.getTarget(env, siteName);
        Collection<Deployment> deployments = target.getPendingDeployments();

        return new ResponseEntity<>(deployments,
                createResponseHeaders(BASE_URL + GET_PENDING_DEPLOYMENTS_URL, env, siteName),
                HttpStatus.OK);
    }

    /**
     * Gets the current deployment for a target.
     *
     * @param env      the target's environment
     * @param siteName the target's site name
     * @param token the management token
     * @return the pending and current deployments for the target
     * @throws DeployerException if an error occurred
     */
    @RequestMapping(value = GET_CURRENT_DEPLOYMENT_URL, method = RequestMethod.GET)
    public ResponseEntity<Deployment> getCurrentDeployment(@NotBlank @ValidateNoTagsParam
                                                           @ValidateSecurePathParam @PathVariable(ENV_PATH_VAR_NAME) String env,
                                                           @NotBlank @EsapiValidatedParam(type = SITE_ID) @PathVariable(SITE_NAME_PATH_VAR_NAME) String siteName,
                                                           @RequestParam String token)
            throws DeployerException, InvalidManagementTokenException {
        validateToken(token);
        Target target = targetService.getTarget(env, siteName);
        Deployment deployment = target.getCurrentDeployment();

        return new ResponseEntity<>(deployment,
                createResponseHeaders(BASE_URL + GET_CURRENT_DEPLOYMENT_URL, env, siteName),
                HttpStatus.OK);
    }

    /**
     * Gets all deployments for a target (pending and current).
     *
     * @param env      the target's environment
     * @param siteName the target's site name
     * @param token the management token
     * @return the pending and current deployments for the target
     * @throws DeployerException if an error occurred
     */
    @RequestMapping(value = GET_ALL_DEPLOYMENTS_URL, method = RequestMethod.GET)
    public ResponseEntity<Collection<Deployment>> getAllDeployments(
            @NotBlank @ValidateNoTagsParam
            @ValidateSecurePathParam @PathVariable(ENV_PATH_VAR_NAME) String env,
            @NotBlank @EsapiValidatedParam(type = SITE_ID) @PathVariable(SITE_NAME_PATH_VAR_NAME) String siteName,
            @RequestParam String token) throws DeployerException, InvalidManagementTokenException {
        validateToken(token);
        Target target = targetService.getTarget(env, siteName);
        Collection<Deployment> deployments = target.getAllDeployments();

        return new ResponseEntity<>(deployments,
                createResponseHeaders(BASE_URL + GET_ALL_DEPLOYMENTS_URL, env, siteName),
                HttpStatus.OK);
    }

    /**
     * Recreates the underlying OpenSearch index for the {@link Target} with the specified environment and site name.
     *
     * @param env      the target's environment
     * @param siteName the target's site name
     * @param token the management token
     * @return the response entity with a 200 OK status
     * @throws DeployerException if an error occurred
     */
    @RequestMapping(value = RECREATE_INDEX_URL, method = RequestMethod.POST)
    public ResponseEntity<Result> recreateIndex(@NotBlank @ValidateNoTagsParam
                                                @ValidateSecurePathParam @PathVariable(ENV_PATH_VAR_NAME) String env,
                                                @NotBlank @EsapiValidatedParam(type = SITE_ID) @PathVariable(SITE_NAME_PATH_VAR_NAME) String siteName,
                                                @RequestParam String token)
			throws DeployerException, InvalidManagementTokenException, ConfigurationException {
        validateToken(token);
        targetService.recreateIndex(env, siteName);

        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Result.OK);
    }

    /**
     * Creates a parameters map from a {@link CreateTargetRequest} object
     *
     * @param createRequest the request
     * @param token the management token
     * @return a map containing the necessary properties to invoke the create target
     */
    private Map<String, Object> getTemplateParams(TargetTemplateParams createRequest) {
        Map<String, Object> templateParams = new HashMap<>();
        templateParams.put(REPO_URL_PARAM_NAME, createRequest.getRepoUrl());
        templateParams.put(REPO_BRANCH_PARAM_NAME, createRequest.getRepoBranch());
        templateParams.put(REPO_USERNAME_PARAM_NAME, createRequest.getRepoUsername());
        templateParams.put(SSH_PRIVATE_KEY_PATH_PARAM_NAME, createRequest.getSshPrivateKeyPath());
        templateParams.put(ENGINE_URL_PARAM_NAME, createRequest.getEngineUrl());
        templateParams.put(NOTIFICATION_ADDRESSESS_PARAM_NAME, createRequest.getNotificationAddresses());
        templateParams.putAll(createRequest.getExtraParams());

        return templateParams;
    }

    protected ResponseEntity<Result> createTarget(CreateTargetRequest createRequest, boolean createIfNotExists)
            throws DeployerException {
        final String env = createRequest.getEnv();
        final String siteName = createRequest.getSiteName();
        final TargetTemplateParams params = createRequest.getTargetTemplateParams();
        final boolean replace = params.isReplace();
        final String templateName = params.getTemplateName();
        Map<String, Object> templateParams = getTemplateParams(params);

        if (createIfNotExists) {
            if (!targetService.targetExists(env, siteName)) {
                targetService.createTarget(env, siteName, false, templateName, templateParams);
            }
        } else {
            targetService.createTarget(env, siteName, replace, templateName, templateParams);
        }

        return new ResponseEntity<>(Result.OK,
                createResponseHeaders(BASE_URL + GET_TARGET_URL, env, siteName),
                HttpStatus.CREATED);
    }

    protected HttpHeaders createResponseHeaders(String locationUrlTemplate, Object... variables) {
        return RestServiceUtils.setLocationHeader(new HttpHeaders(), locationUrlTemplate, variables);
    }

    @ResponseStatus(HttpStatus.OK)
    @PostMapping(UNLOCK_TARGET_URL)
    public void unlockTarget(@ValidateSecurePathParam @ValidateNoTagsParam @PathVariable(ENV_PATH_VAR_NAME) String env,
                             @EsapiValidatedParam(type = SITE_ID) @PathVariable(SITE_NAME_PATH_VAR_NAME) String siteName,
                             @RequestParam String token)
            throws TargetNotFoundException, TargetServiceException, InvalidManagementTokenException {
        validateToken(token);
        Target target = targetService.getTarget(env, siteName);
        target.unlock();
    }

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping(DUPLICATE_TARGET_URL)
    public ResponseEntity<Result> duplicateTarget(@NotEmpty @ValidSiteId @PathVariable(ENV_PATH_VAR_NAME) String env,
            @ValidSiteId @PathVariable(SITE_NAME_PATH_VAR_NAME) String sourceSiteName,
            @Valid @RequestBody DuplicateTargetRequest duplicateTargetRequest,
            @RequestParam String token)
            throws TargetServiceException, TargetAlreadyExistsException, TargetNotFoundException,
            InvalidManagementTokenException {
        validateToken(token);

        final TargetTemplateParams params = duplicateTargetRequest.getTargetTemplateParams();
        targetService.duplicateTarget(env, sourceSiteName, duplicateTargetRequest.getSiteName(),
                params.isReplace(), params.getTemplateName(), getTemplateParams(params));

        return ResponseEntity.status(HttpStatus.CREATED).body(Result.OK);
    }

    protected void validateToken(String token) throws InvalidManagementTokenException {
        if (StringUtils.isEmpty(token) || !Strings.CS.equals(token, managementToken)) {
            throw new InvalidManagementTokenException("Management authorization failed, invalid token.");
        }
    }

}
