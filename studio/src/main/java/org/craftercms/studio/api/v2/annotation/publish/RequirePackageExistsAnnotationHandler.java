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

package org.craftercms.studio.api.v2.annotation.publish;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.craftercms.commons.aop.AopUtils;
import org.craftercms.studio.api.v2.annotation.StudioAnnotationUtils;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.dal.publish.PublishDAO;
import org.craftercms.studio.api.v2.exception.publish.PublishPackageNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;

import java.beans.ConstructorProperties;
import java.lang.reflect.Method;

/**
 * Handles the {@link RequirePackageExists} annotation.
 * Checks if the publish package exists in a site.
 */
@Aspect
@Order(10)
public class RequirePackageExistsAnnotationHandler {
	private static final Logger logger = LoggerFactory.getLogger(RequirePackageExistsAnnotationHandler.class);

	private final PublishDAO publishDao;

	@ConstructorProperties({"publishDao"})
	public RequirePackageExistsAnnotationHandler(final PublishDAO publishDao) {
		this.publishDao = publishDao;
	}

	// This method matches:
	// - methods declared on classes annotated with RequirePackageExists
	// - methods declared on classes meta-annotated with RequirePackageExists (only one level deep). e.g.: @RequirePackageExists, which is annotated with @RequirePackageExists
	// - methods annotated with RequirePackageExists
	// - methods meta-annotated with RequirePackageExists (only one level deep)
	@Around("@within(RequirePackageExists) || " +
		"within(@RequirePackageExists *) || " +
		"within(@(@RequirePackageExists *) *) || " +
		"@annotation(RequirePackageExists) || " +
		"execution(@(@RequirePackageExists *) * *(..))")
	public Object requirePackageExists(ProceedingJoinPoint pjp) throws Throwable {
		Method method = AopUtils.getActualMethod(pjp);
		String siteId = StudioAnnotationUtils.getAnnotationValue(pjp, method, SiteId.class, String.class);
		Long packageId = StudioAnnotationUtils.getAnnotationValue(pjp, method, PackageId.class, Long.class);

		if (packageId == null) {
			logger.debug("Method '{}.{}' is annotated with @RequirePackageExists but does not have a @PackageId parameter. " +
				"This annotation will be ignored.", method.getDeclaringClass().getName(), method.getName());
		} else if (!publishDao.packageExists(siteId, packageId)) {
			throw new PublishPackageNotFoundException(siteId, packageId);
		}
		return pjp.proceed();
	}

}
