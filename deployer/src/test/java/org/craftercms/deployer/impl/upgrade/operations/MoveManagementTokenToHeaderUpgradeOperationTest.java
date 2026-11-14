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
package org.craftercms.deployer.impl.upgrade.operations;

import org.craftercms.commons.rest.ManagementToken;
import org.craftercms.deployer.api.Target;
import org.junit.Before;
import org.junit.Test;
import org.mockito.invocation.Invocation;
import org.slf4j.Logger;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockingDetails;
import static org.mockito.Mockito.when;

public class MoveManagementTokenToHeaderUpgradeOperationTest {

	private static final String SECRET = "super-secret-token";

	private MoveManagementTokenToHeaderUpgradeOperation operation;
	private Target target;
	private Logger logger;

	@Before
	public void setUp() {
		operation = new MoveManagementTokenToHeaderUpgradeOperation();
		logger = mock(Logger.class);
		ReflectionTestUtils.setField(operation, "logger", logger);
		target = mock(Target.class);
		when(target.getId()).thenReturn("editorial-default");
	}

	@Test
	public void crafterSiteIsPreservedAndSecretIsNotLogged() {
		Map<String, Object> processor = processor(
			"http://engine/api/1/site/cache/clear.json?crafterSite=${target.siteName}&token=" + SECRET);
		Map<String, Object> other = processor("http://engine/rebuild?token=" + SECRET);
		other.put("processorName", "gitPullProcessor");
		Map<String, Object> config = targetConfig(processor, other);

		operation.doExecute(target, config);

		assertEquals("http://engine/api/1/site/cache/clear.json?crafterSite=${target.siteName}", processor.get("url"));
		assertEquals("http://engine/rebuild?token=" + SECRET, other.get("url"));
		assertHeader(processor, SECRET);
		String logged = loggedText();
		assertFalse(logged.contains(SECRET));
		assertFalse(logged.contains("gitPullProcessor"));
	}

	@Test
	public void tokenInTheMiddleKeepsSurroundingParameters() {
		Map<String, Object> processor = processor(
			"http://engine/api/1/site/context/rebuild.json?foo=1&token=${target.engineManagementToken}&crafterSite=${target.siteName}");
		operation.doExecute(target, targetConfig(processor));

		assertEquals(
			"http://engine/api/1/site/context/rebuild.json?foo=1&crafterSite=${target.siteName}",
			processor.get("url"));
		assertHeader(processor, "${target.engineManagementToken}");
		assertFalse(loggedText().contains("${target.engineManagementToken}"));
	}

	@Test
	public void existingHeaderIsKeptAndQueryTokenIsRemoved() {
		Map<String, Object> processor = processor(
			"http://engine/api/1/site/cache/clear.json?token=from-url&crafterSite=editorial");
		List<Object> headers = new ArrayList<>();
		Map<String, Object> header = new LinkedHashMap<>();
		header.put("name", ManagementToken.HEADER_NAME);
		header.put("value", "already-set");
		headers.add(header);
		processor.put("headers", headers);

		operation.doExecute(target, targetConfig(processor));

		assertEquals("http://engine/api/1/site/cache/clear.json?crafterSite=editorial", processor.get("url"));
		assertEquals(1, headers.size());
		assertEquals("already-set", header.get("value"));
	}

	@Test
	public void urlWithoutTokenIsUnchanged() {
		Map<String, Object> processor = processor("http://engine/clear?crafterSite=editorial");
		operation.doExecute(target, targetConfig(processor));

		assertEquals("http://engine/clear?crafterSite=editorial", processor.get("url"));
		assertNull(processor.get("headers"));
	}

	@Test
	public void knownManagementEndpointsAreMigrated() {
		assertMigrated(
			"http://engine/api/1/site/context/destroy.json?token=" + SECRET,
			"http://engine/api/1/site/context/destroy.json",
			SECRET);
		assertMigrated(
			"http://engine/api/1/monitoring/status.json?crafterSite=editorial&token=" + SECRET,
			"http://engine/api/1/monitoring/status.json?crafterSite=editorial",
			SECRET);
		assertMigrated(
			"${target.studioUrl}/api/2/plugin/${target.siteName}/script/reload.json?token=${target.studioManagementToken}",
			"${target.studioUrl}/api/2/plugin/${target.siteName}/script/reload.json",
			"${target.studioManagementToken}");
		assertMigrated(
			"http://deployer/api/1/target/deploy/dev/editorial?token=" + SECRET,
			"http://deployer/api/1/target/deploy/dev/editorial",
			SECRET);
		assertMigrated(
			"http://studio/api/2/management/sites?token=" + SECRET,
			"http://studio/api/2/management/sites",
			SECRET);
	}

