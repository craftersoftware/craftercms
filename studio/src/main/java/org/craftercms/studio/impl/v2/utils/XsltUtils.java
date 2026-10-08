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
package org.craftercms.studio.impl.v2.utils;

import net.sf.saxon.lib.FeatureKeys;
import org.apache.commons.collections.MapUtils;
import org.apache.commons.io.IOUtils;

import javax.xml.XMLConstants;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerConfigurationException;
import javax.xml.transform.TransformerException;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.URIResolver;
import javax.xml.transform.stream.StreamResult;
import javax.xml.transform.stream.StreamSource;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.StringReader;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static java.lang.String.join;
import static java.nio.charset.StandardCharsets.UTF_8;
import static org.apache.commons.lang.text.StrSubstitutor.replace;
import static org.apache.commons.lang3.StringUtils.SPACE;

/**
 * Utility class for XSLT related operations
 *
 * @author joseross
 * @since 4.0
 */
public abstract class XsltUtils {

    public static final String SAXON_CLASS = "net.sf.saxon.TransformerFactoryImpl";

    public static final Pattern CDATA_PATTERN = Pattern.compile("<(\\w+).*?>\\s*<!\\[CDATA");

    public static final String CDATA_KEY = "cdataElements";

    public static void executeTemplate(InputStream template, Map<String, Object> params, URIResolver uriResolver,
                                       InputStream content, OutputStream output)
            throws TransformerException, IOException {
        // load the template & content into memory, no other way to find & replace
        String templateString = IOUtils.toString(template, UTF_8);
        String contentString = IOUtils.toString(content, UTF_8);

        // find all elements that include CDATA
        Set<String> elements = new HashSet<>();
        Matcher matcher = CDATA_PATTERN.matcher(contentString);
        while (matcher.find()) {
            elements.add(matcher.group(1));
        }

        // inject the cdata info into the template
        templateString = replace(templateString, Map.of(CDATA_KEY, join(SPACE, elements)));

		// execute the template

		// Saxon is used to support XSLT 2.0
		Transformer transformer = createTransformerFactory()
				.newTransformer(new StreamSource(new StringReader(templateString)));

        if (MapUtils.isNotEmpty(params)) {
            params.forEach(transformer::setParameter);
        }

        if (uriResolver != null) {
            transformer.setURIResolver(uriResolver);
        }

        transformer.transform(new StreamSource(new StringReader(contentString)), new StreamResult(output));
    }

	/**
	 * Creates a Saxon {@link TransformerFactory} hardened against XXE / external resource access.
	 */
	public static TransformerFactory createTransformerFactory() throws TransformerConfigurationException {
		TransformerFactory factory = TransformerFactory.newInstance(SAXON_CLASS, null);

		// JAXP standard hardening
		factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
		factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
		factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_STYLESHEET, "");

		// Saxon configuration for underlying SAX parsers and extension functions
		factory.setAttribute(FeatureKeys.ALLOW_EXTERNAL_FUNCTIONS, false);
		factory.setAttribute(FeatureKeys.XML_PARSER_FEATURE +
				"http://apache.org/xml/features/disallow-doctype-decl", true);
		factory.setAttribute(FeatureKeys.XML_PARSER_FEATURE +
				"http://xml.org/sax/features/external-general-entities", false);
		factory.setAttribute(FeatureKeys.XML_PARSER_FEATURE +
				"http://xml.org/sax/features/external-parameter-entities", false);

		return factory;
	}

}
