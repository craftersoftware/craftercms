/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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
package org.craftercms.studio.impl.v2.deployment;

import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.configuration2.interpol.ConfigurationInterpolator;
import org.apache.commons.configuration2.tree.ImmutableNode;
import org.apache.commons.lang3.StringUtils;
import org.craftercms.commons.collections.MapUtils;
import org.craftercms.commons.rest.RestTemplate;
import org.craftercms.studio.api.v2.deployment.Deployer;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.model.deployer.DuplicateTargetRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.RequestEntity;
import org.springframework.web.client.RestClientException;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.craftercms.studio.api.v1.constant.StudioConstants.CONFIG_SITEENV_VARIABLE;
import static org.craftercms.studio.api.v1.constant.StudioConstants.CONFIG_SITENAME_VARIABLE;	
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.PREVIEW_DUPLICATE_TARGET_URL;

/**
 * Base abstract class for {@link Deployer}s. Provides the commons methods that call the Deployer APIs.
 *
 * @author avasquez
 */
public abstract class AbstractDeployer implements Deployer {

    protected static final String ENV_TEMPLATE_PARAM = "env";
    protected static final String SITE_NAME_TEMPLATE_PARAM = "site_name";
    protected static final String TEMPLATE_NAME_TEMPLATE_PARAM = "template_name";
    protected static final String REPLACE_TEMPLATE_PARAM = "replace";
    protected static final String DISABLE_DEPLOY_CRON_TEMPLATE_PARAM = "disable_deploy_cron";
    protected static final String SOURCE_TEMPLATE_PARAM = "source";
    protected static final String REPO_URL_TEMPLATE_PARAM = "repo_url";
    protected static final String LOCAL_REPO_PATH_TEMPLATE_PARAM = "local_repo_path";
    protected static final String DEPLOYER_AUTHORIZATION_TOKEN_TEMPLATE_PARAM = "token";


    private final static Logger logger = LoggerFactory.getLogger(AbstractDeployer.class);

    protected final RestTemplate restTemplate;
    protected final StudioConfiguration studioConfiguration;

    public AbstractDeployer(final StudioConfiguration studioConfiguration, final RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
        this.studioConfiguration = studioConfiguration;
    }

