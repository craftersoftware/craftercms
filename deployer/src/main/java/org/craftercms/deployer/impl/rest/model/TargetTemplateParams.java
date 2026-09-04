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
package org.craftercms.deployer.impl.rest.model;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonUnwrapped;
import org.craftercms.commons.validation.annotations.param.EsapiValidatedParam;
import org.craftercms.commons.validation.annotations.param.ValidUsername;
import org.craftercms.commons.validation.annotations.param.ValidateNoTagsParam;
import org.craftercms.commons.validation.annotations.param.ValidateSecurePathParam;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.craftercms.commons.validation.annotations.param.EsapiValidationType.EMAIL;

/**
 * Common parameters to be consumed by target templates
 */
public class TargetTemplateParams {

    @NotBlank
    @Size(max = 50)
    @ValidateNoTagsParam
    @ValidateSecurePathParam
    private String templateName = "remote";
    @ValidateNoTagsParam
    private String repoUrl;
    @ValidateNoTagsParam
    @ValidateSecurePathParam
    private String repoBranch;
    @ValidUsername
    private String repoUsername;
    @ValidateNoTagsParam
    @ValidateSecurePathParam
    private String sshPrivateKeyPath;
    @ValidateNoTagsParam
    private String engineUrl;
    private boolean replace;
    private List<@NotBlank @EsapiValidatedParam(type = EMAIL) String> notificationAddresses;
    @JsonUnwrapped
    private final Map<String, Object> extraParams;

    public TargetTemplateParams() {
        this.extraParams = new HashMap<>();
    }

    public String getTemplateName() {
        return templateName;
    }

    public void setTemplateName(String templateName) {
        this.templateName = templateName;
    }

    public String getRepoUrl() {
        return repoUrl;
    }

    public void setRepoUrl(String repoUrl) {
        this.repoUrl = repoUrl;
    }

    public String getRepoBranch() {
        return repoBranch;
    }

    public void setRepoBranch(String repoBranch) {
        this.repoBranch = repoBranch;
    }

    public String getRepoUsername() {
        return repoUsername;
    }

    public void setRepoUsername(String repoUsername) {
        this.repoUsername = repoUsername;
    }

    public String getSshPrivateKeyPath() {
        return sshPrivateKeyPath;
    }

    public void setSshPrivateKeyPath(String sshPrivateKeyPath) {
        this.sshPrivateKeyPath = sshPrivateKeyPath;
    }

    public String getEngineUrl() {
        return engineUrl;
    }

    public void setEngineUrl(String engineUrl) {
        this.engineUrl = engineUrl;
    }

    public List<String> getNotificationAddresses() {
        return notificationAddresses;
    }

    public void setNotificationAddresses(List<String> notificationAddresses) {
        this.notificationAddresses = notificationAddresses;
    }

    public boolean isReplace() {
        return replace;
    }

    public void setReplace(boolean replace) {
        this.replace = replace;
    }

    @JsonAnySetter
    public Map<String, Object> getExtraParams() {
        return extraParams;
    }

    @JsonAnySetter
    public void addExtraParam(String key, Object value) {
        this.extraParams.put(key, value);
    }
}
