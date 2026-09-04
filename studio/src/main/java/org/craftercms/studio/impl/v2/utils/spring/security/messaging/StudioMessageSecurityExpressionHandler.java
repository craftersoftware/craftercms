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
package org.craftercms.studio.impl.v2.utils.spring.security.messaging;

import java.util.function.Supplier;

import org.craftercms.studio.api.v2.service.security.SecurityService;
import org.springframework.expression.BeanResolver;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.messaging.Message;
import org.springframework.security.access.expression.SecurityExpressionOperations;
import org.springframework.security.core.Authentication;
import org.springframework.security.messaging.access.expression.DefaultMessageSecurityExpressionHandler;
import org.springframework.security.messaging.access.expression.MessageSecurityExpressionRoot;

/**
 * Extension of {@link DefaultMessageSecurityExpressionHandler} that allows to integrate Studio security expressions
 *
 * @see  StudioMessageSecurityExpressionRoot
 *
 * @author joseross
 * @since 4.0.0
 */
public class StudioMessageSecurityExpressionHandler<T> extends DefaultMessageSecurityExpressionHandler<T> {

    protected final SecurityService securityService;

    public StudioMessageSecurityExpressionHandler(SecurityService securityService) {
        this.securityService = securityService;
    }

    @Override
    protected SecurityExpressionOperations createSecurityExpressionRoot(Authentication authentication,
                                                                        Message<T> invocation) {
		StudioMessageSecurityExpressionRoot<T> root = createSecurityExpressionRoot(() -> authentication, invocation);
        root.setPermissionEvaluator(getPermissionEvaluator());
		root.setAuthorizationManagerFactory(getAuthorizationManagerFactory());
        return root;
    }

	@Override
	public EvaluationContext createEvaluationContext(Supplier<? extends Authentication> authentication, Message<T> invocation) {
		MessageSecurityExpressionRoot<T> root = createSecurityExpressionRoot(authentication, invocation);
		StandardEvaluationContext ctx = new StandardEvaluationContext(root);
		BeanResolver beanResolver = getBeanResolver();
		if (beanResolver != null) {
			// https://github.com/spring-projects/spring-framework/issues/35371
			ctx.setBeanResolver(beanResolver);
		}
		return ctx;
	}

	private StudioMessageSecurityExpressionRoot<T> createSecurityExpressionRoot(Supplier<? extends Authentication> authentication, Message<T> invocation) {
		StudioMessageSecurityExpressionRoot<T> root = new StudioMessageSecurityExpressionRoot<T>(authentication, invocation, securityService);
		root.setAuthorizationManagerFactory(getAuthorizationManagerFactory());
		root.setPermissionEvaluator(getPermissionEvaluator());
		return root;
	}

}
