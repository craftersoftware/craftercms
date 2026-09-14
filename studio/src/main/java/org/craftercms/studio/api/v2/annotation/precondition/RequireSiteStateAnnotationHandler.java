/*
 * Copyright (C) 2007-2023 Crafter Software Corporation. All Rights Reserved.
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
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.core.annotation.Order;

import java.lang.reflect.Method;

/**
 * Handles the {@link RequireSiteState} annotation.
 * Checks if the site state is supported for the requested operation before executing the annotated method.
 */
@Aspect
@Order(10)
public class RequireSiteStateAnnotationHandler {

	private static final Logger logger = LoggerFactory.getLogger(RequireSiteStateAnnotationHandler.class);

	private final SitesService sitesService;

	public RequireSiteStateAnnotationHandler(final SitesService sitesService) {
		this.sitesService = sitesService;
	}

	// This method matches:
	// - methods declared on classes annotated with RequireSiteState
	// - methods declared on classes meta-annotated with RequireSiteState (only one level deep). e.g.: @RequireSiteReady, which is annotated with @RequireSiteState
	// - methods annotated with RequireSiteState
	// - methods meta-annotated with RequireSiteState (only one level deep)
	@Around("@within(RequireSiteState) || " +
		"within(@RequireSiteState *) || " +
		"within(@(@RequireSiteState *) *) || " +
		"@annotation(RequireSiteState) || " +
		"execution(@(@RequireSiteState *) * *(..))")
	public Object checkSiteState(ProceedingJoinPoint pjp) throws Throwable {
		Method method = AopUtils.getActualMethod(pjp);
		String siteId = StudioAnnotationUtils.getAnnotationValue(pjp, method, SiteId.class, String.class);

		if (StringUtils.isNotEmpty(siteId)) {
			RequireSiteState annotation = AnnotationUtils.findAnnotation(method, RequireSiteState.class);
			if (annotation == null) {
				annotation = AnnotationUtils.findAnnotation(method.getDeclaringClass(), RequireSiteState.class);
			}
			if (annotation != null) {
				String requiredState = annotation.value();
				sitesService.checkSiteState(siteId, requiredState);
			} else {
				logger.debug("Unable to find RequireSiteState annotation on method '{}.{}'. ", method.getDeclaringClass().getName(), method.getName());
			}
		} else {
			logger.debug("Method '{}.{}' is annotated with @RequireSiteReady but does not have a @SiteId parameter. " +
				"This annotation will be ignored.", method.getDeclaringClass().getName(), method.getName());
		}
		return pjp.proceed();
	}

}
