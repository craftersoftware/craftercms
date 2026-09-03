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

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.craftercms.commons.validation.annotations.param.ValidExistingContentPath;
import org.craftercms.commons.validation.annotations.param.ValidSiteId;
import org.craftercms.studio.api.v1.constant.GitRepositories;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.repository.InvalidRemoteRepositoryCredentialsException;
import org.craftercms.studio.api.v1.exception.repository.InvalidRemoteUrlException;
import org.craftercms.studio.api.v1.exception.repository.RemoteNotRemovableException;
import org.craftercms.studio.api.v1.exception.repository.RemoteRepositoryNotFoundException;
import org.craftercms.studio.api.v2.dal.DiffConflictedFile;
import org.craftercms.studio.api.v2.dal.repository.RemoteRepository;
import org.craftercms.studio.api.v2.dal.repository.RemoteRepositoryInfo;
import org.craftercms.studio.api.v2.dal.repository.RepositoryStatus;
import org.craftercms.studio.api.v2.service.repository.MergeResult;
import org.craftercms.studio.api.v2.service.repository.RepositoryManagementService;
import org.craftercms.studio.model.rest.*;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.beans.ConstructorProperties;
import java.util.List;

import static org.craftercms.studio.api.v1.constant.StudioConstants.FILE_SEPARATOR;
import static org.craftercms.studio.controller.rest.v2.RequestConstants.REQUEST_PARAM_PATH;
import static org.craftercms.studio.controller.rest.v2.RequestMappingConstants.*;
import static org.craftercms.studio.controller.rest.v2.ResultConstants.*;
import static org.craftercms.studio.model.rest.ApiResponse.*;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

@Validated
@RestController
@RequestMapping(API_2 + REPOSITORY)
public class RepositoryManagementController {

	private final RepositoryManagementService repositoryManagementService;

	@ConstructorProperties({"repositoryManagementService"})
	public RepositoryManagementController(final RepositoryManagementService repositoryManagementService) {
		this.repositoryManagementService = repositoryManagementService;
	}

