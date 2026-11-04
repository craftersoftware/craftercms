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
package org.craftercms.studio.impl.v2.deployment;

import org.craftercms.commons.rest.RestServiceException;
import org.craftercms.commons.rest.RestTemplate;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.model.deployer.DuplicateTargetRequest;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.RequestEntity;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClientException;

import java.util.HashMap;
import java.util.Map;

import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_MANAGEMENT_DEPLOYER_AUTHORIZATION_TOKEN;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.PREVIEW_DUPLICATE_TARGET_URL;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.SERVERLESS_DELIVERY_DEPLOYER_TARGET_CREATE_URL;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.SERVERLESS_DELIVERY_DEPLOYER_TARGET_DELETE_URL;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.SERVERLESS_DELIVERY_DEPLOYER_TARGET_ENV;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.SERVERLESS_DELIVERY_DEPLOYER_TARGET_LOCAL_REPO_PATH;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.SERVERLESS_DELIVERY_DEPLOYER_TARGET_REMOTE_REPO_URL;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.SERVERLESS_DELIVERY_DEPLOYER_TARGET_REPLACE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.SERVERLESS_DELIVERY_DEPLOYER_TARGET_TEMPLATE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.SERVERLESS_DELIVERY_ENABLED;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@RunWith(MockitoJUnitRunner.class)
public class ServerlessDeliveryDeployerTest {

	private static final String SITE = "editorial";
	private static final String STAGING_SITE = SITE + ServerlessDeliveryDeployer.STAGING_TARGET_SUFFIX;
	private static final String CREATE_URL = "http://localhost:9191/api/1/target/create_if_not_exists";
	private static final String DELETE_URL = "http://localhost:9191/api/1/target/delete-if-exists/{siteEnv}/{siteName}";
	private static final String DUPLICATE_URL = "http://localhost:9191/api/1/target/duplicate/{siteEnv}/{siteName}";

	@Mock
	private StudioConfiguration studioConfiguration;
	@Mock
	private RestTemplate restTemplate;
	@Mock
	private ServicesConfig servicesConfig;

	private ServerlessDeliveryDeployer deployer;

