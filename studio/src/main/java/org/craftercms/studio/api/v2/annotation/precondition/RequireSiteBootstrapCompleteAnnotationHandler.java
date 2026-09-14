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

package org.craftercms.studio.api.v2.annotation.precondition;

import org.apache.commons.lang3.StringUtils;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.craftercms.commons.aop.AopUtils;
import org.craftercms.studio.api.v2.annotation.StudioAnnotationUtils;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.exception.SiteBootstrapNotCompleteException;
import org.craftercms.studio.api.v2.utils.spring.context.SiteBootstrapStateProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.core.annotation.Order;

import java.beans.ConstructorProperties;
import java.lang.reflect.Method;

/**
 * Handles the {@link RequireSiteBootstrapComplete} annotation.
 * Checks if the bootstrap process is completed before allowing the execution of the annotated method.
 */
@Aspect
@Order(10)
public class RequireSiteBootstrapCompleteAnnotationHandler {

	private static final Logger logger = LoggerFactory.getLogger(RequireSiteBootstrapCompleteAnnotationHandler.class);

	private final SiteBootstrapStateProvider siteBootstrapStateProvider;

	@ConstructorProperties({"siteBootstrapStateProvider"})
	public RequireSiteBootstrapCompleteAnnotationHandler(SiteBootstrapStateProvider siteBootstrapStateProvider) {
		this.siteBootstrapStateProvider = siteBootstrapStateProvider;
	}

	// This method matches:
	// - methods declared on classes annotated with RequireSiteBootstrapComplete
	// - methods declared on classes meta-annotated with RequireSiteBootstrapComplete (only one level deep). i.e.: annotated with an annotation that is in turn annotated with RequireSiteBootstrapComplete
	// - methods annotated with RequireSiteBootstrapComplete
	// - methods meta-annotated with RequireSiteBootstrapComplete (only one level deep)
	@Around("@within(RequireSiteBootstrapComplete) || " +
			"within(@RequireSiteBootstrapComplete *) || " +
			"within(@(@RequireSiteBootstrapComplete *) *) || " +
			"@annotation(RequireSiteBootstrapComplete) || " +
			"execution(@(@RequireSiteBootstrapComplete *) * *(..))")
	public Object requireSiteBootstrapComplete(ProceedingJoinPoint pjp) throws Throwable {
		Method method = AopUtils.getActualMethod(pjp);
		RequireSiteBootstrapComplete annotation = AnnotationUtils.findAnnotation(method, RequireSiteBootstrapComplete.class);
		if (annotation == null) {
			annotation = AnnotationUtils.findAnnotation(method.getDeclaringClass(), RequireSiteBootstrapComplete.class);
		}

		if (annotation == null) {
			logger.debug("Unable to find RequireSiteBootstrapComplete annotation on method '{}.{}'. ", method.getDeclaringClass().getName(), method.getName());
			return pjp.proceed();
		}

		String siteId = StudioAnnotationUtils.getAnnotationValue(pjp, method, SiteId.class, String.class);
		if (siteBootstrapStateProvider.isSiteReady(siteId)) {
			return pjp.proceed();
		}
		throw new SiteBootstrapNotCompleteException(siteId, "Site bootstrap process is not completed yet.");
	}
}
