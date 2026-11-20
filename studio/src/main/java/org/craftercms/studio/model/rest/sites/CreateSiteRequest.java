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

package org.craftercms.studio.model.rest.sites;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.craftercms.commons.git.utils.AuthenticationType;
import org.craftercms.commons.jackson.CaseInsensitiveEnumDeserializer;
import org.craftercms.commons.validation.annotations.param.ValidSiteId;
import org.craftercms.commons.validation.annotations.param.ValidateNoTagsParam;

import java.util.Map;

/**
 * Holds the information needed to create a site
 */
@JsonTypeInfo(
		use = JsonTypeInfo.Id.NAME,
		property = "sourceType"
)
@JsonSubTypes({
		@JsonSubTypes.Type(value = CreateSiteRequest.RemoteSource.class, name = "remote"),
		@JsonSubTypes.Type(value = CreateSiteRequest.BlueprintSource.class, name = "blueprint")
})
@JsonIgnoreProperties(ignoreUnknown = true)
public sealed abstract class CreateSiteRequest permits CreateSiteRequest.RemoteSource, CreateSiteRequest.BlueprintSource {
	@NotEmpty
	@ValidSiteId
	protected String siteId;
	@NotEmpty
	@Size(max = 255)
	protected String name;
	@Size(max = 4000)
	protected String description;
	@Size(max = 255)
	protected String sandboxBranch;
	protected Map<String, String> siteParams;
	/**
	 * When true, staging is enabled for the new site. Staging cannot be disabled afterwards.
	 */
	protected boolean enableStaging;

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getSandboxBranch() {
		return sandboxBranch;
	}

	public void setSandboxBranch(String sandboxBranch) {
		this.sandboxBranch = sandboxBranch;
	}

	public boolean isEnableStaging() {
		return enableStaging;
	}

	public void setEnableStaging(boolean enableStaging) {
		this.enableStaging = enableStaging;
	}

	public String getSiteId() {
		return siteId;
	}

	public void setSiteId(String siteId) {
		this.siteId = siteId;
	}

	public Map<String, String> getSiteParams() {
		return siteParams;
	}

	public void setSiteParams(Map<String, String> siteParams) {
		this.siteParams = siteParams;
	}

	/**
	 * CreateSiteRequest with a remote repository as source
	 */
	public static final class RemoteSource extends CreateSiteRequest {
		@NotEmpty
		@Size(max = 2000)
		@ValidateNoTagsParam
		private String remoteUrl;
		@Size(max = 50)
		private String remoteName;
		@Size(max = 255)
		private String remoteBranch;
		private boolean createAsOrphan;
		private boolean singleBranch = true;
		@NotNull
		private RemoteAuthentication authentication;

		public String getRemoteUrl() {
			return remoteUrl;
		}

		public void setRemoteUrl(String remoteUrl) {
			this.remoteUrl = remoteUrl;
		}

		public String getRemoteBranch() {
			return remoteBranch;
		}

		public void setRemoteBranch(String remoteBranch) {
			this.remoteBranch = remoteBranch;
		}

		public String getRemoteName() {
			return remoteName;
		}

		public void setRemoteName(String remoteName) {
			this.remoteName = remoteName;
		}

		public boolean isCreateAsOrphan() {
			return createAsOrphan;
		}

		public void setCreateAsOrphan(boolean createAsOrphan) {
			this.createAsOrphan = createAsOrphan;
		}

		public boolean isSingleBranch() {
			return singleBranch;
		}

		public void setSingleBranch(boolean singleBranch) {
			this.singleBranch = singleBranch;
		}

		public RemoteAuthentication getAuthentication() {
			return authentication;
		}

		public void setAuthentication(RemoteAuthentication authentication) {
			this.authentication = authentication;
		}

		@Override
		public String toString() {
			return "RemoteSource{" +
					"siteId='" + getSiteId() + '\'' +
					", name='" + getName() + '\'' +
					", description='" + getDescription() + '\'' +
					", sandboxBranch='" + getSandboxBranch() + '\'' +
					", remoteUrl='" + remoteUrl + '\'' +
					'}';
		}
	}

	/**
	 * CreateSiteRequest with a blueprint as source
	 */
	public static final class BlueprintSource extends CreateSiteRequest {
		@NotEmpty
		private String blueprintId;

		public String getBlueprintId() {
			return blueprintId;
		}

		public void setBlueprintId(String blueprintId) {
			this.blueprintId = blueprintId;
		}

		@Override
		public String toString() {
			return "BlueprintSource{" +
					"siteId='" + getSiteId() + '\'' +
					", name='" + getName() + '\'' +
					", description='" + getDescription() + '\'' +
					", sandboxBranch='" + getSandboxBranch() + '\'' +
					", blueprint='" + blueprintId + '\'' +
					", siteParams=" + siteParams +
					'}';
		}
	}

	public static class RemoteAuthentication {

		public static final RemoteAuthentication NONE = new RemoteAuthentication(AuthenticationType.none);

		@JsonDeserialize(using = CaseInsensitiveEnumDeserializer.class)
		private AuthenticationType type;
		@Size(max = 255)
		@ValidateNoTagsParam
		private String username;
		@Size(max = 255)
		private String password;
		@Size(max = 255)
		private String token;
		private String privateKey;

		public RemoteAuthentication() {
		}

		private RemoteAuthentication(AuthenticationType type) {
			this.type = type;
		}

		public AuthenticationType getType() {
			return type;
		}

		public void setType(AuthenticationType type) {
			this.type = type;
		}

		public String getPassword() {
			return password;
		}

		public void setPassword(String password) {
			this.password = password;
		}

		public String getPrivateKey() {
			return privateKey;
		}

		public void setPrivateKey(String privateKey) {
			this.privateKey = privateKey;
		}

		public String getToken() {
			return token;
		}

		public void setToken(String token) {
			this.token = token;
		}

		public String getUsername() {
			return username;
		}

		public void setUsername(String username) {
			this.username = username;
		}
	}
}