	@Test
	public void unrelatedTokenParametersAreUnchanged() {
		String[] urls = {
			"https://hooks.example/callback?token=" + SECRET + "&keep=1",
			"http://engine/api/1/site/search/search.json?token=" + SECRET + "&crafterSite=editorial",
			"${target.studioUrl}/api/2/plugin/${target.siteName}/script/notify.json?token=" + SECRET,
			"http://engine/rebuild?token=" + SECRET
		};
		for (String url : urls) {
			Map<String, Object> processor = processor(url);
			operation.doExecute(target, targetConfig(processor));
			assertEquals(url, processor.get("url"));
			assertNull(processor.get("headers"));
		}
		assertFalse(loggedText().contains(SECRET));
	}

	@Test
	public void customCallbackIsMigratedWhenOptedIn() {
		Map<String, Object> processor = processor(
			"https://hooks.example/callback?token=" + SECRET + "&keep=1");
		processor.put("migrateManagementToken", true);

		operation.doExecute(target, targetConfig(processor));

		assertEquals("https://hooks.example/callback?keep=1", processor.get("url"));
		assertHeader(processor, SECRET);
		assertNull(processor.get("migrateManagementToken"));
		assertFalse(loggedText().contains(SECRET));
	}

	@Test
	public void percentEncodedTokenIsDecodedForTheHeader() {
		Map<String, Object> processor = processor(
			"http://engine/api/1/site/cache/clear.json?token=p%40ss%2Bword+tail%20end");

		operation.doExecute(target, targetConfig(processor));

		assertEquals("http://engine/api/1/site/cache/clear.json", processor.get("url"));
		assertHeader(processor, "p@ss+word+tail end");
		assertFalse(loggedText().contains("p@ss+word+tail end"));
		assertFalse(loggedText().contains("p%40ss%2Bword+tail%20end"));
	}

	@Test
	public void queryValueDecodingPreservesPlaceholdersAndPlus() {
		assertEquals("a+b", tokenValue("token=a+b"));
		assertEquals("+", tokenValue("token=%2B"));
		assertEquals("+", tokenValue("token=%2b"));
		assertEquals("caf\u00e9", tokenValue("token=caf%C3%A9"));
		assertEquals("${target.engineManagementToken}", tokenValue("token=${target.engineManagementToken}"));
		assertEquals("${foo%2Bbar}+${target.engineManagementToken}",
			tokenValue("token=${foo%2Bbar}%2B${target.engineManagementToken}"));
		assertEquals("${outer:${inner%2B}}", tokenValue("token=${outer:${inner%2B}}"));
		assertEquals("${foo%2B", tokenValue("token=${foo%2B"));
		assertEquals("${target.engineManagementToken}",
			tokenValue("token=%24%7Btarget.engineManagementToken%7D"));
		assertEquals("100%", tokenValue("token=100%"));
		assertEquals("100%2", tokenValue("token=100%2"));
		assertEquals("100%ZZ", tokenValue("token=100%ZZ"));
		assertEquals("%C3%41", tokenValue("token=%C3%41"));
		assertEquals("a+b", tokenValue("token=a%2Bb&token=c%2Bd"));
	}

	private void assertMigrated(String original, String expectedUrl, String expectedToken) {
		Map<String, Object> processor = processor(original);
		operation.doExecute(target, targetConfig(processor));
		assertEquals(expectedUrl, processor.get("url"));
		assertHeader(processor, expectedToken);
	}

	private String tokenValue(String query) {
		MoveManagementTokenToHeaderUpgradeOperation.TokenMove move =
			MoveManagementTokenToHeaderUpgradeOperation.extractToken(
				"http://engine/api/1/site/cache/clear.json?" + query);
		return move.tokenValue;
	}

	@SuppressWarnings("unchecked")
	private void assertHeader(Map<String, Object> processor, String expectedValue) {
		List<Map<String, Object>> headers = (List<Map<String, Object>>) processor.get("headers");
		assertEquals(1, headers.size());
		assertEquals(ManagementToken.HEADER_NAME, headers.get(0).get("name"));
		assertEquals(expectedValue, headers.get(0).get("value"));
	}

	private Map<String, Object> processor(String url) {
		Map<String, Object> processor = new LinkedHashMap<>();
		processor.put("processorName", "httpMethodCallProcessor");
		processor.put("url", url);
		return processor;
	}

	@SafeVarargs
	private Map<String, Object> targetConfig(Map<String, Object>... processors) {
		List<Map<String, Object>> pipeline = new ArrayList<>();
		for (Map<String, Object> processor : processors) {
			pipeline.add(processor);
		}
		Map<String, Object> deployment = new LinkedHashMap<>();
		deployment.put("pipeline", pipeline);
		Map<String, Object> targetObj = new LinkedHashMap<>();
		targetObj.put("deployment", deployment);
		Map<String, Object> config = new LinkedHashMap<>();
		config.put("target", targetObj);
		return config;
	}

	private String loggedText() {
		StringBuilder logged = new StringBuilder();
		for (Invocation invocation : mockingDetails(logger).getInvocations()) {
			for (Object argument : invocation.getArguments()) {
				logged.append(argument).append('\n');
				if (argument instanceof Object[] values) {
					for (Object value : values) {
						logged.append(value).append('\n');
					}
				}
			}
		}
		return logged.toString();
	}

}
