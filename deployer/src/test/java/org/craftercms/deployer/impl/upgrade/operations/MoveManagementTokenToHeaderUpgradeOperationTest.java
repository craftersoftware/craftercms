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
		Map<String, Object> processor = processor("http://engine/clear?token=from-url&crafterSite=editorial");
		List<Object> headers = new ArrayList<>();
		Map<String, Object> header = new LinkedHashMap<>();
		header.put("name", ManagementToken.HEADER_NAME);
		header.put("value", "already-set");
		headers.add(header);
		processor.put("headers", headers);

		operation.doExecute(target, targetConfig(processor));

		assertEquals("http://engine/clear?crafterSite=editorial", processor.get("url"));
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
