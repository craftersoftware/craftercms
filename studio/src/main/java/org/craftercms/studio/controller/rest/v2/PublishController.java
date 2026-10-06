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
import jakarta.validation.constraints.*;
import org.craftercms.commons.rest.parameters.SortField;
import org.craftercms.commons.validation.annotations.param.EsapiValidatedParam;
import org.craftercms.commons.validation.annotations.param.SqlSort;
import org.craftercms.commons.validation.annotations.param.ValidSiteId;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v2.dal.PublishStatus;
import org.craftercms.studio.api.v2.dal.publish.PublishItemWithMetadata;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage;
import org.craftercms.studio.api.v2.exception.publish.InvalidPackageStateException;
import org.craftercms.studio.api.v2.exception.publish.PublishPackageNotFoundException;
import org.craftercms.studio.api.v2.exception.repository.RepositoryException;
import org.craftercms.studio.api.v2.service.publish.PublishService;
import org.craftercms.studio.api.v2.service.publish.PublishService.CalculatedPublishPackageResult;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.craftercms.studio.api.v2.task.TaskProgress;
import org.craftercms.studio.model.rest.PaginatedResultList;
import org.craftercms.studio.model.rest.Result;
import org.craftercms.studio.model.rest.ResultOne;
import org.craftercms.studio.model.rest.publish.*;
import org.craftercms.studio.model.task.PublishTask;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.beans.ConstructorProperties;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

import static java.util.Collections.emptyList;
import static org.apache.commons.collections.CollectionUtils.isEmpty;
import static org.craftercms.commons.validation.annotations.param.EsapiValidationType.ALPHANUMERIC;
import static org.craftercms.commons.validation.annotations.param.EsapiValidationType.USERNAME;
import static org.craftercms.studio.controller.rest.v2.RequestConstants.RESULT_KEY_PACKAGE;
import static org.craftercms.studio.controller.rest.v2.RequestConstants.*;
import static org.craftercms.studio.controller.rest.v2.RequestMappingConstants.*;
import static org.craftercms.studio.controller.rest.v2.ResultConstants.*;
import static org.craftercms.studio.model.rest.ApiResponse.CREATED;
import static org.craftercms.studio.model.rest.ApiResponse.OK;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

@Validated
@RestController
@RequestMapping(API_2 + PUBLISH)
public class PublishController {

	private final PublishService publishService;
	private final SitesService sitesService;

	@ConstructorProperties({"publishService", "sitesService"})
	public PublishController(final PublishService publishService, final SitesService sitesService) {
		this.publishService = publishService;
		this.sitesService = sitesService;
	}

	@GetMapping(value = PATH_PARAM_SITE + PACKAGES, produces = APPLICATION_JSON_VALUE)
	public PaginatedResultList<PublishPackage> getPublishPackages(@ValidSiteId @PathVariable String siteId,
								      @EsapiValidatedParam(type = ALPHANUMERIC) @Size(max = 20)
									  @Pattern(regexp = ALPHANUMERIC_LOWERCASE_PATTERN)
								      @RequestParam(name = REQUEST_PARAM_TARGET, required = false)
								      String target,
								      @RequestParam(name = REQUEST_PARAM_STATES, required = false) Long states,
								      @RequestParam(name = REQUEST_PARAM_APPROVAL_STATES, required = false)
								      List<PublishPackage.ApprovalState> approvalStates,
								      @RequestParam(name = REQUEST_PARAM_SUBMITTER, required = false)
								      @EsapiValidatedParam(type = USERNAME) String submitter,
								      @RequestParam(name = REQUEST_PARAM_REVIEWER, required = false)
								      @EsapiValidatedParam(type = USERNAME) String reviewer,
								      @RequestParam(name = REQUEST_PARAM_IS_SCHEDULED, required = false)
								      Boolean isScheduled,
								      @RequestParam(name = REQUEST_PARAM_SORT, required = false)
								      List<@SqlSort(columns = PUBLISH_PACKAGES_SORT_FIELDS) SortField> sort,
								      @RequestParam(name = REQUEST_PARAM_OFFSET, required = false,
									      defaultValue = "0") @PositiveOrZero int offset,
								      @RequestParam(name = REQUEST_PARAM_LIMIT, required = false,
									      defaultValue = "10") @PositiveOrZero int limit)
		throws ServiceLayerException, UserNotFoundException {
		long total = publishService.getPublishPackagesCount(siteId, target, states, approvalStates, submitter, reviewer, isScheduled);
		Collection<PublishPackage> packages = new ArrayList<>();
		if (total > 0) {
			packages = publishService.getPublishPackages(siteId, target, states, approvalStates, submitter, reviewer, isScheduled, sort, offset, limit);
		}

		PaginatedResultList<PublishPackage> result = new PaginatedResultList<>();
		result.setTotal(total);
		result.setOffset(offset);
		result.setLimit(isEmpty(packages) ? 0 : packages.size());
		result.setResponse(OK);
		result.setEntities(RESULT_KEY_PACKAGES, packages);
		return result;
	}

