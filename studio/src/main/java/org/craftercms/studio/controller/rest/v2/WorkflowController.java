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

package org.craftercms.studio.controller.rest.v2;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.PositiveOrZero;
import org.apache.commons.lang3.StringUtils;
import org.craftercms.commons.validation.annotations.param.ValidExistingContentPath;
import org.craftercms.commons.validation.annotations.param.ValidSiteId;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v2.dal.item.ContentItem;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage;
import org.craftercms.studio.api.v2.exception.InvalidParametersException;
import org.craftercms.studio.api.v2.service.publish.PublishService;
import org.craftercms.studio.api.v2.service.workflow.WorkflowService;
import org.craftercms.studio.model.rest.PaginatedResultList;
import org.craftercms.studio.model.rest.Result;
import org.craftercms.studio.model.rest.ResultList;
import org.craftercms.studio.model.rest.workflow.*;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.beans.ConstructorProperties;
import java.util.Collection;
import java.util.List;
import java.util.regex.Pattern;

import static java.util.Collections.emptyList;
import static org.apache.commons.collections4.CollectionUtils.emptyIfNull;
import static org.craftercms.studio.controller.rest.v2.RequestConstants.*;
import static org.craftercms.studio.controller.rest.v2.RequestMappingConstants.*;
import static org.craftercms.studio.controller.rest.v2.ResultConstants.RESULT_KEY_ITEMS;
import static org.craftercms.studio.controller.rest.v2.ResultConstants.RESULT_KEY_PACKAGES;
import static org.craftercms.studio.model.rest.ApiResponse.OK;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;
import static org.springframework.util.CollectionUtils.isEmpty;

@Validated
@RestController
@RequestMapping(API_2 + WORKFLOW)
public class WorkflowController {

	public static final String DEFAULT_QUERY_BY_PATH_REGEX = ".*";

	private final WorkflowService workflowService;
	private final PublishService publishService;

	@ConstructorProperties({"workflowService", "publishService"})
	public WorkflowController(final WorkflowService workflowService, final PublishService publishService) {
		this.workflowService = workflowService;
		this.publishService = publishService;
	}

	@GetMapping(value = ITEM_STATES, produces = APPLICATION_JSON_VALUE)
	public PaginatedResultList<ContentItem> getItemStates(@NotBlank @ValidSiteId @PathVariable String siteId,
														  @RequestParam(name = REQUEST_PARAM_PATH, required = false) String path,
														  @RequestParam(name = REQUEST_PARAM_STATES, required = false) Long states,
														  @PositiveOrZero @RequestParam(value = REQUEST_PARAM_OFFSET, required = false, defaultValue = "0")
														  int offset,
														  @PositiveOrZero @RequestParam(value = REQUEST_PARAM_LIMIT, required = false, defaultValue = "10")
														  int limit) throws SiteNotFoundException, InvalidParametersException {
		if (!isPathRegexValid(path)) {
			throw new InvalidParametersException("Parameter 'path' is not valid regular expression.");
		}
		int total = workflowService.getItemStatesTotal(siteId, path, states);
		List<ContentItem> items = emptyList();

		if (total > offset) {
			items = workflowService.getItemsByStates(siteId, path, states, offset, limit);
		}

		PaginatedResultList<ContentItem> result = new PaginatedResultList<>();
		result.setTotal(total);
		result.setOffset(offset);
		result.setLimit(isEmpty(items) ? 0 : items.size());
		result.setResponse(OK);
		result.setEntities(RESULT_KEY_ITEMS, items);
		return result;
	}

	private boolean isPathRegexValid(String pathRegex) {
		boolean toRet = true;
		try {
			Pattern.compile(pathRegex);
		} catch (Exception e) {
			toRet = false;
		}
		return toRet;
	}

