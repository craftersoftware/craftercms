/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

package org.craftercms.studio.impl.v2.service.repository;

import org.craftercms.commons.security.permissions.DefaultPermission;
import org.craftercms.commons.security.permissions.annotations.HasPermission;
import org.craftercms.commons.security.permissions.annotations.ProtectedResourceId;
import org.craftercms.studio.api.v1.constant.GitRepositories;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.repository.InvalidRemoteRepositoryCredentialsException;
import org.craftercms.studio.api.v1.exception.repository.InvalidRemoteUrlException;
import org.craftercms.studio.api.v1.exception.repository.RemoteNotRemovableException;
import org.craftercms.studio.api.v1.exception.repository.RemoteRepositoryNotFoundException;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteExists;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteReady;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.dal.DiffConflictedFile;
import org.craftercms.studio.api.v2.dal.repository.RemoteRepository;
import org.craftercms.studio.api.v2.dal.repository.RemoteRepositoryInfo;
import org.craftercms.studio.api.v2.dal.repository.RepositoryStatus;
import org.craftercms.studio.api.v2.service.repository.ConflictResolution;
import org.craftercms.studio.api.v2.service.repository.MergeResult;
import org.craftercms.studio.api.v2.service.repository.RepositoryManagementService;

import java.beans.ConstructorProperties;
import java.util.List;

import static org.craftercms.studio.permissions.StudioPermissionsConstants.*;

@RequireSiteReady
public class RepositoryManagementServiceImpl implements RepositoryManagementService {

	private final RepositoryManagementService repositoryManagementServiceInternal;

	@ConstructorProperties({"repositoryManagementServiceInternal"})
	public RepositoryManagementServiceImpl(final RepositoryManagementService repositoryManagementServiceInternal) {
		this.repositoryManagementServiceInternal = repositoryManagementServiceInternal;
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_ADD_REMOTE)
	public void addRemote(@SiteId String siteId, RemoteRepository remoteRepository) throws ServiceLayerException, InvalidRemoteUrlException {
		repositoryManagementServiceInternal.addRemote(siteId, remoteRepository);
	}

	@Override
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_LIST_REMOTES)
	public List<RemoteRepositoryInfo> listRemotes(@SiteId String siteId)
		throws ServiceLayerException {
		return repositoryManagementServiceInternal.listRemotes(siteId);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_PULL_FROM_REMOTE)
	public MergeResult pullFromRemote(@SiteId String siteId, String remoteName,
					  String remoteBranch, String mergeStrategy)
		throws InvalidRemoteUrlException, ServiceLayerException,
		InvalidRemoteRepositoryCredentialsException, RemoteRepositoryNotFoundException {
		return repositoryManagementServiceInternal.pullFromRemote(siteId, remoteName, remoteBranch,
			mergeStrategy);
	}


	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_PUSH_TO_REMOTE)
	public boolean pushToRemote(@SiteId String siteId, String remoteName,
				    String remoteBranch, boolean force)
		throws InvalidRemoteUrlException, ServiceLayerException,
		InvalidRemoteRepositoryCredentialsException, RemoteRepositoryNotFoundException {
		return repositoryManagementServiceInternal.pushToRemote(siteId, remoteName, remoteBranch, force);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_REMOVE_REMOTE)
	public boolean removeRemote(@SiteId String siteId, String remoteName)
		throws SiteNotFoundException, RemoteNotRemovableException {
		return repositoryManagementServiceInternal.removeRemote(siteId, remoteName);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_SITE_STATUS)
	public RepositoryStatus getRepositoryStatus(@SiteId String siteId)
		throws ServiceLayerException {
		return repositoryManagementServiceInternal.getRepositoryStatus(siteId);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_RESOLVE_CONFLICT)
	public RepositoryStatus resolveConflict(@SiteId String siteId,
						@ProtectedResourceId(PATH_RESOURCE_ID) String path, ConflictResolution resolution)
		throws ServiceLayerException {
		return repositoryManagementServiceInternal.resolveConflict(siteId, path, resolution);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_SITE_DIFF_CONFLICTED_FILE)
	public DiffConflictedFile getDiffForConflictedFile(@SiteId String siteId,
							   @ProtectedResourceId(PATH_RESOURCE_ID) String path)
		throws ServiceLayerException {
		return repositoryManagementServiceInternal.getDiffForConflictedFile(siteId, path);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_COMMIT_RESOLUTION)
	public RepositoryStatus commitResolution(@SiteId String siteId,
						 String commitMessage) throws ServiceLayerException {
		return repositoryManagementServiceInternal.commitResolution(siteId, commitMessage);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CANCEL_FAILED_PULL)
	public RepositoryStatus cancelFailedPull(@SiteId String siteId)
		throws ServiceLayerException {
		return repositoryManagementServiceInternal.cancelFailedPull(siteId);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_UNLOCK_REPO)
	public void unlockRepository(@SiteId String siteId,
					GitRepositories repositoryType) throws ServiceLayerException {
		repositoryManagementServiceInternal.unlockRepository(siteId, repositoryType);
	}

	@Override
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_REPAIR_REPOSITORY)
	public boolean isCorrupted(String siteId, GitRepositories repositoryType) throws ServiceLayerException {
		return repositoryManagementServiceInternal.isCorrupted(siteId, repositoryType);
	}

	@Override
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_REPAIR_REPOSITORY)
	public void repairCorrupted(String siteId, GitRepositories repositoryType) throws ServiceLayerException {
		repositoryManagementServiceInternal.repairCorrupted(siteId, repositoryType);
	}
}
