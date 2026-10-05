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
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.io.FilenameUtils;
import org.apache.commons.io.IOUtils;
import org.craftercms.commons.validation.ValidationException;
import org.craftercms.commons.validation.annotations.param.*;
import org.craftercms.studio.api.v1.exception.ContentNotFoundException;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v2.content.LifecycleContent;
import org.craftercms.studio.api.v2.dal.QuickCreateItem;
import org.craftercms.studio.api.v2.dal.item.ContentItem;
import org.craftercms.studio.api.v2.dal.item.LightItem;
import org.craftercms.studio.api.v2.exception.repository.RepositoryException;
import org.craftercms.studio.api.v2.service.clipboard.ClipboardService;
import org.craftercms.studio.api.v2.service.content.ContentService;
import org.craftercms.studio.api.v2.service.content.ContentTypeService;
import org.craftercms.studio.api.v2.service.dependency.DependencyService;
import org.craftercms.studio.api.v2.utils.StudioUtils;
import org.craftercms.studio.model.history.ItemVersion;
import org.craftercms.studio.model.history.RepositoryVersion;
import org.craftercms.studio.model.rest.Result;
import org.craftercms.studio.model.rest.ResultList;
import org.craftercms.studio.model.rest.ResultOne;
import org.craftercms.studio.model.rest.clipboard.DuplicateRequest;
import org.craftercms.studio.model.rest.clipboard.PasteRequest;
import org.craftercms.studio.model.rest.content.*;
import org.craftercms.studio.model.rest.content.GetChildrenBulkRequest.PathParams;
import org.craftercms.studio.model.rest.content.order.ItemOrder;
import org.craftercms.studio.model.rest.content.order.ReorderItemRequest;
import org.dom4j.Document;
import org.eclipse.jgit.lib.Constants;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.beans.ConstructorProperties;
import java.io.IOException;
import java.io.InputStream;
import java.util.*;
import java.util.stream.Collectors;

import static java.nio.charset.StandardCharsets.UTF_8;
import static java.util.function.Function.identity;
import static java.util.stream.Collectors.toMap;
import static org.apache.commons.lang3.Strings.CS;
import static org.craftercms.commons.validation.annotations.param.EsapiValidationType.ALPHANUMERIC;
import static org.craftercms.studio.api.v1.constant.StudioConstants.FILE_SEPARATOR;
import static org.craftercms.studio.api.v1.constant.StudioConstants.INDEX_FILE;
import static org.craftercms.studio.controller.rest.v2.RequestConstants.*;
import static org.craftercms.studio.controller.rest.v2.RequestMappingConstants.*;
import static org.craftercms.studio.controller.rest.v2.ResultConstants.*;
import static org.craftercms.studio.model.rest.ApiResponse.CREATED;
import static org.craftercms.studio.model.rest.ApiResponse.OK;
import static org.craftercms.studio.model.rest.content.WriteContentRequest.WRITE_COMMENT_MAX_LENGTH;
import static org.springframework.http.MediaType.*;

@Validated
@RestController
@RequestMapping(API_2 + CONTENT)
public class ContentController {

	private final ContentService contentService;
	private final ContentTypeService contentTypeService;
	private final DependencyService dependencyService;

	//TODO: Migrate logic to new content service
	private final ClipboardService clipboardService;

	@ConstructorProperties({"contentService", "dependencyService", "clipboardService", "contentTypeService"})
	public ContentController(ContentService contentService, DependencyService dependencyService,
							 ClipboardService clipboardService, ContentTypeService contentTypeService) {
		this.contentService = contentService;
		this.dependencyService = dependencyService;
		this.clipboardService = clipboardService;
		this.contentTypeService = contentTypeService;
	}