	@Before
	public void setUp() throws Exception {
		when(studioConfiguration.getProperty(SERVERLESS_DELIVERY_ENABLED, Boolean.class, false)).thenReturn(true);
		when(studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_ENV)).thenReturn("serverless-delivery");
		when(studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_TEMPLATE)).thenReturn("aws-cloudformed-s3");
		when(studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_REPLACE, Boolean.class, false)).thenReturn(false);
		when(studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_REMOTE_REPO_URL))
			.thenReturn("file:///data/repos/sites/{siteName}/published");
		when(studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_LOCAL_REPO_PATH))
			.thenReturn("file:///data/repos/aws/{siteName}");
		when(studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_CREATE_URL)).thenReturn(CREATE_URL);
		when(studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_DELETE_URL)).thenReturn(DELETE_URL);
		when(studioConfiguration.getProperty(PREVIEW_DUPLICATE_TARGET_URL)).thenReturn(DUPLICATE_URL);
		when(studioConfiguration.getProperty(CONFIGURATION_MANAGEMENT_DEPLOYER_AUTHORIZATION_TOKEN)).thenReturn("token");
		when(servicesConfig.getStagingEnvironment(SITE)).thenReturn("staging");
		when(servicesConfig.isStagingEnvironmentEnabled(SITE)).thenReturn(true);
		deployer = new ServerlessDeliveryDeployer(studioConfiguration, restTemplate) {
			@Override
			protected Map<String, Object> getSourceTemplateParams(String sourceSiteId) {
				return new HashMap<>();
			}
		};
		deployer.setServicesConfig(servicesConfig);
	}

	@Test
	public void createStagingTargetSkippedWhenServerlessDisabled() {
		when(studioConfiguration.getProperty(SERVERLESS_DELIVERY_ENABLED, Boolean.class, false)).thenReturn(false);

		deployer.createStagingTarget(SITE);

		verify(restTemplate, never()).exchange(any(), eq(Map.class));
	}

	@Test
	@SuppressWarnings("unchecked")
	public void createStagingTargetUsesStagingBranchAndSiteName() {
		deployer.createStagingTarget(SITE);

		ArgumentCaptor<RequestEntity<Map<String, Object>>> captor = ArgumentCaptor.forClass(RequestEntity.class);
		verify(restTemplate).exchange(captor.capture(), eq(Map.class));
		Map<String, Object> body = captor.getValue().getBody();
		assertEquals(STAGING_SITE, body.get("site_name"));
		assertEquals("staging", body.get("repo_branch"));
		assertEquals("serverless-delivery", body.get("env"));
		assertEquals(false, body.get("replace"));
		assertEquals(CREATE_URL, captor.getValue().getUrl().toString());
		assertTrue(body.get("repo_url").toString().contains("/repos/sites/" + SITE + "/published"));
		assertTrue(body.get("local_repo_path").toString().contains("/repos/aws/" + STAGING_SITE));
	}

	@Test
	@SuppressWarnings("unchecked")
	public void createStagingTargetIsSafeToRepeat() {
		deployer.createStagingTarget(SITE);
		deployer.createStagingTarget(SITE);

		ArgumentCaptor<RequestEntity<Map<String, Object>>> captor = ArgumentCaptor.forClass(RequestEntity.class);
		verify(restTemplate, times(2)).exchange(captor.capture(), eq(Map.class));
		captor.getAllValues().forEach(request -> {
			assertEquals(CREATE_URL, request.getUrl().toString());
			assertEquals(false, request.getBody().get("replace"));
		});
	}

	@Test
	@SuppressWarnings("unchecked")
	public void createStagingTargetDoesNotUseConfiguredReplace() {
		lenient().when(studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_REPLACE, Boolean.class, false))
			.thenReturn(true);

		deployer.createStagingTarget(SITE);

		ArgumentCaptor<RequestEntity<Map<String, Object>>> captor = ArgumentCaptor.forClass(RequestEntity.class);
		verify(restTemplate).exchange(captor.capture(), eq(Map.class));
		assertEquals(false, captor.getValue().getBody().get("replace"));
	}

	@Test
	public void createStagingTargetTreatsExistingTargetAsSuccess() {
		when(restTemplate.exchange(any(), eq(Map.class)))
			.thenThrow(new RestServiceException(HttpStatus.CONFLICT, "Target already exists"));

		deployer.createStagingTarget(SITE);

		verify(restTemplate).exchange(any(), eq(Map.class));
	}

	@Test
	public void createStagingTargetTreatsHttpConflictAsSuccess() {
		when(restTemplate.exchange(any(), eq(Map.class)))
			.thenThrow(HttpClientErrorException.create(HttpStatus.CONFLICT, "Target already exists",
				HttpHeaders.EMPTY, new byte[0], null));

		deployer.createStagingTarget(SITE);

		verify(restTemplate).exchange(any(), eq(Map.class));
	}

	@Test
	public void createStagingTargetPropagatesDeployerFailure() {
		RestServiceException deployerError = new RestServiceException(HttpStatus.INTERNAL_SERVER_ERROR, "Deployer is down");
		when(restTemplate.exchange(any(), eq(Map.class))).thenThrow(deployerError);

		RestClientException error = assertThrows(RestClientException.class, () -> deployer.createStagingTarget(SITE));

		assertEquals(deployerError, error);
	}

	@Test
	public void deleteTargetsRemovesLiveAndStaging() {
		deployer.deleteTargets(SITE);

		ArgumentCaptor<RequestEntity<?>> captor = ArgumentCaptor.forClass(RequestEntity.class);
		verify(restTemplate, times(2)).exchange(captor.capture(), eq(Map.class));
		assertTrue(captor.getAllValues().get(0).getUrl().toString().endsWith("/serverless-delivery/" + SITE));
		assertTrue(captor.getAllValues().get(1).getUrl().toString().endsWith("/serverless-delivery/" + STAGING_SITE));
	}

	@Test
	public void deleteTargetsSkipsStagingWhenStagingDisabled() throws Exception {
		when(servicesConfig.isStagingEnvironmentEnabled(SITE)).thenReturn(false);

		deployer.deleteTargets(SITE);

		ArgumentCaptor<RequestEntity<?>> captor = ArgumentCaptor.forClass(RequestEntity.class);
		verify(restTemplate).exchange(captor.capture(), eq(Map.class));
		assertTrue(captor.getValue().getUrl().toString().endsWith("/serverless-delivery/" + SITE));
	}

	@Test
	public void deleteTargetsRemovesStagingWhenSiteRecordIsGone() throws Exception {
		when(servicesConfig.isStagingEnvironmentEnabled(SITE)).thenThrow(new SiteNotFoundException(SITE));

		deployer.deleteTargets(SITE);

		ArgumentCaptor<RequestEntity<?>> captor = ArgumentCaptor.forClass(RequestEntity.class);
		verify(restTemplate, times(2)).exchange(captor.capture(), eq(Map.class));
		assertTrue(captor.getAllValues().get(1).getUrl().toString().endsWith("/serverless-delivery/" + STAGING_SITE));
	}

	@Test
	@SuppressWarnings("unchecked")
	public void deleteTargetsIgnoresMissingStagingTarget() throws Exception {
		when(servicesConfig.isStagingEnvironmentEnabled(SITE)).thenThrow(new SiteNotFoundException(SITE));
		when(restTemplate.exchange(any(), eq(Map.class))).thenAnswer(invocation -> {
			RequestEntity<?> request = invocation.getArgument(0);
			if (request.getUrl().toString().endsWith(STAGING_SITE)) {
				throw new RestServiceException(HttpStatus.NOT_FOUND, "Target not found");
			}
			return null;
		});

		deployer.deleteTargets(SITE);

		verify(restTemplate, times(2)).exchange(any(), eq(Map.class));
	}

	@Test
	@SuppressWarnings("unchecked")
	public void deleteTargetsIgnoresHttpNotFoundForMissingStagingTarget() {
		when(restTemplate.exchange(any(), eq(Map.class))).thenAnswer(invocation -> {
			RequestEntity<?> request = invocation.getArgument(0);
			if (request.getUrl().toString().endsWith(STAGING_SITE)) {
				throw HttpClientErrorException.create(HttpStatus.NOT_FOUND, "Target not found",
					HttpHeaders.EMPTY, new byte[0], null);
			}
			return null;
		});

		deployer.deleteTargets(SITE);

		verify(restTemplate, times(2)).exchange(any(), eq(Map.class));
	}

	@Test
	@SuppressWarnings("unchecked")
	public void deleteTargetsPropagatesStagingDeleteFailure() {
		RestServiceException deployerError = new RestServiceException(HttpStatus.INTERNAL_SERVER_ERROR, "Deployer is down");
		when(restTemplate.exchange(any(), eq(Map.class))).thenAnswer(invocation -> {
			RequestEntity<?> request = invocation.getArgument(0);
			if (request.getUrl().toString().endsWith(STAGING_SITE)) {
				throw deployerError;
			}
			return null;
		});

		RestClientException error = assertThrows(RestClientException.class, () -> deployer.deleteTargets(SITE));

		assertEquals(deployerError, error);
	}

	@Test
	public void duplicateStagingTargetUsesStagingSiteNames() throws Exception {
		when(servicesConfig.getStagingEnvironment("the-copy")).thenReturn("staging");

		deployer.duplicateStagingTarget(SITE, "the-copy");

		ArgumentCaptor<RequestEntity<DuplicateTargetRequest>> captor = ArgumentCaptor.forClass(RequestEntity.class);
		verify(restTemplate).exchange(captor.capture(), eq(Map.class));
		assertTrue(captor.getValue().getUrl().toString().contains("/serverless-delivery/" + STAGING_SITE));
		assertEquals("the-copy-staging", captor.getValue().getBody().getSiteName());
		assertEquals("staging", captor.getValue().getBody().getTemplateParams().get("repo_branch"));
	}
}
