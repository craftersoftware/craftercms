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

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import org.craftercms.commons.validation.annotations.param.ValidSiteId;

import jakarta.validation.constraints.NotEmpty;

/**
 * Holds the parameters to duplicate a Target
 */
public class DuplicateTargetRequest {
    @NotEmpty
    @ValidSiteId
    private String siteName;

    public String getSiteName() {
        return siteName;
    }

    public void setSiteName(String siteName) {
        this.siteName = siteName;
    }

    @JsonUnwrapped
    private TargetTemplateParams targetTemplateParams;

    public TargetTemplateParams getTargetTemplateParams() {
        return targetTemplateParams;
    }

    public void setTargetTemplateParams(TargetTemplateParams targetTemplateParams) {
        this.targetTemplateParams = targetTemplateParams;
    }
}
