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

import org.apache.commons.lang3.StringUtils;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.craftercms.commons.aop.AopUtils;
import org.craftercms.studio.api.v2.annotation.StudioAnnotationUtils;
import org.craftercms.studio.api.v2.annotation.resourceids.ContentPath;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.repository.ContentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.core.annotation.Order;

import java.beans.ConstructorProperties;
import java.lang.reflect.Method;

/**
 * Handles the {@link RequireContentExists} annotation.
 * Checks if the content of a site exists.
 */
@Aspect
@Order(10)
public class RequireContentExistsAnnotationHandler {

	private static final Logger logger = LoggerFactory.getLogger(RequireContentExistsAnnotationHandler.class);

	private final ContentRepository contentRepository;

	@ConstructorProperties({"contentRepository"})
	public RequireContentExistsAnnotationHandler(ContentRepository contentRepository) {
		this.contentRepository = contentRepository;
	}

	// This method matches:
	// - methods declared on classes annotated with RequireContentExists
	// - methods declared on classes meta-annotated with RequireContentExists (only one level deep). e.g.: @RequireContentExists, which is annotated with @RequireContentExists
	// - methods annotated with RequireContentExists
	// - methods meta-annotated with RequireContentExists (only one level deep)
	@Around("@within(RequireContentExists) || " +
		"within(@RequireContentExists *) || " +
		"within(@(@RequireContentExists *) *) || " +
		"@annotation(RequireContentExists) || " +
		"execution(@(@RequireContentExists *) * *(..))")
	public Object requireContentExists(ProceedingJoinPoint pjp) throws Throwable {
		Method method = AopUtils.getActualMethod(pjp);
		String siteId = StudioAnnotationUtils.getAnnotationValue(pjp, method, SiteId.class, String.class);
		String path = StudioAnnotationUtils.getAnnotationValue(pjp, method, ContentPath.class, String.class);

		if (StringUtils.isNotEmpty(path)) {
			RequireContentExists annotation = AnnotationUtils.findAnnotation(method, RequireContentExists.class);
			if (annotation == null) {
				annotation = AnnotationUtils.findAnnotation(method.getDeclaringClass(), RequireContentExists.class);
			}
			if (annotation != null) {
				contentRepository.checkContentExists(siteId, path);
			} else {
				logger.debug("Unable to find RequireContentExists annotation on method '{}.{}'. ", method.getDeclaringClass().getName(), method.getName());
			}
		} else {
			logger.debug("Method '{}.{}' is annotated with @RequireContentExists but does not have a @ContentPath parameter. " +
				"This annotation will be ignored.", method.getDeclaringClass().getName(), method.getName());
		}
		return pjp.proceed();
	}
}
