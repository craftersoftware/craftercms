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

package org.craftercms.studio.model.contentType;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.craftercms.studio.api.v2.dal.security.NormalizedRole;
import org.craftercms.studio.api.v2.utils.StudioUtils;

import java.util.*;

import static java.util.Collections.emptyList;
import static org.apache.commons.collections4.CollectionUtils.emptyIfNull;

/**
 * Represents a content type in the system.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class ContentType {
	@JsonAlias("content-type")
	@JsonProperty("id")
	protected String id;
	@JsonAlias("title")
	@JsonProperty("label")
	protected String label;
	@JsonAlias("allowed-roles")
	@JsonProperty("allowedRoles")
	protected Collection<NormalizedRole> allowedRoles = emptyList();
	@JsonAlias("delete-dependencies")
	@JsonProperty("deleteDependencies")
	protected List<DeleteDependency> deleteDependencies = emptyList();
	@JsonAlias("copy-dependencies")
	@JsonProperty("copyDependencies")
	protected List<CopyDependency> copyDependencies = emptyList();
	protected boolean previewable;
	protected String imageThumbnail;
	// Because both excludes and excludes need to be set together, we use a single property for both, and ignore it during serialization
	// so the JSON representation still has the same structure as before, with separate includes and excludes properties
	@JsonProperty(value = "paths", access = JsonProperty.Access.WRITE_ONLY)
	protected PathIncludeExcludes pathIncludeExcludes;
	protected boolean quickCreate;
	protected String quickCreatePath;

	public Collection<NormalizedRole> getAllowedRoles() {
		return allowedRoles;
	}

	public void setAllowedRoles(Collection<String> allowedRoles) {
		Set<NormalizedRole> normalizedRoles = new HashSet<>();
		for (String role : emptyIfNull(allowedRoles)) {
			normalizedRoles.add(new NormalizedRole(role));
		}
		this.allowedRoles = normalizedRoles;
	}

	public List<CopyDependency> getCopyDependencies() {
		return copyDependencies;
	}

	public void setCopyDependencies(List<CopyDependency> copyDependencies) {
		this.copyDependencies = copyDependencies;
	}

	public List<DeleteDependency> getDeleteDependencies() {
		return deleteDependencies;
	}

	public void setDeleteDependencies(List<DeleteDependency> deleteDependencies) {
		this.deleteDependencies = deleteDependencies;
	}

	public String getId() {
		return id;
	}

	public void setId(String id) {
		this.id = id;
	}

	public String getImageThumbnail() {
		return imageThumbnail;
	}

	public void setImageThumbnail(String imageThumbnail) {
		this.imageThumbnail = imageThumbnail;
	}

	public String getLabel() {
		return label;
	}

	public void setLabel(String label) {
		this.label = label;
	}

	public Collection<String> getPathIncludes() {
		if (pathIncludeExcludes == null) {
			return emptyList();
		}
		return emptyIfNull(pathIncludeExcludes.includes()).stream()
				.map(PathPattern::getPattern)
				.toList();
	}

	public Collection<String> getPathExcludes() {
		if (pathIncludeExcludes == null) {
			return emptyList();
		}
		return emptyIfNull(pathIncludeExcludes.excludes()).stream()
				.map(PathPattern::getPattern)
				.toList();
	}

	public void setPathIncludeExcludes(PathIncludeExcludes pathIncludeExcludes) {
		this.pathIncludeExcludes = pathIncludeExcludes;
	}

	public boolean isPreviewable() {
		return previewable;
	}

	public void setPreviewable(boolean previewable) {
		this.previewable = previewable;
	}

	public boolean isQuickCreate() {
		return quickCreate;
	}

	public void setQuickCreate(boolean quickCreate) {
		this.quickCreate = quickCreate;
	}

	public String getQuickCreatePath() {
		return quickCreatePath;
	}

	public void setQuickCreatePath(String quickCreatePath) {
		this.quickCreatePath = quickCreatePath;
	}

	public Type getType() {
		return StudioUtils.getContentTypeTypeById(id);
	}

	public enum Type {
		page, component, unknown
	}
}
