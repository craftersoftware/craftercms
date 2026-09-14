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

package org.craftercms.studio.impl.v2.service.content.internal;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.craftercms.studio.api.v1.exception.ContentNotFoundException;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v2.dal.security.NormalizedRole;
import org.craftercms.studio.api.v2.service.config.ConfigurationService;
import org.craftercms.studio.api.v2.service.content.ContentService;
import org.craftercms.studio.model.contentType.ContentType;
import org.craftercms.studio.model.contentType.CopyDependency;
import org.craftercms.studio.model.contentType.DeleteDependency;
import org.dom4j.Document;
import org.dom4j.DocumentHelper;
import org.dom4j.Element;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashSet;
import java.util.List;
import java.util.stream.StreamSupport;

import static java.util.stream.Collectors.toSet;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@RunWith(MockitoJUnitRunner.class)
public class ContentTypeServiceInternalImplTest {
	private static final String SITE_ID = "mySite";
	private static final String CONTENT_TYPE = "myContentType";
	private static final String CONTENT_TYPE_WITH_FORM_CONTROLLER = "myTypeWithFormController";
	private static final String CONTENT_TYPE_DEFINITION_FILENAME = "form-definition.xml";
	private static final String FORM_DEFINITION_ROOT = "form";
	private static final String FORM_DEFINITION_IMAGE_THUMBNAIL = "imageThumbnail";
	private static final String FORM_DEFINITION_PREVIEW_IMAGE = "testImage.png";
	private static final String CONTENT_TYPE_BASE_PATH = "/config/studio/content-types";
	private static final String CONTENT_TYPE_BASE_PATH_PATTERN = CONTENT_TYPE_BASE_PATH + "/{content-type}";
	private static final String CONTENT_TYPE_DEFINITION_PATH = CONTENT_TYPE_BASE_PATH + "/" + CONTENT_TYPE + "/" + CONTENT_TYPE_DEFINITION_FILENAME;
	private static final String CONTENT_TYPE_WITH_CONTROLLER_DEFINITION_PATH = CONTENT_TYPE_BASE_PATH + "/" + CONTENT_TYPE_WITH_FORM_CONTROLLER + "/" + CONTENT_TYPE_DEFINITION_FILENAME;
	private static final String CONTENT_TYPE_PREVIEW_IMAGE_PATH = CONTENT_TYPE_BASE_PATH + "/" + CONTENT_TYPE + "/" + FORM_DEFINITION_PREVIEW_IMAGE;

	private static final String CONTENT_TYPE_WITHOUT_IMAGE = "noImageContentType";
	private static final String CONTENT_TYPE_DEFINITION_PATH_WITHOUT_IMAGE = CONTENT_TYPE_BASE_PATH + "/" + CONTENT_TYPE_WITHOUT_IMAGE +
		"/" + CONTENT_TYPE_DEFINITION_FILENAME;
	private static final String CONTENT_TYPE_DEFAULT_PREVIEW_IMAGE_PATH = "crafter/studio/content-type/default-contentType.jpg";
	private static final String CONTENT_TYPE_FULL_FORM_CONTROLLER_PATH = "/config/studio/content-types/" + CONTENT_TYPE + "/form-controller.js";
	private static final String CONTENT_TYPE_WITH_FORM_CONTROLLER_FULL_FORM_CONTROLLER_PATH = "/config/studio/content-types/" + CONTENT_TYPE_WITH_FORM_CONTROLLER + "/form-controller.js";

	@Mock
	private ConfigurationService configurationService;
	@Mock
	private ContentService contentService;
	@Mock
	Resource resource;
	@InjectMocks
	private ContentTypeServiceInternalImpl service;

	@Before
	public void setUp() throws ServiceLayerException {
		ReflectionTestUtils.setField(service, "contentTypeDefinitionFilename", CONTENT_TYPE_DEFINITION_FILENAME);
		ReflectionTestUtils.setField(service, "contentTypeBasePathPattern", CONTENT_TYPE_BASE_PATH_PATTERN);
		ReflectionTestUtils.setField(service, "previewImageXPath", "/form/imageThumbnail/text()");
		ReflectionTestUtils.setField(service, "contentService", contentService);
		ReflectionTestUtils.setField(service, "defaultPreviewImagePath", CONTENT_TYPE_DEFAULT_PREVIEW_IMAGE_PATH);
		ReflectionTestUtils.setField(service, "formControllerFilePath", "form-controller.js");

		when(configurationService.getConfigurationAsDocument(SITE_ID, null, CONTENT_TYPE_DEFINITION_PATH, null))
			.thenReturn(getDocumentWithPreviewImage());

		when(contentService.getContentAsResource(SITE_ID, CONTENT_TYPE_PREVIEW_IMAGE_PATH))
			.thenReturn(resource);

		when(configurationService.getConfigurationAsDocument(SITE_ID, null, CONTENT_TYPE_DEFINITION_PATH_WITHOUT_IMAGE, null))
			.thenReturn(getDocumentWithoutPreviewImage());
	}

	private Document getDocumentWithPreviewImage() {
		Document document = DocumentHelper.createDocument();
		Element root = document.addElement(FORM_DEFINITION_ROOT);
		root.addElement(FORM_DEFINITION_IMAGE_THUMBNAIL)
			.addText(FORM_DEFINITION_PREVIEW_IMAGE);

		return document;
	}

