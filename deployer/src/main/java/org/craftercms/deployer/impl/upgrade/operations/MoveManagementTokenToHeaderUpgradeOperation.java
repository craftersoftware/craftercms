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

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Moves a {@code token} query parameter from {@code httpMethodCallProcessor} URLs into the
 * {@link ManagementToken#HEADER_NAME} header. Other query parameters, including {@code crafterSite}, are kept.
 * Token values are not written to the log.
 */
public class MoveManagementTokenToHeaderUpgradeOperation extends AbstractTargetUpgradeOperation {

	static final String URL_KEY = "url";
	static final String HEADERS_KEY = "headers";
	static final String HEADER_NAME_KEY = "name";
	static final String HEADER_VALUE_KEY = "value";
	static final String HTTP_METHOD_CALL_PROCESSOR = "httpMethodCallProcessor";

	@Override
	@SuppressWarnings("unchecked")
	protected void doExecute(Target target, Map<String, Object> targetConfig) {
		for (Map<String, Object> processor : getPipeline(targetConfig)) {
			Object processorName = processor.get(CONFIG_KEY_PROCESSOR_NAME);
			if (processorName == null || !HTTP_METHOD_CALL_PROCESSOR.equals(processorName.toString())) {
				continue;
			}
			Object urlValue = processor.get(URL_KEY);
			if (!(urlValue instanceof String url)) {
				continue;
			}
			TokenMove move = extractToken(url);
			if (move == null) {
				continue;
			}
			processor.put(URL_KEY, move.urlWithoutToken);
			addHeader(processor, move.tokenValue);
			logger.info("Moved management token from the URL into the {} header for processor '{}' in target '{}'",
				ManagementToken.HEADER_NAME, processorName, target.getId());
		}
	}

	@SuppressWarnings("unchecked")
	private void addHeader(Map<String, Object> processor, String tokenValue) {
		Object existing = processor.get(HEADERS_KEY);
		List<Object> headers;
		if (existing instanceof List) {
			headers = (List<Object>) existing;
		} else {
			if (existing != null) {
				logger.warn("Replacing non-list headers property on processor '{}'",
					processor.get(CONFIG_KEY_PROCESSOR_NAME));
			}
			headers = new ArrayList<>();
			processor.put(HEADERS_KEY, headers);
		}
		for (Object header : headers) {
			if (header instanceof Map<?, ?> headerMap) {
				Object name = headerMap.get(HEADER_NAME_KEY);
				if (name != null && ManagementToken.HEADER_NAME.equalsIgnoreCase(name.toString())) {
					return;
				}
			}
		}
		Map<String, Object> header = new LinkedHashMap<>();
		header.put(HEADER_NAME_KEY, ManagementToken.HEADER_NAME);
		header.put(HEADER_VALUE_KEY, tokenValue);
		headers.add(header);
	}

	/**
	 * Removes every {@code token} query parameter. The first token value is returned for the header.
	 * Returns null when the URL has no token parameter.
	 */
	static TokenMove extractToken(String url) {
		int queryStart = url.indexOf('?');
		if (queryStart < 0) {
			return null;
		}
		String base = url.substring(0, queryStart);
		String remainder = url.substring(queryStart + 1);
		String fragment = "";
		int hash = remainder.indexOf('#');
		if (hash >= 0) {
			fragment = remainder.substring(hash);
			remainder = remainder.substring(0, hash);
		}
		String[] parts = remainder.split("&", -1);
		List<String> kept = new ArrayList<>();
		String tokenValue = null;
		boolean found = false;
		for (String part : parts) {
			if (part.isEmpty()) {
				continue;
			}
			int equals = part.indexOf('=');
			String name = equals >= 0 ? part.substring(0, equals) : part;
			if ("token".equalsIgnoreCase(name)) {
				if (!found) {
					tokenValue = equals >= 0 ? part.substring(equals + 1) : "";
					found = true;
				}
			} else {
				kept.add(part);
			}
		}
		if (!found) {
			return null;
		}
		StringBuilder rebuilt = new StringBuilder(base);
		if (!kept.isEmpty()) {
			rebuilt.append('?').append(String.join("&", kept));
		}
		rebuilt.append(fragment);
		return new TokenMove(rebuilt.toString(), tokenValue);
	}

	static final class TokenMove {
		final String urlWithoutToken;
		final String tokenValue;

		TokenMove(String urlWithoutToken, String tokenValue) {
			this.urlWithoutToken = urlWithoutToken;
			this.tokenValue = tokenValue;
		}
	}

}
