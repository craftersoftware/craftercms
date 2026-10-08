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

package org.craftercms.studio.impl.v2.service.configuration.internal;

import org.apache.commons.io.IOUtils;
import org.craftercms.studio.api.v1.service.content.ContentService;
import org.craftercms.studio.api.v2.exception.configuration.InvalidConfigurationException;
import org.junit.Test;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

public class ConfigurationServiceInternalImplValidationTest {

	private static final String WELL_FORMED_XML = "<configuration><header>ok</header></configuration>";
	private static final String DOCTYPE_XML = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
			"<!DOCTYPE configuration [<!ENTITY xxe SYSTEM \"file:///etc/hostname\">]>" +
			"<configuration><header>&xxe;</header></configuration>";

	private final ConfigurationServiceInternalImpl service = new ConfigurationServiceInternalImpl();

	@Test
	public void validateAcceptsWellFormedXml() throws Exception {
		InputStream result = service.validate(stream(WELL_FORMED_XML), "site-config.xml");
		assertEquals(WELL_FORMED_XML, IOUtils.toString(result, StandardCharsets.UTF_8));
	}

	@Test
	public void validateRejectsDoctype() {
		assertThrows(InvalidConfigurationException.class, () -> service.validate(stream(DOCTYPE_XML), "global-menu-config.xml"));
	}

	@Test
	public void validateRejectsDoctypeRegardlessOfExtensionCase() {
		assertThrows(InvalidConfigurationException.class, () -> service.validate(stream(DOCTYPE_XML), "site-config.XML"));
	}

	@Test
	public void validateRejectsDoctypeWithoutExtension() {
		assertThrows(InvalidConfigurationException.class, () -> service.validate(stream(DOCTYPE_XML), "config"));
	}

	@Test
	public void validateAllowsNonXmlWithoutExtension() throws Exception {
		String text = "key: value";
		InputStream result = service.validate(stream(text), "config");
		assertEquals(text, IOUtils.toString(result, StandardCharsets.UTF_8));
	}

	@Test
	public void writeConfigurationRejectsExtensionlessDoctypeBeforePersist() {
		ContentService contentService = mock(ContentService.class);
		service.setContentService(contentService);

		assertThrows(InvalidConfigurationException.class, () ->
				service.writeConfiguration("site", "studio", "config", null, stream(DOCTYPE_XML)));
		verifyNoInteractions(contentService);
	}

	@Test
	public void writeConfigurationRejectsDoctypeBeforePersist() {
		ContentService contentService = mock(ContentService.class);
		service.setContentService(contentService);

		assertThrows(InvalidConfigurationException.class, () ->
				service.writeConfiguration("site", "studio", "/config/studio/site-config.xml", null, stream(DOCTYPE_XML)));
		verifyNoInteractions(contentService);
	}

	@Test
	public void writeGlobalConfigurationRejectsDoctypeBeforePersist() {
		ContentService contentService = mock(ContentService.class);
		service.setContentService(contentService);

		assertThrows(InvalidConfigurationException.class, () ->
				service.writeGlobalConfiguration("/configuration/global-menu-config.xml", stream(DOCTYPE_XML)));
		verifyNoInteractions(contentService);
	}

	private static ByteArrayInputStream stream(String content) {
		return new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8));
	}

}