	@PostMapping(value = ITEM_STATES, produces = APPLICATION_JSON_VALUE, consumes = APPLICATION_JSON_VALUE)
	public Result updateItemStates(@ValidSiteId @PathVariable String siteId,
								   @Valid @RequestBody ItemStatesPostRequestBody requestBody)
		throws SiteNotFoundException {
		ItemStatesUpdate update = requestBody.getUpdate();
		workflowService.updateItemStates(siteId, requestBody.getItems(),
			update.isClearSystemProcessing(), update.isClearUserLocked(), update.getLive(),
			update.getStaged(), update.getNew(), update.getModified());

		Result result = new Result();
		result.setResponse(OK);
		return result;
	}

	@PostMapping(value = UPDATE_ITEM_STATES_BY_QUERY, produces = APPLICATION_JSON_VALUE, consumes = APPLICATION_JSON_VALUE)
	public Result updateItemStatesByQuery(@ValidSiteId @PathVariable String siteId,
										  @Valid @RequestBody UpdateItemStatesByQueryRequestBody requestBody)
		throws SiteNotFoundException, InvalidParametersException {
		UpdateItemStatesByQueryRequestBody.Query query = requestBody.getQuery();
		ItemStatesUpdate update = requestBody.getUpdate();
		String resolvedPathRegex = StringUtils.isNotEmpty(query.getPath()) ? query.getPath() : DEFAULT_QUERY_BY_PATH_REGEX;
		if (!isPathRegexValid(resolvedPathRegex)) {
			throw new InvalidParametersException("Parameter 'path' is not valid regular expression.");
		}
		workflowService.updateItemStatesByQuery(siteId, resolvedPathRegex,
			query.getStates(), update.isClearSystemProcessing(),
			update.isClearUserLocked(), update.getLive(),
			update.getStaged(), update.getNew(), update.getModified());

		Result result = new Result();
		result.setResponse(OK);
		return result;
	}

	@GetMapping(value = PATH_PARAM_SITE + AFFECTED_PACKAGES, produces = APPLICATION_JSON_VALUE)
	public ResultList<PublishPackage> getWorkflowAffectedPackages(@ValidSiteId @PathVariable String siteId,
																  @ValidExistingContentPath @RequestParam(REQUEST_PARAM_PATH) String path,
																  @RequestParam(value = REQUEST_PARAM_INCLUDE_CHILDREN, required = false) boolean includeChildren) throws ServiceLayerException {
		Collection<PublishPackage> affectedPackages = emptyIfNull(publishService.getActivePackagesForItems(siteId, List.of(path), includeChildren));
		ResultList<PublishPackage> result = new ResultList<>();
		result.setEntities(RESULT_KEY_PACKAGES, affectedPackages);
		result.setResponse(OK);
		return result;
	}

	@PostMapping(value = PATH_PARAM_SITE + APPROVE, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public Result approve(@Valid @PathVariable @NotEmpty @ValidSiteId String siteId,
						  @Valid @RequestBody ApproveRequestBody request)
		throws UserNotFoundException, ServiceLayerException, AuthenticationException {
		workflowService.approvePackages(siteId, request.getPackageIds(),
			request.getSchedule(), request.isUpdateSchedule(), request.getComment());

		Result result = new Result();
		result.setResponse(OK);
		return result;
	}

	@PostMapping(value = PATH_PARAM_SITE + REJECT, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public Result reject(@Valid @PathVariable @NotEmpty @ValidSiteId String siteId,
						 @Valid @RequestBody ReviewPackageRequestBody rejectRequestBody)
		throws ServiceLayerException, AuthenticationException {
		workflowService.rejectPackages(siteId, rejectRequestBody.getPackageIds(),
			rejectRequestBody.getComment());
		Result result = new Result();
		result.setResponse(OK);
		return result;
	}

	@PostMapping(value = PATH_PARAM_SITE + CANCEL, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public Result cancel(@Valid @PathVariable @NotEmpty @ValidSiteId String siteId,
						 @Valid @RequestBody ReviewPackageRequestBody cancelPackageRequest)
		throws ServiceLayerException, AuthenticationException {
		workflowService.cancelPackages(siteId, cancelPackageRequest.getPackageIds(), cancelPackageRequest.getComment());
		Result result = new Result();
		result.setResponse(OK);
		return result;
	}
}