    protected void doCreateTarget(String site, String environment, String template,
                                  boolean replace, boolean disableDeployCron, String localRepoPath,
                                  String repoUrl, HierarchicalConfiguration<ImmutableNode> additionalParams)
            throws IllegalStateException, RestClientException {
        String requestUrl = getCreateTargetUrl();
        Map<String, Object> requestBody = getCreateTargetRequestBody(site, environment, template,
                replace, disableDeployCron, localRepoPath,
                repoUrl, additionalParams);
        try {
            RequestEntity<Map<String, Object>> requestEntity = RequestEntity.post(new URI(requestUrl))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody);

            logger.debug("Call create target API '{}' for site '{}' publishing target '{}'",
                    requestEntity, site, environment);

            restTemplate.exchange(requestEntity, Map.class);
        } catch (URISyntaxException e) {
            logger.error("Invalid format of create target URL '{}' for site '{}' publishing target '{}'",
                    requestUrl, site, environment, e);
            throw new IllegalStateException("Invalid format of create target URL: " + requestUrl, e);
        }
    }

    protected void doDeleteTarget(String site, String environment) {
        String requestUrl = getDeleteTargetUrl(site, environment);

        try {
            RequestEntity<Void> requestEntity = RequestEntity.post(new URI(requestUrl))
                    .contentType(MediaType.APPLICATION_JSON)
                    .build();

            logger.debug("Call delete target API '{}' for site '{}' publishing target '{}'",
                    requestEntity, site, environment);

            restTemplate.exchange(requestEntity, Map.class);
        } catch (URISyntaxException e) {
            logger.error("Invalid format of delete target URL '{}' for site '{}' publishing target '{}'",
                    requestUrl, site, environment, e);
            throw new IllegalStateException("Invalid format of delete target URL: " + requestUrl, e);
        }
    }

    protected Map<String, Object> getCreateTargetRequestBody(String site, String environment,
                                                             String template, boolean replace, boolean disableDeployCron,
                                                             String localRepoPath, String repoUrl,
                                                             HierarchicalConfiguration<ImmutableNode> additionalParams) {

        Map<String, Object> requestBody = new LinkedHashMap<>();
        requestBody.put(ENV_TEMPLATE_PARAM, environment);
        requestBody.put(SITE_NAME_TEMPLATE_PARAM, site);
        requestBody.put(TEMPLATE_NAME_TEMPLATE_PARAM, template);
        requestBody.put(REPLACE_TEMPLATE_PARAM, replace);
        requestBody.put(DISABLE_DEPLOY_CRON_TEMPLATE_PARAM, disableDeployCron);

        if (StringUtils.isNotEmpty(localRepoPath)) {
            requestBody.put(LOCAL_REPO_PATH_TEMPLATE_PARAM, localRepoPath);
        }
        if (StringUtils.isNotEmpty(repoUrl)) {
            requestBody.put(REPO_URL_TEMPLATE_PARAM, repoUrl);
        }
        if (additionalParams != null) {
            addAdditionalParams(requestBody, additionalParams);
        }

        return requestBody;
    }

    /**
     * Get the body parameters for the duplicate-target request.
     *
     * @param sourceSite        the site to duplicate from
     * @param site              the new site
     * @param environment       the target environment, e.g.: authoring
     * @param template          the deployer target template
     * @param replace           true to replace the target if it already exists
     * @param disableDeployCron true to disable the deploy cron (e.g. for preview target)
     * @param localRepoPath     the local path to clone the repository. // TODO: this is used for serverless only, should this be a deployer config instead?)
     * @param repoUrl           the repository URL
     * @param additionalParams  additional parameters to pass to the deployer to be consumed by the target template
     * @return a {@link Map} containing the parameters, preserving the hierarchical structure of the configuration parameters
     */
    protected Map<String, Object> getDuplicateTargetRequestBody(String sourceSite, String site, String environment,
                                                                String template, boolean replace, boolean disableDeployCron,
                                                                String localRepoPath, String repoUrl,
                                                                HierarchicalConfiguration<ImmutableNode> additionalParams) {
        Map<String, Object> createTargetRequestBody = getCreateTargetRequestBody(site, environment, template, replace, disableDeployCron,
                localRepoPath, repoUrl, additionalParams);
        MapUtils.add(createTargetRequestBody, SOURCE_TEMPLATE_PARAM, getSourceTemplateParams(sourceSite));
        return createTargetRequestBody;
    }

    /**
     * Get a source site parameters Map to pass to the target template.
     * This is useful for deployer to get context on the duplicate source site
     *
     * @param sourceSite the source site to duplicate from
     * @return a {@link Map} containing the parameters
     */
    protected Map<String, Object> getSourceTemplateParams(String sourceSite) {
        return new HashMap<>();
    }

    protected void addAdditionalParams(Map<String, Object> params,
                                       HierarchicalConfiguration<ImmutableNode> additionalParams) {
        addChildParams(params, additionalParams.getNodeModel().getNodeHandler().getRootNode(),
                additionalParams.getInterpolator());
    }

    protected void addChildParams(Map<String, Object> childParams, ImmutableNode parentNode,
                                  ConfigurationInterpolator interpolator) {
        for (ImmutableNode childParamNode : parentNode.getChildren()) {
            if (childParamNode.getChildren().isEmpty()) {
                Object value = interpolator.interpolate(childParamNode.getValue());
                MapUtils.add(childParams, childParamNode.getNodeName(), value);
            } else {
                Map<String, Object> params = new LinkedHashMap<>();
                addChildParams(params, childParamNode, interpolator);

                MapUtils.add(childParams, childParamNode.getNodeName(), params);
            }
        }
    }

    protected String getRepoUrl(String configKey, String site) {
        String repoUrl = studioConfiguration.getProperty(configKey);
        if (StringUtils.isNotEmpty(repoUrl)) {
            repoUrl = repoUrl.replaceAll(CONFIG_SITENAME_VARIABLE, site);

            try {
                return new URI(repoUrl).normalize().toString();
            } catch (URISyntaxException e) {
                throw new IllegalStateException(
                        "Invalid format of URL for config key '" + configKey + "': " + repoUrl, e);
            }
        } else {
            return "";
        }
    }

    /**
     * Call Deployer API to duplicate a given target
     *
     * @param sourceSiteId      the site to duplicate from
     * @param siteId            the new site id
     * @param env               the target environment, e.g.: authoring
     * @param template          the deployer target template
     * @param replace           true to replace the target if it already exists
     * @param disableDeployCron true to disable the deploy cron (e.g. for preview target)
     * @param localRepoPath     the local path to clone the repository. // TODO: this is used for serverless only, should this be a deployer config instead?)
     * @param repoUrl           the repository URL
     * @param additionalParams  additional parameters to pass to the deployer to be consumed by the target template
     * @throws RestClientException if an error occurs while calling Deployer API
     */
    protected void doDuplicateTarget(String sourceSiteId, String siteId, String env, String template,
                                     boolean replace, boolean disableDeployCron, String localRepoPath,
                                     String repoUrl, HierarchicalConfiguration<ImmutableNode> additionalParams) throws RestClientException {
        String requestUrl = getDuplicateTargetUrl(sourceSiteId, env);
        DuplicateTargetRequest requestBody = new DuplicateTargetRequest(siteId,
                getDuplicateTargetRequestBody(sourceSiteId, siteId, env, template, replace, disableDeployCron, localRepoPath, repoUrl, additionalParams));
        RequestEntity<DuplicateTargetRequest> requestEntity = RequestEntity.post(URI.create(requestUrl))
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody);

        logger.debug("Call duplicate target API. From site '{}' to site '{}' publishing target '{}'",
                sourceSiteId, siteId, env);
        restTemplate.exchange(requestEntity, Map.class);
    }

    /**
     * Get the URL of the Deployer API to duplicate a given target
     *
     * @param sourceSiteId the site to duplicate from
     * @param env          the target environment, e.g.: authoring
     * @return the URL of the Deployer API to duplicate a given target
     */
    protected String getDuplicateTargetUrl(String sourceSiteId, String env) {
        return studioConfiguration.getProperty(PREVIEW_DUPLICATE_TARGET_URL)
                .replaceAll(CONFIG_SITENAME_VARIABLE, sourceSiteId)
                .replaceAll(CONFIG_SITEENV_VARIABLE, env);
    }

    protected abstract String getCreateTargetUrl();

    protected abstract String getDeleteTargetUrl(String site, String environment);

}
