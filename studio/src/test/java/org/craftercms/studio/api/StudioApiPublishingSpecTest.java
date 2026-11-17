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

package org.craftercms.studio.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import org.junit.BeforeClass;
import org.junit.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.junit.Assert.*;

/**
 * Invariants for the publishing and workflow sections of studio-api.yaml.
 */
public class StudioApiPublishingSpecTest {

	private static final String[][] FORBIDDEN_OPERATIONS = {
		{"/api/2/dependency/{siteId}/publish_dependencies", "post"},
		{"/api/2/publish/{siteId}/calculate", "post"},
		{"/api/2/publish/{siteId}/package", "post"},
		{"/api/2/publish/{siteId}/packages", "get"},
		{"/api/2/publish/{siteId}/package/{packageId}", "get"},
		{"/api/2/publish/{siteId}/package/{packageId}/items", "get"},
		{"/api/2/publish/{siteId}/package/{packageId}/recalculate", "post"},
		{"/api/2/publish/{siteId}/status", "get"},
		{"/api/2/publish/{siteId}/available_targets", "get"},
		{"/api/2/publish/{siteId}/has_initial_publish", "get"},
		{"/api/2/publish/{siteId}/enable", "post"},
		{"/api/2/workflow/{siteId}/item_states", "get"},
		{"/api/2/workflow/{siteId}/item_states", "post"},
		{"/api/2/workflow/{siteId}/update_item_states_by_query", "post"},
		{"/api/2/workflow/{siteId}/cancel", "post"}
	};

	private static JsonNode root;
	private static JsonNode paths;
	private static JsonNode schemas;
	private static JsonNode responses;

	@BeforeClass
	public static void loadSpec() throws Exception {
		root = new YAMLMapper().readTree(specFile().toFile());
		paths = root.path("paths");
		schemas = root.path("components").path("schemas");
		responses = root.path("components").path("responses");
	}

	@Test
	public void specParsesAsOpenApiDocument() {
		assertEquals("3.0.0", root.path("openapi").asText());
		assertTrue(paths.isObject());
		assertTrue(schemas.isObject());
		assertTrue(schemas.path("PublishPackage").isObject());
	}

	@Test
	public void publishingTargetIsRequiredWithValidationLimits() {
		JsonNode request = schemas.path("PublishPackageRequest");
		assertEquals(List.of("publishingTarget"), textValues(request.path("required")));
		assertPublishingTarget(request.path("properties").path("publishingTarget"));

		JsonNode calculate = requestSchema("/api/2/publish/{siteId}/calculate", "post");
		assertEquals("#/components/schemas/PublishPackageRequest",
			calculate.path("allOf").path(0).path("$ref").asText());

		JsonNode publish = requestSchema("/api/2/publish/{siteId}/package", "post");
		assertEquals(List.of("publishingTarget", "title", "comment"), textValues(publish.path("required")));
		JsonNode title = publish.path("properties").path("title");
		assertEquals(1, title.path("minLength").asInt());
		assertEquals(200, title.path("maxLength").asInt());
		JsonNode comment = publish.path("properties").path("comment");
		assertEquals(1, comment.path("minLength").asInt());
		assertEquals(500, comment.path("maxLength").asInt());

		JsonNode recalculate = requestSchema("/api/2/publish/{siteId}/package/{packageId}/recalculate", "post");
		assertEquals(List.of("publishingTarget"), textValues(recalculate.path("required")));
		assertPublishingTarget(recalculate.path("properties").path("publishingTarget"));
	}

	@Test
	public void publishPackageAndPublishItemUseTheJavaPropertyNames() {
		JsonNode publishPackage = schemas.path("PublishPackage");
		assertTrue(publishPackage.path("properties").path("submittedOn").isObject());
		assertFalse(publishPackage.path("properties").has("submitedOn"));
		assertTrue(publishPackage.path("properties").path("title").isObject());
		assertTrue(publishPackage.path("properties").path("submitterId").isObject());
		assertTrue(publishPackage.path("properties").path("reviewerId").isObject());
		assertEquals("string", publishPackage.path("properties").path("siteId").path("type").asText());
		assertTrue(publishPackage.path("properties").path("schedule").path("nullable").asBoolean());

		List<String> required = textValues(publishPackage.path("required"));
		assertEquals(List.of("id", "siteId", "title", "target", "approvalState", "packageState", "submittedOn", "packageType"),
			required);
		assertFalse(required.contains("schedule"));
		assertFalse(required.contains("approver"));
		assertFalse(required.contains("state"));
		assertFalse(required.contains("publishingTarget"));

		String actions = publishPackage.path("properties").path("availableActions").path("description").asText();
		assertTrue(actions.contains("BIT ORDER (little-endian)`: 4"));
		assertTrue(actions.contains("Update"));

		JsonNode publishItem = schemas.path("PublishItem");
		assertTrue(publishItem.path("properties").path("publishState").isObject());
		assertFalse(publishItem.path("properties").has("publishedState"));
	}

