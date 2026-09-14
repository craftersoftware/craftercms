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
package org.craftercms.studio.impl.v2.service.clipboard.internal;

import org.craftercms.studio.api.v1.exception.ContentNotFoundException;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v1.service.GeneralLockService;
import org.craftercms.studio.api.v2.annotation.precondition.RequireContentExists;
import org.craftercms.studio.api.v2.annotation.resourceids.ContentPath;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage;
import org.craftercms.studio.api.v2.exception.InvalidParametersException;
import org.craftercms.studio.api.v2.exception.content.ContentInPublishQueueException;
import org.craftercms.studio.api.v2.exception.content.ContentMoveInvalidLocation;
import org.craftercms.studio.api.v2.repository.GitContentRepository;
import org.craftercms.studio.api.v2.service.clipboard.ClipboardService;
import org.craftercms.studio.api.v2.service.content.ContentService;
import org.craftercms.studio.api.v2.service.item.ItemService;
import org.craftercms.studio.api.v2.service.publish.PublishService;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.craftercms.studio.api.v2.utils.StudioUtils;
import org.craftercms.studio.model.clipboard.Operation;
import org.craftercms.studio.model.rest.content.PasteContentResult;
import org.craftercms.studio.model.rest.content.WriteContentResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.beans.ConstructorProperties;
import java.util.*;

import static java.lang.String.format;
import static org.apache.commons.collections4.CollectionUtils.isNotEmpty;
import static org.apache.commons.lang3.Strings.CS;
import static org.craftercms.studio.api.v1.constant.DmConstants.SLASH_INDEX_FILE;
import static org.craftercms.studio.api.v2.utils.StudioUtils.getSandboxRepoLockKey;
import static org.craftercms.studio.api.v2.utils.StudioUtils.isPageDescriptor;
import static org.craftercms.studio.impl.v1.util.ContentUtils.getParentUrl;
import static org.craftercms.studio.model.clipboard.Operation.CUT;

/**
 * Default implementation of {@link ClipboardService}
 *
 * <p>Note: This class could be removed in the future if the logic is moved to the new content service</p>
 *
 * @author joseross
 * @since 3.2
 */
public class ClipboardServiceInternalImpl implements ClipboardService {

	private static final Logger logger = LoggerFactory.getLogger(ClipboardServiceInternalImpl.class);

	protected final PublishService publishService;
	protected final ItemService itemService;
	protected final GeneralLockService generalLockService;
	protected final ContentService contentService;
	protected final GitContentRepository contentRepository;
	protected final SitesService sitesService;

	@ConstructorProperties({"contentRepository",
			"publishService", "itemService",
			"generalLockService", "contentService",
			"sitesService"})
	public ClipboardServiceInternalImpl(GitContentRepository contentRepository,
										PublishService publishService, ItemService itemService,
										GeneralLockService generalLockService, ContentService contentService,
										SitesService sitesService) {
		this.contentRepository = contentRepository;
		this.publishService = publishService;
		this.itemService = itemService;
		this.generalLockService = generalLockService;
		this.contentService = contentService;
		this.sitesService = sitesService;
	}

