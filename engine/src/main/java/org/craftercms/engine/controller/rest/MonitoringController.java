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

package org.craftercms.engine.controller.rest;

import jakarta.validation.constraints.Positive;
import org.craftercms.commons.exceptions.InvalidManagementTokenException;
import org.craftercms.commons.monitoring.StatusInfo;
import org.craftercms.commons.monitoring.rest.MonitoringRestControllerBase;
import org.craftercms.commons.validation.annotations.param.ValidSiteId;
import org.craftercms.core.controller.rest.CrafterRestController;
import org.craftercms.engine.service.SiteHealthCheckService;
import org.craftercms.engine.util.logging.CircularQueueLogAppender;
import org.owasp.esapi.ESAPI;
import org.owasp.esapi.Validator;
import org.owasp.esapi.errors.ValidationException;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.beans.ConstructorProperties;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static java.lang.String.format;
import static org.craftercms.commons.validation.annotations.param.EsapiValidationType.SITE_ID;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

/**
 * Rest controller to provide monitoring information &amp; site logs
 */
@Validated
@CrafterRestController
@RequestMapping(MonitoringController.URL_ROOT)
public class MonitoringController extends MonitoringRestControllerBase {

	public static final String URL_ROOT = "/api/1";
	public static final String LOG_URL = "/log";

	private final SiteHealthCheckService siteHealthCheckService;
	private final Validator validator = ESAPI.validator();
	private final int MAXIMUM_SITE_ID_KEY_LENGTH = 50;

	@ConstructorProperties({"siteHealthCheckService", "configuredToken"})
	public MonitoringController(final SiteHealthCheckService siteHealthCheckService, final String configuredToken) {
		super(configuredToken);
		this.siteHealthCheckService = siteHealthCheckService;
	}

	@GetMapping(value = MonitoringRestControllerBase.ROOT_URL + LOG_URL, produces = APPLICATION_JSON_VALUE)
	public List<Map<String, Object>> getLoggedEvents(@RequestParam @ValidSiteId String site,
							 @Positive @RequestParam long since,
							 @RequestParam String token) throws InvalidManagementTokenException {
		validateToken(token);
		return CircularQueueLogAppender.getLoggedEvents(site, since);
	}

	@Override
	@GetMapping(value = ROOT_URL + STATUS_URL, produces = APPLICATION_JSON_VALUE)
	public ResponseEntity getCurrentStatus(@RequestParam(name = "crafterSite", required = false) String site,
					       @RequestParam(name = "token") String token)
		throws InvalidManagementTokenException {
		validateToken(token);

		Map<String, String> responseBody = new HashMap<>();

		if (site != null) {
			String paramNameValidationKey = SITE_ID.typeKey;
			try {
				validator.getValidInput(paramNameValidationKey, site, paramNameValidationKey, MAXIMUM_SITE_ID_KEY_LENGTH, false);
			} catch (ValidationException e) {
				responseBody.put("message", format("Invalid site Id: '%s'.", site));
				return ResponseEntity
					.badRequest()
					.body(responseBody);
			}

			if (!siteHealthCheckService.healthCheck(site)) {
				responseBody.put("message", format("Invalid context for site '%s'.", site));
				return ResponseEntity
					.internalServerError()
					.body(responseBody);
			}
		} else if (!siteHealthCheckService.healthCheck()) {
			responseBody.put("message", "Invalid contexts.");
			return ResponseEntity
				.internalServerError()
				.body(responseBody);
		}

		return ResponseEntity.ok().body(StatusInfo.getCurrentStatus());
	}

}
