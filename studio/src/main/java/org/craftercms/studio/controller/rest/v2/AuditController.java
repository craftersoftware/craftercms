/*
 * Copyright (C) 2007-2023 Crafter Software Corporation. All Rights Reserved.
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

package org.craftercms.studio.controller.rest.v2;

import jakarta.validation.constraints.PositiveOrZero;
import org.craftercms.commons.validation.annotations.param.EsapiValidatedParam;
import org.craftercms.commons.validation.annotations.param.ValidSiteId;
import org.craftercms.commons.validation.annotations.param.ValidateNoTagsParam;
import org.craftercms.commons.validation.annotations.param.ValidateStringParam;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v2.dal.AuditLog;
import org.craftercms.studio.api.v2.service.audit.AuditService;
import org.craftercms.studio.model.rest.ApiResponse;
import org.craftercms.studio.model.rest.PaginatedResultList;
import org.craftercms.studio.model.rest.ResultOne;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.util.CollectionUtils;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.ZonedDateTime;
import java.util.List;

import static org.craftercms.commons.validation.annotations.param.EsapiValidationType.USERNAME;
import static org.craftercms.studio.controller.rest.v2.RequestConstants.*;
import static org.craftercms.studio.controller.rest.v2.RequestMappingConstants.*;
import static org.craftercms.studio.controller.rest.v2.ResultConstants.RESULT_KEY_AUDIT_LOG;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

@Validated
@RestController
public class AuditController {

	private AuditService auditService;

	@GetMapping(value = API_2 + AUDIT, produces = APPLICATION_JSON_VALUE)
	public PaginatedResultList<AuditLog> getAuditLog(
		@ValidSiteId
		@RequestParam(value = REQUEST_PARAM_SITEID, required = false, defaultValue = "") String siteId,
		@PositiveOrZero @RequestParam(value = REQUEST_PARAM_OFFSET, required = false, defaultValue = "0") int offset,
		@PositiveOrZero @RequestParam(value = REQUEST_PARAM_LIMIT, required = false, defaultValue = "10") int limit,
		@EsapiValidatedParam(type = USERNAME)
		@RequestParam(value = REQUEST_PARAM_USER, required = false, defaultValue = "") String user,
		@RequestParam(value = REQUEST_PARAM_OPERATIONS, required = false) List<@ValidateNoTagsParam String> operations,
		@RequestParam(value = REQUEST_PARAM_INCLUDE_PARAMETERS, required = false) boolean includeParameters,
		@RequestParam(value = REQUEST_PARAM_DATE_FROM, required = false)
		@DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) ZonedDateTime dateFrom,
		@RequestParam(value = REQUEST_PARAM_DATE_TO, required = false)
		@DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) ZonedDateTime dateTo,
		@ValidateNoTagsParam
		@RequestParam(value = REQUEST_PARAM_TARGET, required = false) String target,
		@ValidateStringParam(whitelistedPatterns = "(?i)(API|GIT)")
		@RequestParam(value = REQUEST_PARAM_ORIGIN, required = false) String origin,
		@ValidateNoTagsParam
		@RequestParam(value = REQUEST_PARAM_CLUSTER_NODE_ID, required = false) String clusterNodeId,
		@ValidateStringParam(whitelistedPatterns = "(?i)date")
		@RequestParam(value = REQUEST_PARAM_SORT, required = false) String sort,
		@ValidateStringParam(whitelistedPatterns = "(?i)(ASC|DESC)")
		@RequestParam(value = REQUEST_PARAM_ORDER, required = false) String order) throws SiteNotFoundException {
		int total = auditService.getAuditLogTotal(siteId, user, operations, includeParameters, dateFrom,
			dateTo, target, origin, clusterNodeId);

		List<AuditLog> auditLog = auditService.getAuditLog(siteId, offset, limit, user, operations,
			includeParameters, dateFrom, dateTo, target, origin, clusterNodeId, sort, order);

		PaginatedResultList<AuditLog> result = new PaginatedResultList<>();
		result.setTotal(total);
		result.setLimit(CollectionUtils.isEmpty(auditLog) ? 0 : auditLog.size());
		result.setOffset(offset);
		result.setEntities(RESULT_KEY_AUDIT_LOG, auditLog);
		result.setResponse(ApiResponse.OK);
		return result;
	}

	@GetMapping(value = API_2 + AUDIT + PATH_PARAM_ID, produces = APPLICATION_JSON_VALUE)
	public ResultOne<AuditLog> getAuditLogEntry(@PathVariable(REQUEST_PARAM_ID) long auditLogId,
						    @ValidSiteId
						    @RequestParam(value = REQUEST_PARAM_SITEID, required = false, defaultValue = "") String siteId) throws SiteNotFoundException {
		AuditLog auditLogEntry = auditService.getAuditLogEntry(siteId, auditLogId);

		ResultOne<AuditLog> result = new ResultOne<>();
		result.setEntity(RESULT_KEY_AUDIT_LOG, auditLogEntry);
		result.setResponse(ApiResponse.OK);
		return result;
	}

	public void setAuditService(AuditService auditService) {
		this.auditService = auditService;
	}
}