	protected void validatePasteItemsAction(final String siteId, Operation operation, final String sourcePath, final String targetPath)
			throws ServiceLayerException {
		if (!contentService.contentExists(siteId, targetPath)) {
			throw new ContentNotFoundException(targetPath, siteId, format("Target path '%s' does not exist. " +
					"Unable to perform paste operation", targetPath));
		}
		if (!isPageDescriptor(targetPath) && !contentRepository.isFolder(siteId, targetPath)) {
			throw new InvalidParametersException(format("Invalid paste target '%s' in site '%s'. " +
					"Only pages and folders can contain children", targetPath, siteId));
		}
		if (!contentService.contentExists(siteId, sourcePath)) {
			throw new ContentNotFoundException(sourcePath, siteId, format("No content found at path '%s' " +
					"Unable to perform paste operation", sourcePath));
		}
		String sourceTopLevel = StudioUtils.getTopLevelFolder(sourcePath);
		String targetTopLevel = StudioUtils.getTopLevelFolder(targetPath);

		if (!Objects.equals(sourceTopLevel, targetTopLevel)) {
			throw new InvalidParametersException(format("Cannot perform paste operation " +
							"from '%s' (%s) into '%s' (%s) for site '%s'. " +
							"Pasting across top level folders is not supported.",
					sourcePath, sourceTopLevel, targetPath, targetTopLevel, siteId));
		}

		if (CUT == operation) {
			String sourceDirectory = getParentUrl(sourcePath);
			String targetDirectory = CS.removeEnd(targetPath, SLASH_INDEX_FILE);
			if (sourceDirectory.equals(targetDirectory)) {
				throw new ContentMoveInvalidLocation(format("Cannot perform cut-paste operation from '%s' to the same location '%s' for site '%s'",
						sourcePath, targetPath, siteId));
			}

			Collection<PublishPackage> packagesForItems = publishService.getActivePackagesForItems(siteId, List.of(sourcePath), true);
			if (isNotEmpty(packagesForItems)) {
				throw new ContentInPublishQueueException("Unable to cut content that is part of an active publish package", packagesForItems);
			}
		}

		List<String> pathsToCheck = operation == CUT
				? List.of(sourcePath, targetPath)
				: List.of(targetPath);
		if (itemService.isSystemProcessing(siteId, pathsToCheck)) {
			throw new ServiceLayerException(format("Failed to paste items at site '%s' paths '%s' " +
							"because some items are being processed  (Object State is system processing)",
					siteId, pathsToCheck));
		}
	}

	@Override
	public List<String> pasteItems(String siteId, Operation operation, String targetPath, String sourcePath, boolean includeChildren)
			throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		// Lock the sandbox repository to prevent publish packages being submitted (cut-paste operations might conflict with submitted packages)
		String sandboxRepoLockKey = getSandboxRepoLockKey(siteId);
		generalLockService.lock(sandboxRepoLockKey);
		try {
			validatePasteItemsAction(siteId, operation, sourcePath, targetPath);
			var pastedItems = new LinkedList<String>();

			switch (operation) {
				case COPY:
					pastedItems.addAll(copyPasteItems(siteId, targetPath, sourcePath, includeChildren));
					break;
				case CUT:
					PasteContentResult moveResult = contentService.moveToParentPath(siteId, sourcePath, targetPath);
					pastedItems.add(moveResult.getTargetPath());
					break;
			}
			logger.trace("'{}' items pasted in site '{}' from '{}' to '{}'",
					pastedItems.size(), siteId, sourcePath, targetPath);
			return pastedItems;
		} finally {
			generalLockService.unlock(sandboxRepoLockKey);
		}
	}

	/**
	 * Performs a copy-paste operation.
	 *
	 * @param siteId          the site id
	 * @param targetPath      the target path where the item will be pasted
	 * @param sourcePath      the source path of the item to be copied
	 * @param includeChildren whether to include children of the source item in the operation (applies to copy only)
	 * @return a list of new full paths of the pasted items
	 * @throws ServiceLayerException if an error occurs while performing the copy-paste operation
	 * @throws UserNotFoundException if the user performing the operation is not found
	 */
	protected List<String> copyPasteItems(String siteId, String targetPath, String sourcePath, boolean includeChildren)
			throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		Set<String> copyPaths = new HashSet<>();
		copyPaths.add(sourcePath);

		if (includeChildren) {
			Site site = sitesService.getSite(siteId);
			copyPaths.addAll(itemService.getChildrenPaths(site.getId(), sourcePath));
		}

		PasteContentResult copyResult = contentService.copy(siteId, sourcePath, targetPath, copyPaths);
		return copyResult.getItems().stream()
				.map(WriteContentResult.WriteContentResultItem::path)
				.toList();
	}

	@RequireContentExists
	public String duplicateItem(@SiteId String siteId, @ContentPath String path) throws ServiceLayerException, AuthenticationException, UserNotFoundException {
		PasteContentResult pasteContentResult = contentService.duplicate(siteId, path);
		String pastedTargetPath = pasteContentResult.getTargetPath();
		if (isPageDescriptor(path)) {
			pastedTargetPath += SLASH_INDEX_FILE;
		}

		return pastedTargetPath;
	}

}
