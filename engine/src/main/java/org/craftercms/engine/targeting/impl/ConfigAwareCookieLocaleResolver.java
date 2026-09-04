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
package org.craftercms.engine.targeting.impl;

import java.util.Locale;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.apache.commons.configuration2.Configuration;
import org.apache.commons.lang3.LocaleUtils;
import org.craftercms.engine.service.context.SiteContext;
import org.craftercms.engine.util.ConfigUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.i18n.SimpleLocaleContext;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.i18n.CookieLocaleResolver;

/**
 * {@link CookieLocaleResolver} wrapper that uses the default locale specified
 * in the site configuration if
 * the user has not current locale associated.
 *
 * @author avasquez
 */
public class ConfigAwareCookieLocaleResolver implements LocaleResolver {
	protected static final Logger logger = LoggerFactory.getLogger(ConfigAwareCookieLocaleResolver.class);

	public static final String DEFAULT_LOCALE_CONFIG_KEY = "defaultLocale";

	private final String cookieName;

	public ConfigAwareCookieLocaleResolver(final String cookieName) {
		this.cookieName = cookieName;
	}

	@Override
	public Locale resolveLocale(final HttpServletRequest request) {
		// Return the request attribute if already resolved
		Locale locale = (Locale) request.getAttribute(CookieLocaleResolver.LOCALE_REQUEST_ATTRIBUTE_NAME);
		if (locale != null) {
			return locale;
		}
		CookieLocaleResolver delegate = new CookieLocaleResolver(getCookieName());
		delegate.setDefaultLocaleFunction(r -> getDefaultLocaleFromConfig());

		return delegate.resolveLocale(request);
	}

	public void setLocale(HttpServletRequest request, HttpServletResponse response,
			Locale locale) {
		new CookieLocaleResolver(getCookieName())
				.setLocaleContext(request, response, (locale != null ? new SimpleLocaleContext(locale) : null));
	}

	public String getCookieName() {
		SiteContext siteContext = SiteContext.getCurrent();
		if (siteContext != null) {
			return String.format("%s-%s", cookieName, siteContext.getSiteName());
		}
		return cookieName;
	}

	protected Locale getDefaultLocaleFromConfig() {
		Configuration config = ConfigUtils.getCurrentConfig();
		if (config == null) {
			return null;
		}
		Locale defaultLocale = LocaleUtils.toLocale(config.getString(DEFAULT_LOCALE_CONFIG_KEY));
		if (defaultLocale != null && !LocaleUtils.isAvailableLocale(defaultLocale)) {
			if (logger.isDebugEnabled()) {
				logger.debug("{} is not one of the available locales", defaultLocale);
			}

			return null;
		}

		return defaultLocale;
	}
}