	@Test
	public void publishingOperationsDocumentForbiddenAndPackageStateConflict() {
		for (String[] operation : FORBIDDEN_OPERATIONS) {
			JsonNode response = operation(operation[0], operation[1]).path("responses").path("403");
			assertEquals(operation[0] + " " + operation[1],
				"#/components/responses/Forbidden", response.path("$ref").asText());
		}

		JsonNode enable = operation("/api/2/publish/{siteId}/enable", "post").path("responses");
		assertFalse(enable.has("404"));
		assertEquals("#/components/responses/Forbidden", enable.path("403").path("$ref").asText());

		for (String path : List.of(
			"/api/2/publish/{siteId}/package/{packageId}",
			"/api/2/workflow/{siteId}/approve",
			"/api/2/workflow/{siteId}/reject",
			"/api/2/workflow/{siteId}/cancel")) {
			assertEquals(path, "#/components/responses/InvalidPackageState",
				operation(path, "post").path("responses").path("409").path("$ref").asText());
		}
		String conflict = responses.path("InvalidPackageState").path("description").asText();
		assertTrue(conflict.contains("7008"));
		assertTrue(conflict.toLowerCase().contains("not in the required state"));
	}

	@Test
	public void workflowRequestDetailsMatchTheControllers() {
		JsonNode itemStates = operation("/api/2/workflow/{siteId}/item_states", "get");
		String description = itemStates.path("description").asText();
		assertTrue(description.contains("content_read"));
		assertFalse(description.contains("get_item_states"));

		JsonNode items = operation("/api/2/publish/{siteId}/package/{packageId}/items", "get");
		assertTrue(parameter(items, "systemType").isObject());
		assertFalse(parameter(items, "systemTypes").isObject());

		assertReviewBody("/api/2/workflow/{siteId}/approve", "list of package IDs to approve");
		assertReviewBody("/api/2/workflow/{siteId}/reject", "list of package IDs to reject");
		assertReviewBody("/api/2/workflow/{siteId}/cancel", "list of package IDs to cancel");
		assertEquals("date-time",
			requestSchema("/api/2/workflow/{siteId}/approve", "post")
				.path("properties").path("schedule").path("format").asText());

		JsonNode setStates = requestSchema("/api/2/workflow/{siteId}/item_states", "post");
		assertEquals(List.of("items"), textValues(setStates.path("required")));
		assertFalse(setStates.path("properties").has("update"));
		assertTrue(setStates.path("properties").path("live").isObject());
		assertTrue(setStates.path("properties").path("clearSystemProcessing").isObject());

		JsonNode updateByQuery = requestSchema("/api/2/workflow/{siteId}/update_item_states_by_query", "post");
		assertTrue(textValues(updateByQuery.path("required")).contains("update"));

		assertEquals("integer", schemas.path("ContentItem").path("properties").path("translationSourceId").path("type").asText());
		assertEquals("int64", schemas.path("ContentItem").path("properties").path("translationSourceId").path("format").asText());
		assertEquals("integer", schemas.path("LocalizationItem").path("properties").path("translationSourceId").path("type").asText());

		assertEquals("date-time", schemas.path("ContentItem").path("properties").path("dateCreated").path("format").asText());
		assertEquals("date-time", schemas.path("ContentItem").path("properties").path("dateModified").path("format").asText());
		assertEquals("date-time", schemas.path("PublishTargetStatus").path("properties").path("dateLastPublished").path("format").asText());
		assertEquals("date-time", schemas.path("PublishTargetStatus").path("properties").path("dateScheduled").path("format").asText());
		assertEquals("date-time", schemas.path("WorkflowPackage").path("properties").path("schedule").path("format").asText());

		assertEquals(500, schemas.path("UpdatePackageRequest").path("properties").path("comment").path("maxLength").asInt());
	}

	private static void assertPublishingTarget(JsonNode publishingTarget) {
		assertEquals("string", publishingTarget.path("type").asText());
		assertEquals(1, publishingTarget.path("minLength").asInt());
		assertEquals(20, publishingTarget.path("maxLength").asInt());
		assertEquals("^[a-z0-9]*$", publishingTarget.path("pattern").asText());
	}

	private static void assertReviewBody(String path, String packageIdsDescription) {
		JsonNode schema = requestSchema(path, "post");
		List<String> required = textValues(schema.path("required"));
		assertTrue(path, required.contains("packageIds"));
		assertTrue(path, required.contains("comment"));
		JsonNode packageIds = schema.path("properties").path("packageIds");
		assertEquals(packageIdsDescription, packageIds.path("description").asText());
		assertEquals(1, packageIds.path("minItems").asInt());
		JsonNode comment = schema.path("properties").path("comment");
		assertEquals(1, comment.path("minLength").asInt());
		assertEquals(500, comment.path("maxLength").asInt());
		assertEquals("^.*\\S.*$", comment.path("pattern").asText());
	}

	private static JsonNode operation(String path, String method) {
		JsonNode operation = paths.path(path).path(method);
		assertTrue(path + " " + method, operation.isObject());
		return operation;
	}

	private static JsonNode requestSchema(String path, String method) {
		return operation(path, method).path("requestBody").path("content").path("application/json").path("schema");
	}

	private static JsonNode parameter(JsonNode operation, String name) {
		for (JsonNode parameter : operation.path("parameters")) {
			if (name.equals(parameter.path("name").asText())) {
				return parameter;
			}
		}
		return com.fasterxml.jackson.databind.node.MissingNode.getInstance();
	}

	private static List<String> textValues(JsonNode array) {
		List<String> values = new ArrayList<>();
		array.forEach(item -> values.add(item.asText()));
		return values;
	}

	private static Path specFile() {
		Path direct = Path.of("src/main/api/studio-api.yaml");
		if (Files.isRegularFile(direct)) {
			return direct;
		}
		Path fromRoot = Path.of("studio/src/main/api/studio-api.yaml");
		if (Files.isRegularFile(fromRoot)) {
			return fromRoot;
		}
		throw new IllegalStateException("studio-api.yaml not found from " + Path.of("").toAbsolutePath());
	}
}
