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

package org.craftercms.studio.api.v2.service.publish;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import jakarta.validation.constraints.NotBlank;
import org.craftercms.studio.api.v2.service.publish.PublishService.PublishRequestPath;
import org.craftercms.studio.model.rest.publish.CalculatePublishPackageRequest;
import org.craftercms.studio.model.rest.publish.PublishPackageRequest;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;

import java.util.List;
import java.util.Set;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class PublishRequestPathValidationTest {

	private static ValidatorFactory validatorFactory;
	private static Validator validator;

	@BeforeClass
	public static void setUpValidator() {
		validatorFactory = Validation.buildDefaultValidatorFactory();
		validator = validatorFactory.getValidator();
	}

	@AfterClass
	public static void closeValidator() {
		validatorFactory.close();
	}

	@Test
	public void missingPathEntryIsRejected() {
		PublishPackageRequest request = publishRequest(new PublishRequestPath(null, false, false));

		assertTrue(hasBlankPath(validator.validate(request)));
	}

	@Test
	public void blankPathIsRejectedOnPublishAndCalculate() {
		assertTrue(hasBlankPath(validator.validate(publishRequest(new PublishRequestPath(" ", false, false)))));
		assertTrue(hasBlankPath(validator.validate(calculateRequest(new PublishRequestPath("", false, false)))));
	}

	private static PublishPackageRequest publishRequest(PublishRequestPath path) {
		PublishPackageRequest request = new PublishPackageRequest();
		request.setPublishingTarget("live");
		request.setTitle("title");
		request.setComment("comment");
		request.setPaths(List.of(path));
		return request;
	}

	private static CalculatePublishPackageRequest calculateRequest(PublishRequestPath path) {
		CalculatePublishPackageRequest request = new CalculatePublishPackageRequest();
		request.setPublishingTarget("live");
		request.setPaths(List.of(path));
		return request;
	}

	private static boolean hasBlankPath(Set<? extends ConstraintViolation<?>> violations) {
		assertFalse(violations.isEmpty());
		return violations.stream().anyMatch(violation ->
			violation.getPropertyPath().toString().endsWith("path") &&
				violation.getConstraintDescriptor().getAnnotation() instanceof NotBlank);
	}
}
