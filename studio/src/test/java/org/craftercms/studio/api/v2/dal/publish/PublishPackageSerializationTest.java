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

package org.craftercms.studio.api.v2.dal.publish;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.model.rest.workflow.ItemStatesPostRequestBody;
import org.junit.Test;

import java.time.Instant;

import static org.junit.Assert.*;

/**
 * JSON shape of publishing models returned by the Studio API.
 */
public class PublishPackageSerializationTest {

	private final ObjectMapper mapper = new ObjectMapper()
		.findAndRegisterModules()
		.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

	@Test
	public void publishPackageEmitsStringSiteIdAndSubmittedOn() throws Exception {
		Site site = new Site();
		site.setId(42L);
		site.setSiteId("editorial");

		PublishPackage publishPackage = new PublishPackage();
		publishPackage.setId(7L);
		publishPackage.setSiteId(42L);
		publishPackage.setSite(site);
		publishPackage.setSubmittedOn(Instant.parse("2026-01-02T03:04:05Z"));

		String json = mapper.writeValueAsString(publishPackage);
		JsonNode node = mapper.readTree(json);

		assertTrue(node.get("siteId").isTextual());
		assertEquals("editorial", node.get("siteId").asText());
		assertEquals("2026-01-02T03:04:05Z", node.get("submittedOn").asText());
		assertFalse(node.has("submitedOn"));
		assertFalse(node.has("stringSiteId"));
		assertFalse(json.contains("\"siteId\":42"));
		assertFalse(json.contains("\"siteId\": 42"));
	}

	@Test
	public void nullSiteSerializesSiteIdAsNull() throws Exception {
		PublishPackage publishPackage = new PublishPackage();
		publishPackage.setId(7L);
		publishPackage.setSiteId(42L);
		publishPackage.setSubmittedOn(Instant.parse("2026-01-02T03:04:05Z"));

		JsonNode node = mapper.readTree(mapper.writeValueAsString(publishPackage));

		assertTrue(node.has("siteId"));
		assertTrue(node.get("siteId").isNull());
		assertEquals(42L, publishPackage.getSiteId());
	}

	@Test
	public void siteIdIsIgnoredOnDeserialize() throws Exception {
		Site site = new Site();
		site.setId(42L);
		site.setSiteId("editorial");

		PublishPackage publishPackage = new PublishPackage();
		publishPackage.setId(7L);
		publishPackage.setSiteId(42L);
		publishPackage.setSite(site);
		publishPackage.setSubmittedOn(Instant.parse("2026-01-02T03:04:05Z"));

		String json = mapper.writeValueAsString(publishPackage);
		PublishPackage restored = mapper.readValue(json, PublishPackage.class);

		assertEquals(7L, restored.getId());
		assertEquals(Instant.parse("2026-01-02T03:04:05Z"), restored.getSubmittedOn());
		assertEquals(0L, restored.getSiteId());
		assertNull(restored.getSite());
		assertNull(restored.getStringSiteId());

		PublishPackage fromStringSiteId = mapper.readValue("{\"id\":7,\"siteId\":\"editorial\"}", PublishPackage.class);
		assertEquals(0L, fromStringSiteId.getSiteId());
		assertNull(fromStringSiteId.getStringSiteId());
	}

	@Test
	public void publishItemEmitsPublishState() throws Exception {
		PublishItem item = new PublishItem();
		item.setId(9L);
		item.setPublishState(4L);

		JsonNode node = mapper.valueToTree(item);

		assertEquals(4L, node.get("publishState").asLong());
		assertFalse(node.has("publishedState"));
	}

	@Test
	public void setItemStatesUpdateIsUnwrapped() throws Exception {
		ItemStatesPostRequestBody withFlag = mapper.readValue(
			"{\"items\":[\"/site/website/index.xml\"],\"live\":true}", ItemStatesPostRequestBody.class);
		assertNotNull(withFlag.getUpdate());
		assertEquals(Boolean.TRUE, withFlag.getUpdate().getLive());

		// Jackson default-constructs the unwrapped update when no state field is present,
		// so @NotNull does not reject an items-only body.
		ItemStatesPostRequestBody itemsOnly = mapper.readValue(
			"{\"items\":[\"/site/website/index.xml\"]}", ItemStatesPostRequestBody.class);
		assertNotNull(itemsOnly.getUpdate());
		assertNull(itemsOnly.getUpdate().getLive());

		ItemStatesPostRequestBody fromNested = mapper.readValue(
			"{\"items\":[\"/site/website/index.xml\"],\"update\":{\"live\":true}}", ItemStatesPostRequestBody.class);
		assertNull(fromNested.getUpdate().getLive());
	}
}
