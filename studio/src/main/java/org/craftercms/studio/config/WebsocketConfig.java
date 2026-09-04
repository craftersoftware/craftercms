/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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

import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.converter.DefaultContentTypeResolver;
import org.springframework.messaging.converter.JacksonJsonMessageConverter;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.converter.MessageConverter;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.security.messaging.web.csrf.CsrfChannelInterceptor;
import org.springframework.util.MimeTypeUtils;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import static org.craftercms.commons.spring.cors.FixedCorsConfigurationSource.getOrigins;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_CORS_ALLOWED_ORIGINS;

import java.util.List;

/**
 * Spring Websocket Configuration
 *
 * <p><b>Note:</b> This configuration class is required because the XML namespace doesn't allow customizations</p>
 *
 * @author joseross
 * @since 4.0.0
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebsocketConfig implements WebSocketMessageBrokerConfigurer {

    protected StudioConfiguration studioConfiguration;

    @Autowired
    public WebsocketConfig(StudioConfiguration studioConfiguration) {
        this.studioConfiguration = studioConfiguration;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String allowedOrigins = studioConfiguration.getProperty(CONFIGURATION_CORS_ALLOWED_ORIGINS);
        registry
            // The STOMP controller URL
            .addEndpoint("/events")
            // Use the same allowed origins from the configuration to match the HTTP filter
            .setAllowedOriginPatterns(getOrigins(allowedOrigins).toArray(String[]::new));
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry
            // The accepted prefixes for sending messages to the app (not used for now)
            .setApplicationDestinationPrefixes("/app")
            // The accepted prefixes for sending messages to the clients
            .enableSimpleBroker("/topic");
    }
	
	/**
	 * CSRF interceptor for WebSocket messages
	 * This needs to be declared so the {@link org.springframework.security.config.websocket.WebSocketMessageBrokerSecurityBeanDefinitionParser} picks it up
	 *
	 * @see <a href="https://github.com/spring-projects/spring-security/issues/17260"><websocket-message-broker> should use XorCsrfChannelInterceptor by default</a>
	 */
	@Bean
	public CsrfChannelInterceptor csrfChannelInterceptor() {
		return new CsrfChannelInterceptor();
	}
	
	@Override
	public boolean configureMessageConverters(List<MessageConverter> messageConverters) {
		// Configure Jackson converter with Java Time module support
		// so that Java 8 date/time types are properly serialized/deserialized
		DefaultContentTypeResolver resolver = new DefaultContentTypeResolver();
		resolver.setDefaultMimeType(MimeTypeUtils.APPLICATION_JSON);
		MappingJackson2MessageConverter converter = new MappingJackson2MessageConverter();
		ObjectMapper objectMapper=  com.fasterxml.jackson.databind.json.JsonMapper.builder()
				.addModule(new JavaTimeModule())
				.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS) // Serialize dates as formatted strings
				.build();
		converter.setObjectMapper(objectMapper);
		converter.setContentTypeResolver(resolver);
		messageConverters.add(converter);
		return false;
	}
}
