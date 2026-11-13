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

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Moves a {@code token} query parameter from {@code httpMethodCallProcessor} URLs into the
 * {@link ManagementToken#HEADER_NAME} header when the destination is a Crafter management endpoint.
 * Set {@code migrateManagementToken: true} on a processor to opt in a URL that is not in that set.
 * Other destinations, including custom callback URLs, keep their {@code token} query parameter.
 * A {@code token} parameter by itself does not mark a URL as a management endpoint.
 * <p>
 * Literal percent-encoded token values are decoded before they are stored in the header.
 * {@code +} stays a plus, and unresolved {@code ${...}} placeholders are copied unchanged.
 * Other query parameters, including {@code crafterSite}, stay on the URL. Token values are not written to the log.
 */
public class MoveManagementTokenToHeaderUpgradeOperation extends AbstractTargetUpgradeOperation {

	static final String URL_KEY = "url";
	static final String HEADERS_KEY = "headers";
	static final String HEADER_NAME_KEY = "name";
	static final String HEADER_VALUE_KEY = "value";
	static final String HTTP_METHOD_CALL_PROCESSOR = "httpMethodCallProcessor";
	static final String MIGRATE_MANAGEMENT_TOKEN_KEY = "migrateManagementToken";

	/**
	 * Engine, Studio, and Deployer paths that accept the management token.
	 * Matched against the request path, with an optional {@code .json} suffix where those APIs use one.
	 */
	private static final List<Pattern> MANAGEMENT_ENDPOINT_PATHS = List.of(
		Pattern.compile("^/api/1/site/context/(?:id|destroy|rebuild_all|rebuild|status|graphql/rebuild)(?:\\.json)?$"),
		Pattern.compile("^/api/1/site/cache/(?:clear|statistics)(?:\\.json)?$"),
		Pattern.compile("^/api/1/cache/(?:clear|clear_all)(?:\\.json)?$"),
		Pattern.compile("^/api/1/monitoring/(?:log|memory|status|version|sysinfo)(?:\\.json)?$"),
		Pattern.compile("^/api/2/monitoring/(?:log|memory|status|version|sysinfo|disk)(?:\\.json)?$"),
		Pattern.compile("^/api/2/management/sites(?:\\.json)?$"),
		Pattern.compile("^/api/2/plugin/script/reload(?:\\.json)?$"),
		Pattern.compile("^/api/2/plugin/[^/]+/script/reload(?:\\.json)?$"),
		Pattern.compile("^/api/1/target/.+")
	);

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
			boolean optedIn = consumeOptIn(processor);
			TokenMove move = extractToken(url);
			if (move == null) {
				continue;
			}
			if (!optedIn && !isCrafterManagementEndpoint(url)) {
				logger.debug("Left token query parameter unchanged for processor '{}' in target '{}' because the " +
					"URL is not a verified Crafter management endpoint", processorName, target.getId());
				continue;
			}
			processor.put(URL_KEY, move.urlWithoutToken);
			addHeader(processor, move.tokenValue);
			logger.info("Moved management token from the URL into the {} header for processor '{}' in target '{}'",
				ManagementToken.HEADER_NAME, processorName, target.getId());
		}
	}

	/**
	 * Reads and removes {@code migrateManagementToken}. YAML may supply a boolean or the string {@code true}.
	 */
	private static boolean consumeOptIn(Map<String, Object> processor) {
		Object value = processor.remove(MIGRATE_MANAGEMENT_TOKEN_KEY);
		if (value instanceof Boolean optedIn) {
			return optedIn;
		}
		return value != null && Boolean.parseBoolean(value.toString());
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
	 * Removes every {@code token} query parameter. The first token value is decoded for the header.
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
					tokenValue = decodeQueryValue(equals >= 0 ? part.substring(equals + 1) : "");
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

	/**
	 * True when {@code url}'s path is a Crafter management endpoint. The query string is ignored.
	 */
	static boolean isCrafterManagementEndpoint(String url) {
		String path = requestPath(url);
		if (path.length() > 1 && path.endsWith("/")) {
			path = path.substring(0, path.length() - 1);
		}
		for (Pattern pattern : MANAGEMENT_ENDPOINT_PATHS) {
			if (pattern.matcher(path).matches()) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Path component of a deployment URL. Placeholders such as {@code ${target.engineUrl}} are left in place,
	 * so the path starts at the first slash after an optional scheme.
	 */
	private static String requestPath(String url) {
		int cut = url.length();
		int query = url.indexOf('?');
		int hash = url.indexOf('#');
		if (query >= 0) {
			cut = query;
		}
		if (hash >= 0 && hash < cut) {
			cut = hash;
		}
		String withoutSuffix = url.substring(0, cut);
		int scheme = withoutSuffix.indexOf("://");
		int searchFrom = scheme >= 0 ? scheme + 3 : 0;
		int pathStart = withoutSuffix.indexOf('/', searchFrom);
		if (pathStart < 0) {
			return "";
		}
		return withoutSuffix.substring(pathStart);
	}

	/**
	 * Percent-decodes a query value as a URI query component: {@code +} is a plus, and {@code %2B} is a plus.
	 * Text inside an unresolved {@code ${...}} placeholder, including nested placeholders, is not decoded.
	 * An invalid percent sequence or a byte sequence that is not UTF-8 is left as written.
	 */
	static String decodeQueryValue(String raw) {
		StringBuilder decoded = new StringBuilder(raw.length());
		int index = 0;
		while (index < raw.length()) {
			if (raw.startsWith("${", index)) {
				int end = placeholderEnd(raw, index);
				if (end < 0) {
					decoded.append(raw, index, raw.length());
					break;
				}
				decoded.append(raw, index, end);
				index = end;
				continue;
			}
			int literalEnd = raw.indexOf("${", index);
			if (literalEnd < 0) {
				literalEnd = raw.length();
			}
			decoded.append(percentDecode(raw.substring(index, literalEnd)));
			index = literalEnd;
		}
		return decoded.toString();
	}

	private static int placeholderEnd(String value, int start) {
		int depth = 0;
		for (int index = start; index < value.length(); index++) {
			if (value.charAt(index) == '$' && index + 1 < value.length() && value.charAt(index + 1) == '{') {
				depth++;
				index++;
			} else if (value.charAt(index) == '}') {
				depth--;
				if (depth == 0) {
					return index + 1;
				}
			}
		}
		return -1;
	}

	private static String percentDecode(String literal) {
		StringBuilder decoded = new StringBuilder(literal.length());
		ByteArrayOutputStream bytes = new ByteArrayOutputStream();
		int index = 0;
		int runStart = -1;
		while (index < literal.length()) {
			if (isPercentByte(literal, index)) {
				if (runStart < 0) {
					runStart = index;
				}
				bytes.write(Integer.parseInt(literal.substring(index + 1, index + 3), 16));
				index += 3;
				continue;
			}
			appendEncodedRun(decoded, literal, runStart, index, bytes);
			runStart = -1;
			bytes.reset();
			decoded.append(literal.charAt(index) == '+' ? ' ' : literal.charAt(index));
			index++;
		}
		appendEncodedRun(decoded, literal, runStart, index, bytes);
		return decoded.toString();
	}

	private static void appendEncodedRun(StringBuilder decoded, String literal, int runStart, int runEnd,
					     ByteArrayOutputStream bytes) {
		if (runStart < 0) {
			return;
		}
		CharsetDecoder decoder = StandardCharsets.UTF_8.newDecoder()
			.onMalformedInput(CodingErrorAction.REPORT)
			.onUnmappableCharacter(CodingErrorAction.REPORT);
		try {
			decoded.append(decoder.decode(ByteBuffer.wrap(bytes.toByteArray())));
		} catch (CharacterCodingException e) {
			decoded.append(literal, runStart, runEnd);
		}
	}

	private static boolean isPercentByte(String value, int index) {
		return index + 2 < value.length()
			&& value.charAt(index) == '%'
			&& isHex(value.charAt(index + 1))
			&& isHex(value.charAt(index + 2));
	}

	private static boolean isHex(char character) {
		return (character >= '0' && character <= '9')
			|| (character >= 'a' && character <= 'f')
			|| (character >= 'A' && character <= 'F');
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
