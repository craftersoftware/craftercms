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
package org.craftercms.studio.impl.v2.service.policy;

import org.craftercms.studio.api.v1.exception.ContentNotFoundException;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteReady;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.exception.configuration.ConfigurationException;
import org.craftercms.studio.api.v2.service.policy.PolicyService;
import org.craftercms.studio.model.policy.Action;
import org.craftercms.studio.model.policy.ValidationResult;

import java.beans.ConstructorProperties;
import java.io.IOException;
import java.util.List;

/**
 * Default implementation of {@link PolicyService}
 *
 * @author joseross
 * @since 4.0.0
 */
public class PolicyServiceImpl implements PolicyService {

	protected PolicyService policyServiceInternal;

	@ConstructorProperties({"policyServiceInternal"})
	public PolicyServiceImpl(PolicyService policyServiceInternal) {
		this.policyServiceInternal = policyServiceInternal;
	}

	@Override
	@RequireSiteReady
	public List<ValidationResult> validate(@SiteId String siteId, List<Action> actions)
		throws ConfigurationException, IOException, ContentNotFoundException {
		return policyServiceInternal.validate(siteId, actions);
	}

}
