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
package org.craftercms.studio.config;

import java.util.function.Supplier;

import org.apache.commons.collections.MapUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.Expression;
import org.springframework.messaging.Message;
import org.springframework.security.access.expression.ExpressionUtils;
import org.springframework.security.access.expression.SecurityExpressionHandler;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.authorization.AuthorizationResult;
import org.springframework.security.authorization.ExpressionAuthorizationDecision;
import org.springframework.security.config.annotation.web.socket.EnableWebSocketSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.messaging.access.intercept.MessageAuthorizationContext;
import org.springframework.security.messaging.access.intercept.MessageMatcherDelegatingAuthorizationManager;

/**
 * Spring Security Websocket Configuration
 *
 * <p><b>Note:</b> This configuration class is required because the XML namespace doesn't allow customizations</p>
 *
 * @author joseross
 * @since 4.0.0
 */
@Configuration
@EnableWebSocketSecurity
public class WebsocketSecurityConfig {

    protected SecurityExpressionHandler<Message<?>> expressionHandler;

	@Autowired
	public WebsocketSecurityConfig(SecurityExpressionHandler<Message<?>> expressionHandler) {
		this.expressionHandler = expressionHandler;
	}
	@Bean
	AuthorizationManager<Message<?>> authorizationManager(MessageMatcherDelegatingAuthorizationManager.Builder messages) {
		return messages
				// Require authentication for CONNECT messages
				.nullDestMatcher().authenticated()
				// Allow users to subscribe to global topic if they are authenticated
				.simpSubscribeDestMatchers("/topic/studio").authenticated()
				// Only allow users to subscribe if they are site members
				.simpSubscribeDestMatchers("/topic/studio/{siteId}").access(new MessageExpressionAuthorizationManager("isSiteMember(#siteId)"))				// Reject any other incoming message from users
				.anyMessage().denyAll()
				.build();
	}

	private AuthorizationManager<MessageAuthorizationContext<?>> getAuthorizationManager(String expressionString) {
		return new MessageExpressionAuthorizationManager(expressionString);
	}

	private class MessageExpressionAuthorizationManager implements AuthorizationManager<MessageAuthorizationContext<?>> {

		private final Expression expression;

		public MessageExpressionAuthorizationManager(final String expressionString) {
			this.expression = expressionHandler.getExpressionParser().parseExpression(expressionString);
		}

		@Override
		public AuthorizationResult authorize(Supplier<? extends Authentication> authentication, MessageAuthorizationContext<?> context) {
			EvaluationContext ctx = expressionHandler.createEvaluationContext(authentication, context.getMessage());
			if (MapUtils.isNotEmpty(context.getVariables())) {
				context.getVariables().forEach(ctx::setVariable);
			}
			boolean granted = ExpressionUtils.evaluateAsBoolean(this.expression, ctx);
			return new ExpressionAuthorizationDecision(granted, this.expression);
		}

    }

}
