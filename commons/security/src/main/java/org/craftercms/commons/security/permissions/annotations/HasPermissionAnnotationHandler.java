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
package org.craftercms.commons.security.permissions.annotations;

import org.apache.commons.lang3.StringUtils;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.craftercms.commons.aop.AopUtils;
import org.craftercms.commons.http.RequestContext;
import org.craftercms.commons.i10n.I10nLogger;
import org.craftercms.commons.rest.ManagementTokenResolver;
import org.craftercms.commons.security.exception.ActionDeniedException;
import org.craftercms.commons.security.permissions.PermissionEvaluator;
import org.springframework.core.annotation.Order;

import java.beans.ConstructorProperties;
import java.lang.reflect.Method;
import java.util.Map;

/**
 * Aspect that handles {@link org.craftercms.commons.security.permissions.annotations.HasPermission} annotations,
 * by doing appropriate permission checking.
 *
 * @author avasquez
 */
@Aspect
@Order(-1)
public class HasPermissionAnnotationHandler extends AbstractPermissionAnnotationHandler {

	private static final I10nLogger logger = new I10nLogger(HasPermissionAnnotationHandler.class,
		"crafter.security.messages.logging");

	private static final String LOG_KEY_METHOD_INT = "security.permission.methodIntercepted";
	private static final String LOG_KEY_METHOD_INT_NO_SEC_OBJ = "security.permission.methodInterceptedNoSecObject";

	/**
	 * Management token to be validated in case a {@link HasPermission} annotation
	 * has been configured to accept a management token.
	 */
	protected final String managementToken;

	@ConstructorProperties({"permissionEvaluators", "managementToken"})
	public HasPermissionAnnotationHandler(Map<Class<?>, PermissionEvaluator<?, ?>> permissionEvaluators, String managementToken) {
		super(permissionEvaluators);
		this.managementToken = managementToken;
	}

	@SuppressWarnings("unchecked") //cortiz, OK permissionEvaluator.isAllowed
	@Around("@within(org.craftercms.commons.security.permissions.annotations.HasPermission) || " +
		"@annotation(org.craftercms.commons.security.permissions.annotations.HasPermission)")
	public Object checkPermissions(ProceedingJoinPoint pjp) throws Throwable {
		Method method = AopUtils.getActualMethod(pjp);
		HasPermission hasPermission = getHasPermissionAnnotation(method, pjp, HasPermission.class);
		Object securedResource = getAnnotatedProtectedResource(method, pjp.getArgs());
		if (securedResource == null) {
			securedResource = getAnnotatedProtectedResourceIds(method, pjp.getArgs());
		}

		if (securedResource != null) {
			logger.debug(LOG_KEY_METHOD_INT, method, hasPermission, securedResource);
		} else {
			logger.debug(LOG_KEY_METHOD_INT_NO_SEC_OBJ, method, hasPermission);
		}

		if (checkManagementToken(hasPermission)) {
			return pjp.proceed();
		}
		if (checkPermissions(method, hasPermission, securedResource)) {
			return pjp.proceed();
		} else if (securedResource != null) {
			throw new ActionDeniedException(hasPermission.action(), securedResource);
		} else {
			throw new ActionDeniedException(hasPermission.action());
		}
	}

	/**
	 * Checks if there is a valid management token in the request.
	 * The header is used when present; the query parameter is used only when the header is absent.
	 * This token must match the configured management token for this handler.
	 *
	 * @param hasPermission the {@link HasPermission} annotation
	 * @return true if and only if a valid management token is present in the request AND the {@link HasPermission}
	 * annotation has been configured to accept the token
	 */
	protected boolean checkManagementToken(final HasPermission hasPermission) {
		if (!hasPermission.acceptManagementToken() || StringUtils.isEmpty(managementToken)) {
			return false;
		}
		RequestContext requestContext = RequestContext.getCurrent();
		if (requestContext == null || requestContext.getRequest() == null) {
			return false;
		}
		String token = ManagementTokenResolver.resolve(requestContext.getRequest());

		return StringUtils.equals(token, managementToken);
	}

}
