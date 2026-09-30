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

package org.craftercms.studio.impl.v2.security.password;

import freemarker.template.Configuration;
import freemarker.template.Template;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.craftercms.studio.api.v2.dal.User;
import org.craftercms.studio.api.v2.service.security.UserService;
import org.craftercms.studio.api.v2.service.security.internal.UserServiceInternal;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;
import org.springframework.beans.factory.ObjectFactory;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.web.servlet.view.freemarker.FreeMarkerConfig;

import java.io.Writer;
import java.util.Map;
import java.util.Properties;

import static org.craftercms.studio.api.v2.utils.StudioConfiguration.AUTHORING_SERVER_URL;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.MAIL_FROM_DEFAULT;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.MAIL_SMTP_AUTH;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.SECURITY_FORGOT_PASSWORD_EMAIL_TEMPLATE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.SECURITY_FORGOT_PASSWORD_MESSAGE_SUBJECT;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.SECURITY_RESET_PASSWORD_SERVICE_URL;
import static org.junit.Assert.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@RunWith(MockitoJUnitRunner.class)
public class EmailForgotPasswordTaskFactoryTest {

	private static final String EMAIL_TEMPLATE = "/templates/system/email/forgotPassword.ftl";
	private static final String CONFIGURED_URL = "https://cms.example.com/studio";
	private static final String CONFIGURED_URL_WITH_TRAILING_SLASH = "https://cms.example.com/studio/";
	private static final String CONFIGURED_URL_WITH_WHITESPACE = "  https://cms.example.com/studio/  ";
	private static final String CONFIGURED_URL_WITH_MULTIPLE_SLASHES = "https://cms.example.com/studio///";
	private static final String ROOT_CONTEXT_URL = "https://cms.example.com";
	private static final String DEFAULT_AUTHORING_URL = "http://localhost:8080/studio";
	private static final String DEFAULT_AUTHORING_URL_WITH_TRAILING_SLASH = "http://localhost:8080/studio/";
	private static final String USERNAME = "testuser";
	private static final String USER_EMAIL = "testuser@example.com";
	private static final String TOKEN = "encrypted-token";
	private static final String SERVICE_URL = "login";
	private static final String AUTHORING_URL_MODEL_KEY = "authoringUrl";
	private static final String SERVICE_URL_MODEL_KEY = "serviceUrl";
	private static final String TOKEN_MODEL_KEY = "token";

	@Mock
	private UserService userService;
	@Mock
	private UserServiceInternal userServiceInternal;
	@Mock
	private StudioConfiguration studioConfiguration;
	@Mock
	private ObjectFactory<FreeMarkerConfig> freeMarkerConfigFactory;
	@Mock
	private FreeMarkerConfig freeMarkerConfig;
	@Mock
	private Configuration freemarkerConfiguration;
	@Mock
	private Template template;
	@Mock
	private JavaMailSender emailService;
	@Mock
	private JavaMailSender emailServiceNoAuth;

	@Before
	public void setUp() throws Exception {
		when(freeMarkerConfigFactory.getObject()).thenReturn(freeMarkerConfig);
		when(freeMarkerConfig.getConfiguration()).thenReturn(freemarkerConfiguration);
		when(studioConfiguration.getProperty(SECURITY_FORGOT_PASSWORD_EMAIL_TEMPLATE)).thenReturn(EMAIL_TEMPLATE);
		when(freemarkerConfiguration.getTemplate(anyString())).thenReturn(template);
	}

	@Test
	public void prepareTaskPutsConfiguredAuthoringUrlInTemplateModel() throws Exception {
		when(studioConfiguration.getProperty(AUTHORING_SERVER_URL)).thenReturn(CONFIGURED_URL);
		Map<String, Object> model = runForgotPasswordTaskAndCaptureModel();

		assertEquals(CONFIGURED_URL, model.get(AUTHORING_URL_MODEL_KEY));
		assertEquals(SERVICE_URL, model.get(SERVICE_URL_MODEL_KEY));
		assertEquals(TOKEN, model.get(TOKEN_MODEL_KEY));
		verify(emailServiceNoAuth).send(any(MimeMessage.class));
	}

	@Test
	public void trailingSlashIsStrippedFromAuthoringUrlInTemplateModel() throws Exception {
		when(studioConfiguration.getProperty(AUTHORING_SERVER_URL)).thenReturn(CONFIGURED_URL_WITH_TRAILING_SLASH);
		Map<String, Object> model = runForgotPasswordTaskAndCaptureModel();

		assertEquals(CONFIGURED_URL, model.get(AUTHORING_URL_MODEL_KEY));
	}