	@GetMapping(value = SITE_ID + EXISTS, produces = APPLICATION_JSON_VALUE)
	public ResultOne<Boolean> contentExists(@NotEmpty @ValidSiteId @PathVariable String siteId,
											@ValidExistingContentPath @ValidateSecurePathParam @RequestParam String path)
			throws SiteNotFoundException {
		var result = new ResultOne<Boolean>();
		result.setEntity(RESULT_KEY_EXISTS, contentService.contentExists(siteId, path));
		result.setResponse(OK);
		return result;
	}

	@GetMapping(value = SITE_ID + LIST_QUICK_CREATE_CONTENT, produces = APPLICATION_JSON_VALUE)
	public ResultList<QuickCreateItem> listQuickCreateContent(@NotBlank @ValidSiteId @PathVariable String siteId)
			throws ServiceLayerException {
		List<QuickCreateItem> items = contentTypeService.getQuickCreatableContentTypes(siteId);
		ResultList<QuickCreateItem> result = new ResultList<>();
		result.setResponse(OK);
		result.setEntities(RESULT_KEY_ITEMS, items);
		return result;
	}

	@PostMapping(value = SITE_ID + GET_DELETE_PACKAGE, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public ResultOne<Map<String, Collection<LightItem>>> getDeletePackage(@ValidSiteId @PathVariable String siteId,
																		 @RequestBody @Valid GetDeletePackageRequestBody request) throws SiteNotFoundException {
		List<LightItem> childItems = contentService.getChildItems(siteId, request.getPaths());
		Collection<LightItem> dependentItems = dependencyService.getDependentPaths(siteId, request.getPaths());
		ResultOne<Map<String, Collection<LightItem>>> result = new ResultOne<>();
		result.setResponse(OK);
		Map<String, Collection<LightItem>> items = new HashMap<>();
		items.put(RESULT_KEY_CHILD_ITEMS, childItems);
		items.put(RESULT_KEY_DEPENDENT_ITEMS, dependentItems);
		result.setEntity(RESULT_KEY_ITEMS, items);
		return result;
	}

	@PostMapping(value = SITE_ID + DELETE, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public Result delete(@ValidSiteId @PathVariable String siteId, @RequestBody @Validated DeleteRequestBody deleteRequestBody)
			throws UserNotFoundException, ServiceLayerException, AuthenticationException {
		UnwrappedResult<DeleteContentResult> result = UnwrappedResult.of(contentService.deleteContent(siteId,
				deleteRequestBody.getItems(), deleteRequestBody.getTitle(),
				deleteRequestBody.getComment()));
		result.setResponse(OK);
		return result;
	}

	@PostMapping(value = GET_CHILDREN_BY_PATHS, produces = APPLICATION_JSON_VALUE, consumes = APPLICATION_JSON_VALUE)
	public Result getChildrenByPaths(@PathVariable @ValidSiteId String siteId, @Valid @RequestBody GetChildrenBulkRequest request)
			throws ServiceLayerException, UserNotFoundException {
		Map<String, PathParams> paramsMap = request.getPaths().stream()
				.collect(toMap(PathParams::getPath, identity(), (existing, replacement) -> existing));
		GetChildrenByPathsBulkResult children = contentService.getChildrenByPaths(siteId,
				new ArrayList<>(paramsMap.keySet()), paramsMap);
		Result result = UnwrappedResult.of(children);
		result.setResponse(OK);
		return result;
	}

	@GetMapping(value = SITE_ID + GET_DESCRIPTOR, produces = APPLICATION_JSON_VALUE)
	public ResultOne<String> getDescriptor(@NotEmpty @ValidSiteId @PathVariable String siteId,
										   @ValidExistingContentPath @ValidateSecurePathParam @RequestParam String path,
										   @RequestParam(required = false, defaultValue = "false") boolean flatten) throws
			ContentNotFoundException, SiteNotFoundException {
		Document descriptor = contentService.getItemDescriptor(siteId, path, flatten);
		var result = new ResultOne<String>();
		result.setResponse(OK);
		result.setEntity(RESULT_KEY_XML, descriptor.asXML());
		return result;
	}

	@PostMapping(value = PASTE_ITEMS, produces = APPLICATION_JSON_VALUE, consumes = APPLICATION_JSON_VALUE)
	public ResultList<String> pasteItems(@ValidSiteId @PathVariable String siteId,
										 @Valid @RequestBody PasteRequest request) throws Exception {
		var result = new ResultList<String>();
		result.setResponse(OK);
		result.setEntities(RESULT_KEY_ITEMS,
				clipboardService.pasteItems(siteId, request.getOperation(),
						request.getTargetPath(), request.getSourcePath(), request.isIncludeChildren()));

		return result;
	}

	@PostMapping(value = SITE_ID + DUPLICATE_ITEM, produces = APPLICATION_JSON_VALUE, consumes = APPLICATION_JSON_VALUE)
	public ResultOne<String> duplicateItem(@ValidSiteId @PathVariable String siteId, @Valid @RequestBody DuplicateRequest request) throws Exception {
		var result = new ResultOne<String>();
		result.setResponse(OK);
		result.setEntity(RESULT_KEY_ITEM,
				clipboardService.duplicateItem(siteId, request.getPath()));

		return result;
	}

	@GetMapping(value = SITE_ID + ITEM_BY_PATH, produces = APPLICATION_JSON_VALUE)
	public ResultOne<ContentItem> getItemByPath(@ValidSiteId @PathVariable String siteId,
												@ValidExistingContentPath
												@RequestParam(value = REQUEST_PARAM_PATH) String path,
												@RequestParam(value = REQUEST_PARAM_PREFER_CONTENT, required = false,
														defaultValue = "false") boolean preferContent)
			throws ServiceLayerException, UserNotFoundException {
		ContentItem detailedItem = contentService.getItemByPath(siteId, path, preferContent);
		ResultOne<ContentItem> result = new ResultOne<>();
		result.setEntity(RESULT_KEY_ITEM, detailedItem);
		result.setResponse(OK);
		return result;
	}

	@PostMapping(value = SITE_ID + SANDBOX_ITEMS_BY_PATH, produces = APPLICATION_JSON_VALUE, consumes = APPLICATION_JSON_VALUE)
	public GetContentItemsByPathResult getSandboxItemsByPath(@ValidSiteId @PathVariable String siteId,
															@RequestBody @Valid GetSandboxItemsByPathRequestBody request)
			throws ServiceLayerException, UserNotFoundException {
		Collection<String> missing = Collections.emptyList();
		List<String> paths = request.getPaths();
		boolean preferContent = request.isPreferContent();
		List<ContentItem> sandboxItems = contentService.getContentItemsByPath(siteId, paths, preferContent);

		if (CollectionUtils.isEmpty(sandboxItems) || paths.size() != sandboxItems.size()) {
			List<String> found = sandboxItems.stream().map(ContentItem::getPath).collect(Collectors.toList());
			if (preferContent) {
				found.addAll(sandboxItems.stream().map(si -> CS.replace(si.getPath(),
						FILE_SEPARATOR + INDEX_FILE, "")).toList());
			}
			missing = CollectionUtils.subtract(paths, found);
		}

		GetContentItemsByPathResult result = new GetContentItemsByPathResult();
		result.setEntities(RESULT_KEY_ITEMS, sandboxItems);
		result.setMissingItems(missing);
		result.setResponse(OK);
		return result;
	}

	@PostMapping(value = SITE_ID + ITEM_LOCK_BY_PATH, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public Result itemLockByPath(@ValidSiteId @PathVariable String siteId, @RequestBody @Valid LockItemByPathRequest request)
			throws UserNotFoundException, ServiceLayerException {
		contentService.lockContent(siteId, request.getPath());
		Result result = new Result();
		result.setResponse(OK);
		return result;
	}

	@PostMapping(value = SITE_ID + ITEM_UNLOCK_BY_PATH, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public Result itemUnlockByPath(@ValidSiteId @PathVariable String siteId, @RequestBody @Valid UnlockItemByPathRequest request)
			throws ContentNotFoundException, SiteNotFoundException, RepositoryException {
		contentService.unlockContent(siteId, request.getPath());
		Result result = new Result();
		result.setResponse(OK);
		return result;
	}

	@Valid
	@GetMapping(SITE_ID + GET_CONTENT_BY_COMMIT_ID)
	public ResponseEntity<Resource> getContentByCommitId(@ValidSiteId @PathVariable String siteId,
														 @ValidExistingContentPath @RequestParam(value = REQUEST_PARAM_PATH) String path,
														 @NotBlank @EsapiValidatedParam(type = ALPHANUMERIC) @RequestParam(value = REQUEST_PARAM_COMMIT_ID) String commitId)
			throws ServiceLayerException, UserNotFoundException {
		Resource resource = contentService.getContentByCommitId(siteId, path, commitId).orElseThrow();

		String mimeType = StudioUtils.getMimeType(path);
		return ResponseEntity
				.ok()
				.contentType(parseMediaType(mimeType))
				.body(resource);
	}

	@PostMapping(value = SITE_ID, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public ResponseEntity<Result> write(@PathVariable @ValidSiteId String siteId,
										@Valid @RequestBody WriteContentRequest writeContentRequest)
			throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		return writeContent(siteId, writeContentRequest.getPath(), IOUtils.toInputStream(writeContentRequest.getContent(), UTF_8),
				writeContentRequest.getComment());
	}

	@PutMapping(value = SITE_ID, consumes = MULTIPART_FORM_DATA_VALUE, produces = APPLICATION_JSON_VALUE)
	public ResponseEntity<Result> upload(@PathVariable @ValidSiteId String siteId,
										 @RequestParam MultipartFile file,
										 @NotEmpty @ValidNewContentPath @RequestPart(REQUEST_PARAM_PATH) String path,
										 @RequestParam(required = false) @Size(max = WRITE_COMMENT_MAX_LENGTH) String comment)
			throws ServiceLayerException, UserNotFoundException, AuthenticationException, IOException {
		return writeContent(siteId, path, file.getInputStream(), comment);
	}

	private ResponseEntity<Result> writeContent(final String siteId,
												final String path,
												final InputStream content,
												final String comment)
			throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		WriteContentResult writeResult = contentService.write(siteId, path, content, comment);
		boolean isNew = writeResult.getItems().stream()
				.filter(i -> CS.equals(i.path(), path))
				.map(WriteContentResult.WriteContentResultItem::operation)
				.anyMatch(LifecycleContent.LifecycleOperation.NEW::equals);
		UnwrappedResult<WriteContentResult> result = UnwrappedResult.of(writeResult);
		result.setResponse(isNew ? CREATED : OK);

		return ResponseEntity
				.status(isNew ? HttpStatus.CREATED : HttpStatus.OK)
				.body(result);
	}

	@PostMapping(value = SITE_ID + RENAME, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public Result rename(@ValidSiteId @PathVariable String siteId, @Valid @RequestBody RenameRequestBody renameRequestBody)
			throws AuthenticationException, UserNotFoundException, ServiceLayerException, ValidationException {
		contentService.renameContent(siteId, renameRequestBody.getPath(), renameRequestBody.getName());
		var result = new Result();
		result.setResponse(OK);
		return result;
	}

	@PostMapping(value = MOVE, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public Result move(@ValidSiteId @PathVariable String siteId, @Valid @RequestBody MoveRequestBody moveRequestBody)
			throws AuthenticationException, UserNotFoundException, ServiceLayerException, ValidationException {
		UnwrappedResult<WriteContentResult> result = UnwrappedResult.of(
				contentService.move(siteId, moveRequestBody.getSourcePath(), moveRequestBody.getTargetPath())
		);
		result.setResponse(OK);
		return result;
	}

	@PostMapping(value = MOVE_AND_UPDATE, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public Result moveAndUpdate(@ValidSiteId @PathVariable String siteId, @Valid @RequestBody MoveAndUpdateRequestBody requestBody)
			throws AuthenticationException, ServiceLayerException, UserNotFoundException {
		UnwrappedResult<WriteContentResult> result = UnwrappedResult.of(
				contentService.moveAndUpdate(siteId, requestBody.getSourcePath(), requestBody.getTargetPath(), requestBody.getContent())
		);
		result.setResponse(OK);
		return result;
	}

	@GetMapping(value = SITE_ID + ITEM_HISTORY, produces = APPLICATION_JSON_VALUE)
	public ResultList<ItemVersion> getHistory(@ValidSiteId @PathVariable String siteId,
											  @ValidExistingContentPath @RequestParam(value = REQUEST_PARAM_PATH) String path) throws ServiceLayerException {
		ResultList<ItemVersion> result = new ResultList<>();
		result.setResponse(OK);
		result.setEntities(RESULT_KEY_ITEMS, contentService.getContentVersionHistory(siteId, path));

		return result;
	}

	@GetMapping(value = SITE_HISTORY, produces = APPLICATION_JSON_VALUE)
	public ResultList<RepositoryVersion> history(@ValidSiteId @PathVariable String siteId,
												 @NotEmpty @RequestParam(defaultValue = Constants.HEAD) String start,
												 @Positive @RequestParam(defaultValue = "10") int limit) throws ServiceLayerException {
		ResultList<RepositoryVersion> result = new ResultList<>();
		result.setEntities(RESULT_KEY_ITEMS, contentService.getHistory(siteId, start, limit));
		result.setResponse(OK);
		return result;
	}

	@PostMapping(value = REVERT, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public Result revert(@ValidSiteId @PathVariable String siteId, @Valid @RequestBody RevertRequestBody revertRequestBody)
			throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		contentService.revert(siteId, revertRequestBody.getPath(), revertRequestBody.getCommitId());
		var result = new Result();
		result.setResponse(OK);
		return result;
	}

	@PostMapping(value = FOLDER, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.CREATED)
	public Result createFolder(@ValidSiteId @PathVariable String siteId, @Valid @RequestBody CreateFolderRequestBody requestBody)
			throws UserNotFoundException, ServiceLayerException, AuthenticationException {
		// This clean up is added here so the permission and validation annotations on the path parameter
		// of the service can be applied correctly
		String folderPath = requestBody.getPath()
				.transform(FilenameUtils::normalizeNoEndSeparator)
				.transform(s -> CS.prependIfMissing(s, FILE_SEPARATOR));
		WriteContentResult createFolderResult = contentService.createFolder(siteId, folderPath);
		UnwrappedResult<WriteContentResult> result = UnwrappedResult.of(createFolderResult);
		result.setResponse(CREATED);
		return result;
	}

	@GetMapping(value = GET_ITEMS_ORDER, produces = APPLICATION_JSON_VALUE)
	public ResultList<ItemOrder> getItemsOrder(@ValidSiteId @PathVariable String siteId, @NotEmpty @ValidExistingContentPath @RequestParam String parentPath) throws ServiceLayerException {
		ResultList<ItemOrder> result = new ResultList<>();
		List<ItemOrder> itemsOrder = contentService.getItemsOrder(siteId, parentPath);
		result.setEntities(RESULT_KEY_ITEMS, itemsOrder);
		result.setResponse(OK);
		return result;
	}

	@PostMapping(value = REORDER_ITEM, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public ResultOne<Double> reorderItem(@ValidSiteId @PathVariable String siteId, @Valid @RequestBody ReorderItemRequest request) throws ServiceLayerException {
		ResultOne<Double> result = new ResultOne<>();
		result.setEntity(RESULT_KEY_ORDER, contentService.reorderItem(siteId, request));
		result.setResponse(OK);
		return result;
	}
}
