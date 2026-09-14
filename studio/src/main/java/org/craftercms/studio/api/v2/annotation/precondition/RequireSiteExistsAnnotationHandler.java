/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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

package org.craftercms.studio.api.v2.annotation.precondition;

import java.beans.ConstructorProperties;
import java.lang.reflect.Method;

import org.apache.commons.lang3.StringUtils;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.craftercms.commons.aop.AopUtils;
import org.craftercms.studio.api.v2.annotation.StudioAnnotationUtils;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import static org.springframework.core.Ordered.HIGHEST_PRECEDENCE;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.core.annotation.Order;

/**
 * Handles the {@link RequireSiteExists} annotation.
 * Checks if the site exists.
 */
@Aspect
@Order(HIGHEST_PRECEDENCE)
public class RequireSiteExistsAnnotationHandler {

	private static final Logger logger = LoggerFactory.getLogger(RequireSiteExistsAnnotationHandler.class);

	private final SitesService sitesService;

	@ConstructorProperties({"sitesService"})
	RequireSiteExistsAnnotationHandler(final SitesService sitesService) {
		this.sitesService = sitesService;
	}

	// This method matches:
	// - methods declared on classes annotated with RequireSiteExists
	// - methods declared on classes meta-annotated with RequireSiteExists (only one level deep). e.g.: @RequireSiteExists, which is annotated with @RequireSiteExists
	// - methods annotated with RequireSiteExists
	// - methods meta-annotated with RequireSiteExists (only one level deep)
	@Around("@within(RequireSiteExists) || " +
		"within(@RequireSiteExists *) || " +
		"within(@(@RequireSiteExists *) *) || " +
		"@annotation(RequireSiteExists) || " +
		"execution(@(@RequireSiteExists *) * *(..))")
	public Object requireSiteExists(ProceedingJoinPoint pjp) throws Throwable {
		Method method = AopUtils.getActualMethod(pjp);
		String siteId = StudioAnnotationUtils.getAnnotationValue(pjp, method, SiteId.class, String.class);

		if (StringUtils.isNotEmpty(siteId)) {
			RequireSiteExists annotation = AnnotationUtils.findAnnotation(method, RequireSiteExists.class);
			if (annotation == null) {
				annotation = AnnotationUtils.findAnnotation(method.getDeclaringClass(), RequireSiteExists.class);
			}
			if (annotation != null) {
				sitesService.checkSiteExists(siteId);
			} else {
				logger.debug("Unable to find RequireSiteExists annotation on method '{}.{}'. ", method.getDeclaringClass().getName(), method.getName());
			}
		} else {
			logger.debug("Method '{}.{}' is annotated with @RequireSiteExists but does not have a @SiteId parameter. " +
				"This annotation will be ignored.", method.getDeclaringClass().getName(), method.getName());
		}
		return pjp.proceed();
	}

}
