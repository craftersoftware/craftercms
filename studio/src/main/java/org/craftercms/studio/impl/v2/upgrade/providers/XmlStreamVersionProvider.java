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

package org.craftercms.studio.impl.v2.upgrade.providers;

import org.craftercms.commons.upgrade.exception.UpgradeException;
import org.craftercms.studio.api.v1.repository.ContentRepository;

import javax.xml.stream.XMLEventReader;
import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.events.XMLEvent;
import java.beans.ConstructorProperties;
import java.io.InputStream;

import static java.lang.String.format;

/**
 * Extension of {@link XmlFileVersionProvider} that consumes a {@link XMLEventReader}
 * in order to stop reading the XML once the version tag has been found.
 */
public class XmlStreamVersionProvider extends XmlFileVersionProvider {
    private final String versionElementName;

    @ConstructorProperties({"path", "xpath", "defaultVersion", "contentRepository", "versionElementName"})
    public XmlStreamVersionProvider(String path, String xpath, String defaultVersion,
                                    ContentRepository contentRepository, String versionElementName) {
        super(path, xpath, defaultVersion, contentRepository);
        this.versionElementName = versionElementName;
    }

	/**
	 * Creates and configures an XML input factory with XXE protections.
	 *
	 * @return configured XMLInputFactory instance
	 */
	protected XMLInputFactory createXmlInputFactory() {
		XMLInputFactory factory = XMLInputFactory.newInstance();
		factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
		factory.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
		return factory;
	}

	@Override
	protected String getVersionFromFile(String site, String filePath) throws Exception {
		XMLInputFactory factory = createXmlInputFactory();

		XMLEventReader reader = null;
        try (InputStream is = contentRepository.getContent(site, filePath)) {
            reader = factory.createXMLEventReader(is);
            while (reader.hasNext()) {
                XMLEvent event = reader.nextEvent();
                if (event.isStartElement() && event.asStartElement().getName().getLocalPart().equals(versionElementName)) {
                    return reader.getElementText();
                }
            }
        } catch (Exception e) {
            throw new UpgradeException(format("Error reading version from file '%s' in site '%s'", filePath, site), e);
        } finally {
            if (reader != null) {
                reader.close();
            }
        }
        return defaultVersion;
    }
}
