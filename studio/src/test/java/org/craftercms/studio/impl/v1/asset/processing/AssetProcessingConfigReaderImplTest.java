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

package org.craftercms.studio.impl.v1.asset.processing;

import org.craftercms.studio.api.v1.asset.processing.ProcessorPipelineConfiguration;
import org.junit.Test;
import org.springframework.core.io.ClassPathResource;

import java.io.InputStream;
import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;

public class AssetProcessingConfigReaderImplTest {

	private static final String SAMPLE_CONFIG =
			"repo-bootstrap/global/configuration/samples/sample-asset-processing-config.xml";
	private static final String EXPECTED_OPTIONS =
			"-level 0,100%,1.3 -gaussian-blur 0.05 -quality 20% -strip";

	private final AssetProcessingConfigReaderImpl reader = new AssetProcessingConfigReaderImpl();

	@Test
	public void readConfigPreservesCommaContainingParams() throws Exception {
		try (InputStream in = new ClassPathResource(SAMPLE_CONFIG).getInputStream()) {
			List<ProcessorPipelineConfiguration> pipelines = reader.readConfig(in);
			assertFalse(pipelines.isEmpty());
			assertEquals(EXPECTED_OPTIONS, pipelines.getFirst().getProcessorsConfig().getFirst().getParams().get("options"));
		}
	}

}