	private Document getDocumentWithoutPreviewImage() {
		Document document = DocumentHelper.createDocument();
		Element root = document.addElement(FORM_DEFINITION_ROOT);
		root.addElement(FORM_DEFINITION_IMAGE_THUMBNAIL)
			.addText("undefined");
		return document;
	}

	@Test
	public void getPreviewImageReturnResource() throws ServiceLayerException {
		ImmutablePair<String, Resource> pair = service.getContentTypePreviewImage(SITE_ID, CONTENT_TYPE);
		assertEquals(pair.getKey(), CONTENT_TYPE_PREVIEW_IMAGE_PATH);
		assertEquals(pair.getValue(), resource);
	}

	@Test
	public void getDefaultPreviewImage() throws ServiceLayerException {
		ImmutablePair<String, Resource> pair = service.getContentTypePreviewImage(SITE_ID, CONTENT_TYPE_WITHOUT_IMAGE);
		assertEquals(pair.getKey(), CONTENT_TYPE_DEFAULT_PREVIEW_IMAGE_PATH);
	}

	@Test
	public void getFormControllerContentTypeNotFound() throws ServiceLayerException {
		when(contentService.contentExists(SITE_ID, CONTENT_TYPE_DEFINITION_PATH)).thenReturn(false);

		assertThrows(ContentNotFoundException.class,
			() -> service.getContentTypeFormController(SITE_ID, CONTENT_TYPE));
	}

	@Test
	public void getFormControllerReturnResource() throws ServiceLayerException {

		when(contentService.contentExists(SITE_ID, CONTENT_TYPE_WITH_CONTROLLER_DEFINITION_PATH)).thenReturn(true);
		when(contentService.getContentAsResource(SITE_ID, CONTENT_TYPE_WITH_FORM_CONTROLLER_FULL_FORM_CONTROLLER_PATH)).thenReturn(resource);

		ImmutablePair<String, Resource> resultPair = service.getContentTypeFormController(SITE_ID, CONTENT_TYPE_WITH_FORM_CONTROLLER);
		assertEquals(resultPair.getKey(), CONTENT_TYPE_WITH_FORM_CONTROLLER_FULL_FORM_CONTROLLER_PATH);
		assertEquals(resultPair.getValue(), resource);
	}

	@Test
	public void getContentTypeTest() throws ServiceLayerException, IOException {
		InputStream inputStream = new ClassPathResource("crafter/studio/content-type/" + CONTENT_TYPE + "/form-definition.xml").getInputStream();
		when(contentService.getContent(SITE_ID, CONTENT_TYPE_DEFINITION_PATH)).thenReturn(inputStream);
		ContentType contentType = service.loadContentType(SITE_ID, CONTENT_TYPE);

		JsonNode expected = new ObjectMapper().readTree("""
				{
					"previewable": true,
					"imageThumbnail": "page-test1.png",
					"noThumbnail": false,
					"quickCreate": true,
					"quickCreatePath": "/site/website/tests/{year}/{month}",
					"type": "unknown",
					"pathExcludes": ["^/site/website/tests/excluded.*", "^/site/website/tests/excluded2.*"],
					"pathIncludes": ["^/site/website/tests/.*"],
					"id": "myContentType",
					"label": "Test Content Type",
					"allowedRoles": [{"name": "author"}, {"name": "admin"}],
					"deleteDependencies": [{"pattern": "^/site/website/articles/.*", "removeEmptyFolder": true}],
					"copyDependencies": [{"pattern": "^/site/website/articles/.*", "target": "/site/website/articles2"}]
				}
				""");

		assertEquals(expected.get("previewable").asBoolean(), contentType.isPreviewable());
		assertEquals(expected.get("imageThumbnail").asText(), contentType.getImageThumbnail());
		assertEquals(expected.get("noThumbnail").asBoolean(), contentType.isNoThumbnail());
		assertEquals(expected.get("quickCreate").asBoolean(), contentType.isQuickCreate());
		assertEquals(expected.get("quickCreatePath").asText(), contentType.getQuickCreatePath());
		assertEquals(ContentType.Type.valueOf(expected.get("type").asText()), contentType.getType());
		assertEquals(jsonTextValues(expected.get("pathExcludes")), List.copyOf(contentType.getPathExcludes()));
		assertEquals(jsonTextValues(expected.get("pathIncludes")), List.copyOf(contentType.getPathIncludes()));
		assertEquals(expected.get("id").asText(), contentType.getId());
		assertEquals(expected.get("label").asText(), contentType.getLabel());
		assertEquals(
			StreamSupport.stream(expected.get("allowedRoles").spliterator(), false)
				.map(role -> new NormalizedRole(role.get("name").asText()))
				.collect(toSet()),
			new HashSet<>(contentType.getAllowedRoles()));
		assertEquals(
			List.of(new DeleteDependency(
				expected.get("deleteDependencies").get(0).get("pattern").asText(),
				expected.get("deleteDependencies").get(0).get("removeEmptyFolder").asBoolean())),
			contentType.getDeleteDependencies());
		assertEquals(
			List.of(new CopyDependency(
				expected.get("copyDependencies").get(0).get("pattern").asText(),
				expected.get("copyDependencies").get(0).get("target").asText())),
			contentType.getCopyDependencies());
	}

	private static List<String> jsonTextValues(JsonNode arrayNode) {
		return StreamSupport.stream(arrayNode.spliterator(), false)
			.map(JsonNode::asText)
			.toList();
	}
}