	@GetMapping(value = PATH_PARAM_SITE + PACKAGE + PATH_PARAM_PACKAGE, produces = APPLICATION_JSON_VALUE)
	public GetPackageResult getPublishPackage(@PathVariable @ValidSiteId String siteId,
							   @PathVariable @Positive long packageId)
		throws ServiceLayerException, UserNotFoundException {
		PublishPackage publishPackage = publishService.getPackage(siteId, packageId);
		TaskProgress<PublishTask.PublishTaskId, Long> progress = sitesService.getPublishingTaskProgress(siteId, packageId);
		GetPackageResult result = new GetPackageResult(progress, publishPackage);
		result.setResponse(OK);
		return result;
	}

	@PostMapping(value = PATH_PARAM_SITE + PACKAGE + PATH_PARAM_PACKAGE, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public Result updatePublishPackage(@PathVariable @ValidSiteId String siteId,
			@PathVariable @Positive long packageId, @Validated @RequestBody UpdatePackageRequest request)
			throws InvalidPackageStateException, SiteNotFoundException, AuthenticationException {
		publishService.updatePublishPackage(siteId, packageId, request.getSchedule(), request.isUpdateSchedule(),
				request.getComment(), request.getTitle(), request.isRequestApproval());
		Result result = new Result();
		result.setResponse(OK);
		return result;
	}

	@GetMapping(value = PATH_PARAM_SITE + PACKAGE + PATH_PARAM_PACKAGE + ITEMS, produces = APPLICATION_JSON_VALUE)
	public PaginatedResultList<PublishItemWithMetadata> getPublishPackageItems(@PathVariable @ValidSiteId String siteId,
										   @PathVariable @Positive long packageId,
										   @RequestParam(name = REQUEST_PARAM_PATH, required = false) String path,
										   @RequestParam(name = REQUEST_PARAM_SYSTEM_TYPE, required = false) List<String> systemTypes,
										   @RequestParam(name = REQUEST_PARAM_INTERNAL_NAME, required = false) String internalName,
										   @RequestParam(name = REQUEST_PARAM_OFFSET, required = false,
											   defaultValue = "0") @PositiveOrZero int offset,
										   @RequestParam(name = REQUEST_PARAM_LIMIT, required = false,
											   defaultValue = "10") @PositiveOrZero int limit)
		throws PublishPackageNotFoundException, SiteNotFoundException {
		Collection<PublishItemWithMetadata> items = emptyList();
		int totalItemCount = publishService.getPublishPackageItemCount(siteId, packageId, path, systemTypes, internalName);
		if (totalItemCount > 0) {
			items = publishService.getPublishPackageItems(siteId, packageId, path, systemTypes, internalName, offset, limit);
		}
		PaginatedResultList<PublishItemWithMetadata> result = new PaginatedResultList<>();
		result.setEntities(RESULT_KEY_ITEMS, items);
		result.setOffset(offset);
		result.setLimit(limit);
		result.setTotal(totalItemCount);
		result.setResponse(OK);
		return result;
	}

	@GetMapping(value = PATH_PARAM_SITE + STATUS, produces = APPLICATION_JSON_VALUE)
	public ResultOne<PublishStatus> getPublishingStatus(@PathVariable @ValidSiteId String siteId)
			throws SiteNotFoundException, RepositoryException {
		PublishStatus status = sitesService.getPublishingStatus(siteId);
		ResultOne<PublishStatus> result = new ResultOne<>();
		result.setEntity(RESULT_KEY_PUBLISH_STATUS, status);
		result.setResponse(OK);
		return result;
	}

	@GetMapping(value = AVAILABLE_TARGETS, produces = APPLICATION_JSON_VALUE)
	public AvailablePublishingTargets getAvailablePublishingTargets(@ValidSiteId @PathVariable String siteId)
			throws SiteNotFoundException, RepositoryException {
		var availableTargets = publishService.getAvailablePublishingTargets(siteId);
		var published = publishService.isSitePublished(siteId);
		AvailablePublishingTargets availablePublishingTargets = new AvailablePublishingTargets();
		availablePublishingTargets.setPublishingTargets(availableTargets);
		availablePublishingTargets.setPublished(published);
		availablePublishingTargets.setResponse(OK);
		return availablePublishingTargets;
	}

	@Valid
	@GetMapping(value = HAS_INITIAL_PUBLISH, produces = APPLICATION_JSON_VALUE)
	public ResultOne<Boolean> hasInitialPublish(@ValidSiteId @PathVariable String siteId)
			throws SiteNotFoundException, RepositoryException {
		var published = publishService.isSitePublished(siteId);
		ResultOne<Boolean> result = new ResultOne<>();
		result.setResponse(OK);
		result.setEntity(RESULT_KEY_HAS_INITIAL_PUBLISH, published);
		return result;
	}

	@PostMapping(value = PATH_PARAM_SITE + CALCULATE, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public ResultOne<CalculatedPublishPackageResult> calculatePublishPackage(@PathVariable @NotEmpty @ValidSiteId String siteId,
										 @Validated @RequestBody CalculatePublishPackageRequest request)
		throws ServiceLayerException, IOException {
		CalculatedPublishPackageResult calculatedPackage = publishService.calculatePublishPackage(siteId,
			request.getPublishingTarget(), request.getPaths(), request.getCommitIds());

		ResultOne<CalculatedPublishPackageResult> result = new ResultOne<>();
		result.setResponse(OK);
		result.setEntity(RESULT_KEY_PACKAGE, calculatedPackage);
		return result;
	}

	@PostMapping(value = PATH_PARAM_SITE + PACKAGE + PATH_PARAM_PACKAGE + RECALCULATE, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public ResultOne<CalculatedPublishPackageResult> recalculate(@PathVariable @NotEmpty @ValidSiteId String siteId,
								     @PathVariable @Positive long packageId,
								     @Valid @RequestBody RecalculatePublishPackageRequest request)
		throws ServiceLayerException, IOException {
		CalculatedPublishPackageResult calculatedPackage = publishService.recalculatePublishPackage(siteId,
			packageId, request.getPublishingTarget());

		ResultOne<CalculatedPublishPackageResult> result = new ResultOne<>();
		result.setResponse(OK);
		result.setEntity(RESULT_KEY_PACKAGE, calculatedPackage);
		return result;
	}

	@PostMapping(value = PATH_PARAM_SITE + ENABLE_PUBLISHER, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public Result enablePublisher(@PathVariable @NotEmpty @ValidSiteId String siteId, @RequestBody EnablePublisherRequest request) {
		sitesService.enablePublishing(siteId, request.isEnable());
		Result result = new Result();
		result.setResponse(OK);
		return result;
	}

	@ResponseStatus(HttpStatus.CREATED)
	@PostMapping(value = PATH_PARAM_SITE + PACKAGE, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public ResultOne<Long> publish(@PathVariable @NotEmpty @ValidSiteId String siteId,
				       @Validated @RequestBody PublishPackageRequest request)
		throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		long packageId = submitPublishPackage(siteId, request);

		ResultOne<Long> result = new ResultOne<>();
		result.setResponse(CREATED);
		result.setEntity(RESULT_KEY_PACKAGE_ID, packageId);
		return result;
	}

	/**
	 * Submit a publish package request
	 *
	 * @param request the request
	 * @return the package id
	 */
	private long submitPublishPackage(String siteId, PublishPackageRequest request)
		throws ServiceLayerException, AuthenticationException {
		if (request.isRequestApproval()) {
			return publishService.requestPublish(siteId, request.getPublishingTarget(),
				request.getPaths(), request.getCommitIds(), request.getSchedule(),
				request.getTitle(), request.getComment(), request.isPublishAll());
		}
		return publishService.publish(siteId, request.getPublishingTarget(), request.getPaths(),
			request.getCommitIds(), request.getSchedule(),
			request.getTitle(), request.getComment(), request.isPublishAll());
	}

}
