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

package org.craftercms.engine.service.context;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.beans.ConstructorProperties;
import java.util.Collection;
import java.util.List;

/**
 * Tries site list resolvers in order and returns the first list. A {@code null} result means that resolver is not
 * configured, so the next one is tried. An empty list is a valid result. A thrown exception is an error and is kept as a
 * suppressed exception while the chain continues. If every resolver fails, the collected exception is thrown. If
 * every resolver is not configured, this resolver returns {@code null}.
 */
public class FallbackSiteListResolver implements SiteListResolver {

	private static final Logger logger = LoggerFactory.getLogger(FallbackSiteListResolver.class);

	private final List<SiteListResolver> resolvers;

	@ConstructorProperties({"resolvers"})
	public FallbackSiteListResolver(List<SiteListResolver> resolvers) {
		if (resolvers == null || resolvers.isEmpty()) {
			throw new IllegalArgumentException("At least one site list resolver is required");
		}
		this.resolvers = List.copyOf(resolvers);
	}

	@Override
	public Collection<String> getSiteList() {
		RuntimeException failure = null;
		for (SiteListResolver resolver : resolvers) {
			try {
				Collection<String> siteNames = resolver.getSiteList();
				if (siteNames != null) {
					return siteNames;
				}
				logger.debug("{} is not configured", resolver.getClass().getSimpleName());
			} catch (RuntimeException e) {
				logger.warn("Unable to list sites using {} ({})", resolver.getClass().getSimpleName(), e.getMessage());
				logger.debug("Site list resolver failed", e);
				if (failure == null) {
					failure = new IllegalStateException("Unable to list sites");
				}
				failure.addSuppressed(e);
			}
		}
		if (failure != null) {
			throw failure;
		}
		return null;
	}

}
