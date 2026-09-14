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

package org.craftercms.studio.impl.v2.service.audit;

import org.craftercms.commons.security.permissions.DefaultPermission;
import org.craftercms.commons.security.permissions.annotations.HasPermission;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteReady;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.dal.AuditLog;
import org.craftercms.studio.api.v2.dal.CommitAuthor;
import org.craftercms.studio.api.v2.service.audit.AuditService;

import java.beans.ConstructorProperties;
import java.time.ZonedDateTime;
import java.util.List;

import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_AUDIT_LOG;

/**
 * Default implementation of {@link AuditService}
 */
public class AuditServiceImpl implements AuditService {

	private final AuditService auditServiceInternal;

	@ConstructorProperties({"auditServiceInternal"})
	public AuditServiceImpl(final AuditService auditServiceInternal) {
		this.auditServiceInternal = auditServiceInternal;
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_AUDIT_LOG)
	public List<AuditLog> getAuditLog(@SiteId String siteId,
					  int offset, int limit,
					  String user,
					  List<String> operations,
					  boolean includeParameters, ZonedDateTime dateFrom,
					  ZonedDateTime dateTo,
					  String target,
					  String origin,
					  String clusterNodeId,
					  String sort,
					  String order) throws SiteNotFoundException {
		return auditServiceInternal.getAuditLog(siteId, offset, limit, user, operations, includeParameters,
			dateFrom, dateTo, target, origin, clusterNodeId, sort, order);
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_AUDIT_LOG)
	public int getAuditLogTotal(@SiteId String siteId, String user, List<String> operations, boolean includeParameters, ZonedDateTime dateFrom, ZonedDateTime dateTo,
				    String target, String origin, String clusterNodeId) throws SiteNotFoundException {
		return auditServiceInternal.getAuditLogTotal(siteId, user, operations, includeParameters, dateFrom,
			dateTo, target, origin, clusterNodeId);
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_AUDIT_LOG)
	public AuditLog getAuditLogEntry(@SiteId final String siteId, final long auditLogId) throws SiteNotFoundException {
		return auditServiceInternal.getAuditLogEntry(siteId, auditLogId);
	}

	@Override
	// TODO: what permission is needed here?
	public boolean insertAuditLog(AuditLog auditLog) {
		return auditServiceInternal.insertAuditLog(auditLog);
	}

	@Override
	public List<CommitAuthor> getCommitAuthors(long siteId, List<String> commitIds, String path) {
		return auditServiceInternal.getCommitAuthors(siteId, commitIds, path);
	}
}