	@Test
	public void whitespaceAndTrailingSlashAreNormalizedInTemplateModel() throws Exception {
		when(studioConfiguration.getProperty(AUTHORING_SERVER_URL)).thenReturn(CONFIGURED_URL_WITH_WHITESPACE);
		Map<String, Object> model = runForgotPasswordTaskAndCaptureModel();

		assertEquals(CONFIGURED_URL, model.get(AUTHORING_URL_MODEL_KEY));
	}

	@Test
	public void multipleTrailingSlashesAreStrippedFromAuthoringUrl() throws Exception {
		when(studioConfiguration.getProperty(AUTHORING_SERVER_URL)).thenReturn(CONFIGURED_URL_WITH_MULTIPLE_SLASHES);
		Map<String, Object> model = runForgotPasswordTaskAndCaptureModel();

		assertEquals(CONFIGURED_URL, model.get(AUTHORING_URL_MODEL_KEY));
	}

	@Test
	public void rootContextAuthoringUrlIsSupported() throws Exception {
		when(studioConfiguration.getProperty(AUTHORING_SERVER_URL)).thenReturn(ROOT_CONTEXT_URL);
		Map<String, Object> model = runForgotPasswordTaskAndCaptureModel();

		assertEquals(ROOT_CONTEXT_URL, model.get(AUTHORING_URL_MODEL_KEY));
	}

	@Test
	public void defaultAuthoringUrlIsUsedInTemplateModel() throws Exception {
		when(studioConfiguration.getProperty(AUTHORING_SERVER_URL)).thenReturn(DEFAULT_AUTHORING_URL);
		Map<String, Object> model = runForgotPasswordTaskAndCaptureModel();

		assertEquals(DEFAULT_AUTHORING_URL, model.get(AUTHORING_URL_MODEL_KEY));
	}

	@Test
	public void defaultAuthoringUrlWithTrailingSlashIsNormalizedInTemplateModel() throws Exception {
		when(studioConfiguration.getProperty(AUTHORING_SERVER_URL)).thenReturn(DEFAULT_AUTHORING_URL_WITH_TRAILING_SLASH);
		Map<String, Object> model = runForgotPasswordTaskAndCaptureModel();

		assertEquals(DEFAULT_AUTHORING_URL, model.get(AUTHORING_URL_MODEL_KEY));
	}

	@Test
	public void blankAuthoringUrlFallsBackToDefaultInTemplateModel() throws Exception {
		when(studioConfiguration.getProperty(AUTHORING_SERVER_URL)).thenReturn("  ");
		Map<String, Object> model = runForgotPasswordTaskAndCaptureModel();

		assertEquals(DEFAULT_AUTHORING_URL, model.get(AUTHORING_URL_MODEL_KEY));
	}

	@Test
	public void nullAuthoringUrlFallsBackToDefaultInTemplateModel() throws Exception {
		when(studioConfiguration.getProperty(AUTHORING_SERVER_URL)).thenReturn(null);
		Map<String, Object> model = runForgotPasswordTaskAndCaptureModel();

		assertEquals(DEFAULT_AUTHORING_URL, model.get(AUTHORING_URL_MODEL_KEY));
	}

	@SuppressWarnings("unchecked")
	private Map<String, Object> runForgotPasswordTaskAndCaptureModel() throws Exception {
		User user = new User();
		user.setExternallyManaged(false);
		user.setEmail(USER_EMAIL);
		when(userServiceInternal.getUserByIdOrUsername(-1, USERNAME)).thenReturn(user);
		when(userService.getForgotPasswordToken(USERNAME)).thenReturn(TOKEN);
		when(studioConfiguration.getProperty(SECURITY_RESET_PASSWORD_SERVICE_URL)).thenReturn(SERVICE_URL);
		when(studioConfiguration.getProperty(MAIL_FROM_DEFAULT)).thenReturn("noreply@example.com");
		when(studioConfiguration.getProperty(SECURITY_FORGOT_PASSWORD_MESSAGE_SUBJECT)).thenReturn("Forgot Password");
		when(studioConfiguration.getProperty(MAIL_SMTP_AUTH)).thenReturn("false");

		MimeMessage mimeMessage = new MimeMessage(Session.getInstance(new Properties()));
		when(emailService.createMimeMessage()).thenReturn(mimeMessage);
		doNothing().when(template).process(any(), any(Writer.class));

		EmailForgotPasswordTaskFactory factory = createFactory();
		factory.afterPropertiesSet();
		factory.prepareTask(USERNAME).run();

		ArgumentCaptor<Object> modelCaptor = ArgumentCaptor.forClass(Object.class);
		verify(template).process(modelCaptor.capture(), any(Writer.class));
		return (Map<String, Object>) modelCaptor.getValue();
	}

	private EmailForgotPasswordTaskFactory createFactory() {
		return new EmailForgotPasswordTaskFactory(userService, userServiceInternal, studioConfiguration,
				freeMarkerConfigFactory, emailService, emailServiceNoAuth);
	}
}