	@ResponseStatus(HttpStatus.CREATED)
	@PostMapping(value = ADD_REMOTE, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public Result addRemote(HttpServletResponse response, @ValidSiteId @PathVariable String siteId,
							@Valid @RequestBody RemoteRepository remoteRepository)
		throws ServiceLayerException, InvalidRemoteUrlException {
		Result result = new Result();
		repositoryManagementService.addRemote(siteId, remoteRepository);
		result.setResponse(CREATED);
		return result;
	}

	@GetMapping(value = LIST_REMOTES, produces = APPLICATION_JSON_VALUE)
	public ResultList<RemoteRepositoryInfo> listRemotes(@ValidSiteId @PathVariable String siteId)
		throws ServiceLayerException {
		List<RemoteRepositoryInfo> remotes = repositoryManagementService.listRemotes(siteId);

		ResultList<RemoteRepositoryInfo> result = new ResultList<>();
		result.setEntities(RESULT_KEY_REMOTES, remotes);
		result.setResponse(OK);
		return result;
	}

	@PostMapping(value = PULL_FROM_REMOTE, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public ResultOne<MergeResult> pullFromRemote(@ValidSiteId @PathVariable String siteId,
												 @Valid @RequestBody PullFromRemoteRequest pullFromRemoteRequest)
		throws InvalidRemoteUrlException, ServiceLayerException,
		InvalidRemoteRepositoryCredentialsException, RemoteRepositoryNotFoundException {
		MergeResult mergeResult = repositoryManagementService.pullFromRemote(siteId,
			pullFromRemoteRequest.getRemoteName(), pullFromRemoteRequest.getRemoteBranch(),
			pullFromRemoteRequest.getMergeStrategy());

		ResultOne<MergeResult> result = new ResultOne<>();
		result.setResponse(OK);
		result.setEntity(RESULT_KEY_RESULT, mergeResult);
		return result;
	}

	@PostMapping(value = PUSH_TO_REMOTE, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public Result pushToRemote(HttpServletResponse response, @ValidSiteId @PathVariable String siteId,
							   @Valid @RequestBody PushToRemoteRequest pushToRemoteRequest)
		throws InvalidRemoteUrlException, ServiceLayerException,
		InvalidRemoteRepositoryCredentialsException, RemoteRepositoryNotFoundException {
		boolean res = repositoryManagementService.pushToRemote(siteId,
			pushToRemoteRequest.getRemoteName(), pushToRemoteRequest.getRemoteBranch(),
			pushToRemoteRequest.isForce());

		Result result = new Result();
		if (res) {
			result.setResponse(OK);
		} else {
			response.setStatus(HttpStatus.INTERNAL_SERVER_ERROR.value());
			result.setResponse(PUSH_TO_REMOTE_FAILED);
		}
		return result;
	}

	@PostMapping(value = REMOVE_REMOTE, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public Result removeRemote(HttpServletResponse response, @ValidSiteId @PathVariable String siteId,
							   @Valid @RequestBody RemoveRemoteRequest removeRemoteRequest)
		throws SiteNotFoundException, RemoteNotRemovableException {
		boolean res = repositoryManagementService.removeRemote(siteId,
			removeRemoteRequest.getRemoteName());

		Result result = new Result();
		if (res) {
			result.setResponse(OK);
		} else {
			response.setStatus(HttpStatus.INTERNAL_SERVER_ERROR.value());
			result.setResponse(REMOVE_REMOTE_FAILED);
		}
		return result;
	}

	@GetMapping(value = SITE_ID + STATUS, produces = APPLICATION_JSON_VALUE)
	public ResultOne<RepositoryStatus> getRepositoryStatus(@ValidSiteId @PathVariable String siteId)
		throws ServiceLayerException {
		RepositoryStatus status = repositoryManagementService.getRepositoryStatus(siteId);
		ResultOne<RepositoryStatus> result = new ResultOne<>();
		result.setEntity(RESULT_KEY_REPOSITORY_STATUS, status);
		result.setResponse(OK);
		return result;
	}

	@PostMapping(value = RESOLVE_CONFLICT, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public ResultOne<RepositoryStatus> resolveConflict(@ValidSiteId @PathVariable String siteId,
													   @Valid @RequestBody ResolveConflictRequest resolveConflictRequest)
		throws ServiceLayerException {
		String path = resolveConflictRequest.getPath();
		if (!path.startsWith(FILE_SEPARATOR)) {
			path = FILE_SEPARATOR + path;
		}
		RepositoryStatus status = repositoryManagementService.resolveConflict(siteId,
			path, resolveConflictRequest.getResolution());
		ResultOne<RepositoryStatus> result = new ResultOne<>();
		result.setResponse(OK);
		result.setEntity(RESULT_KEY_REPOSITORY_STATUS, status);
		return result;
	}

	@GetMapping(value = DIFF_CONFLICTED_FILE, produces = APPLICATION_JSON_VALUE)
	public ResultOne<DiffConflictedFile> getDiffForConflictedFile(@ValidSiteId @PathVariable String siteId,
								      @ValidExistingContentPath @RequestParam(value = REQUEST_PARAM_PATH) String path)
		throws ServiceLayerException {
		String diffPath = path;
		if (!diffPath.startsWith(FILE_SEPARATOR)) {
			diffPath = FILE_SEPARATOR + diffPath;
		}
		DiffConflictedFile diff = repositoryManagementService.getDiffForConflictedFile(siteId, diffPath);
		ResultOne<DiffConflictedFile> result = new ResultOne<>();
		result.setEntity(RESULT_KEY_DIFF, diff);
		result.setResponse(OK);
		return result;
	}

	@PostMapping(value = COMMIT_RESOLUTION, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public ResultOne<RepositoryStatus> commitConflictResolution(@ValidSiteId @PathVariable String siteId,
																@Valid @RequestBody CommitResolutionRequest commitResolutionRequest)
		throws ServiceLayerException {
		RepositoryStatus status = repositoryManagementService.commitResolution(siteId,
			commitResolutionRequest.getCommitMessage());
		ResultOne<RepositoryStatus> result = new ResultOne<>();
		result.setEntity(RESULT_KEY_REPOSITORY_STATUS, status);
		result.setResponse(OK);
		return result;
	}

	@PostMapping(value = CANCEL_FAILED_PULL, produces = APPLICATION_JSON_VALUE)
	public ResultOne<RepositoryStatus> cancelFailedPull(@ValidSiteId @PathVariable String siteId)
		throws ServiceLayerException {
		RepositoryStatus status = repositoryManagementService.cancelFailedPull(siteId);
		ResultOne<RepositoryStatus> result = new ResultOne<>();
		result.setEntity(RESULT_KEY_REPOSITORY_STATUS, status);
		result.setResponse(OK);
		return result;
	}

	@PostMapping(value = UNLOCK, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public Result unlockRepository(@Valid @RequestBody UnlockRepositoryRequest unlockRepositoryRequest) throws ServiceLayerException {
		repositoryManagementService.unlockRepository(unlockRepositoryRequest.getSiteId(), unlockRepositoryRequest.getRepositoryType());
		Result result = new Result();
		result.setResponse(OK);
		return result;
	}

	@GetMapping(value = CORRUPTED, produces = APPLICATION_JSON_VALUE)
	public ResultOne<Boolean> isRepositoryCorrupted(@ValidSiteId @RequestParam(required = false) String siteId,
							@RequestParam GitRepositories repositoryType)
		throws ServiceLayerException {
		ResultOne<Boolean> result = new ResultOne<>();
		result.setResponse(OK);
		result.setEntity(RESULT_KEY_CORRUPTED,
			repositoryManagementService.isCorrupted(siteId, repositoryType));
		return result;
	}

	@PostMapping(value = REPAIR, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public Result repairCorruptedRepository(@Valid @RequestBody RepairRepositoryRequest request)
		throws ServiceLayerException {
		repositoryManagementService.repairCorrupted(request.getSiteId(), request.getRepositoryType());

		Result result = new Result();
		result.setResponse(OK);

		return result;
	}

}
