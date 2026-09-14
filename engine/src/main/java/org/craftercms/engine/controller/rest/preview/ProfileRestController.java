/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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
package org.craftercms.engine.controller.rest.preview;

import jakarta.servlet.http.HttpSession;
import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.text.StringEscapeUtils;
import org.bson.types.ObjectId;
import org.craftercms.commons.validation.ValidationResult;
import org.craftercms.core.controller.rest.CrafterRestController;
import org.craftercms.core.controller.rest.RestControllerBase;
import org.craftercms.engine.rest.SetProfileRequest;
import org.craftercms.engine.util.ConfigUtils;
import org.owasp.esapi.ESAPI;
import org.owasp.esapi.Validator;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static java.lang.String.format;
import static java.util.function.Function.identity;
import static java.util.stream.Collectors.toList;
import static org.craftercms.commons.validation.annotations.param.EsapiValidationType.HTTPParameterName;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

/**
 * REST controller for integration with Crafter Profile.
 *
 * @author Russ Danner
 * @author Alfonso Vásquez
 */
@CrafterRestController
@RequestMapping(RestControllerBase.REST_BASE_URI + ProfileRestController.URL_ROOT)
public class ProfileRestController {

	public static final String URL_ROOT = "/profile";
	public static final int MAXIMUM_PROPERTY_COUNT = 100;
	public static final int MAXIMUM_PROPERTY_KEY_LENGTH = 64;
	public static final int MAXIMUM_PROPERTY_VALUE_LENGTH = 2048;
	public static final String PROFILE_SESSION_ATTRIBUTE = "_cr_profile_state";
	public static final String CLEANSE_ATTRS_CONFIG_KEY = "preview.targeting.cleanseAttributes";
	public static final String ERROR_MESSAGE_MODEL_ATTR_NAME = "message";

	private final Validator validator = ESAPI.validator();

	@RequestMapping(value = "/get", method = RequestMethod.GET, produces = APPLICATION_JSON_VALUE)
	@SuppressWarnings("unchecked")
	public Map<String, Object> getProfile(HttpSession session) {

		Map<String, Object> profile = (Map<String, Object>) session.getAttribute(PROFILE_SESSION_ATTRIBUTE);
		if (profile == null) {
			profile = new HashMap<>();
			session.setAttribute(PROFILE_SESSION_ATTRIBUTE, profile);
		}

		return profile;
	}

	@PostMapping(value = "/set", consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public ResponseEntity<Object> setProfile(@RequestBody SetProfileRequest profileRequest, HttpSession session) {
		Map<String, Object> parameterMap = profileRequest.getParameters();
		if (parameterMap.size() > MAXIMUM_PROPERTY_COUNT) {
			String message = format("Parameter count should not exceed %d. %d parameters were found.",
				MAXIMUM_PROPERTY_COUNT, parameterMap.size());
			return ResponseEntity.badRequest().body(Map.of(ERROR_MESSAGE_MODEL_ATTR_NAME, message));
		}

		Map<String, Object> profile = new HashMap<>();
		try {
			for (String paramName : parameterMap.keySet()) {
				Object param = parameterMap.get(paramName);
				if (param instanceof String) {
					validateParameter(paramName, (String) param);
					String value = cleanProfileParam((String) param);
					profile.put(paramName, value);
				} else if (param instanceof List) {
					List<String> paramValue = (List<String>) param;
					for (String s : paramValue) {
						validateParameter(paramName, s);
					}
					profile.put(paramName, paramValue.stream().map(this::cleanProfileParam).collect(toList()));
				}
			}
		} catch (Exception e) {
			return ResponseEntity.badRequest().body(Map.of(ERROR_MESSAGE_MODEL_ATTR_NAME, e.getMessage()));
		}

		// change the id so the authentication object is updated
		profile.put("id", new ObjectId().toHexString());
		session.setAttribute(PROFILE_SESSION_ATTRIBUTE, profile);
		return ResponseEntity.ok(profile);
	}

	private String cleanProfileParam(String value) {
		if (StringUtils.isEmpty(value)) {
			return value;
		}
		return value.transform(String::trim)
			.transform(shouldCleanseAttributes() ? StringEscapeUtils::escapeHtml4 : identity());
	}

	private void validateParameter(final String paramName, final @NonNull String value) throws Exception {
		String paramNameValidationKey = HTTPParameterName.typeKey;
		validator.getValidInput(paramNameValidationKey, paramName, paramNameValidationKey, MAXIMUM_PROPERTY_KEY_LENGTH, false);
		if (value.length() > MAXIMUM_PROPERTY_VALUE_LENGTH) {
			throw new org.craftercms.commons.validation.ValidationException(new ValidationResult(
				format("Invalid input. The maximum length of %d characters was exceeded", MAXIMUM_PROPERTY_VALUE_LENGTH)));
		}
	}

	@SuppressWarnings("rawtypes")
	protected boolean shouldCleanseAttributes() {
		HierarchicalConfiguration siteConfig = ConfigUtils.getCurrentConfig();
		return siteConfig == null || siteConfig.getBoolean(CLEANSE_ATTRS_CONFIG_KEY, true);
	}

}
