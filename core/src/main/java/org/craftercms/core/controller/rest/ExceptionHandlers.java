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

package org.craftercms.core.controller.rest;

import org.craftercms.commons.exceptions.InvalidManagementTokenException;
import org.craftercms.commons.validation.ValidationException;
import org.craftercms.commons.validation.ValidationResult;
import org.craftercms.commons.validation.ValidationRuntimeException;
import org.craftercms.core.exception.AuthenticationException;
import org.craftercms.core.exception.ForbiddenPathException;
import org.craftercms.core.exception.HttpStatusCodeAwareException;
import org.craftercms.core.exception.InvalidContextException;
import org.craftercms.core.exception.PathNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.ConstraintViolationException;

import java.util.List;
import java.util.Map;

import static java.util.stream.Collectors.toList;
import static org.craftercms.core.controller.rest.RestControllerBase.createResponseMessage;

/**
 * Global exception handlers for Crafter REST services.
 *
 * @author avasquez
 */
@Order
@ControllerAdvice(annotations = CrafterRestController.class)
public class ExceptionHandlers {
	public static final String RESULT_KEY_VALIDATION_ERRORS = "validationErrors";

	private static final Logger logger = LoggerFactory.getLogger(ExceptionHandlers.class);

    @ExceptionHandler(MissingServletRequestParameterException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    @ResponseBody
    public Map<String, Object> handleInvalidContextException(HttpServletRequest request,
            HttpServletResponse response,
            MissingServletRequestParameterException e) {
        return handleException(request, response, e);
    }

    @ExceptionHandler(InvalidManagementTokenException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    @ResponseBody
    public Map<String, Object> handleInvalidContextException(HttpServletRequest request,
            HttpServletResponse response,
            InvalidManagementTokenException e) {
        return handleException(request, response, e);
    }

    @ExceptionHandler(InvalidContextException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    @ResponseBody
    public Map<String, Object> handleInvalidContextException(HttpServletRequest request,
            HttpServletResponse response,
            InvalidContextException e) {
        return handleException(request, response, e);
    }

    @ExceptionHandler(AuthenticationException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    @ResponseBody
    public Map<String, Object> handleAuthenticationException(HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException e) {
        return handleException(request, response, e);
    }

    @ExceptionHandler(PathNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    @ResponseBody
    public Map<String, Object> handlePathNotFoundException(HttpServletRequest request,
            HttpServletResponse response,
            PathNotFoundException e) {
        return handleException(request, response, e);
    }

    @ExceptionHandler(ForbiddenPathException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    @ResponseBody
    public Map<String, Object> handleForbiddenPathException(HttpServletRequest request,
            HttpServletResponse response,
            ForbiddenPathException e) {
        return handleException(request, response, e);
    }

    @ExceptionHandler(ValidationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    @ResponseBody
    public ValidationResult handleValidationException(HttpServletRequest request,
            HttpServletResponse response,
            ValidationException e) {
        logger.error("Request for " + request.getRequestURI() + " failed", e);

		return e.getResult();
	}

    @ExceptionHandler(ValidationRuntimeException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    @ResponseBody
    public ValidationResult handleValidationRuntimeException(HttpServletRequest request,
            HttpServletResponse response,
            ValidationRuntimeException e) {
        logger.error("Request for " + request.getRequestURI() + " failed", e);

		return e.getResult();
	}

    @ResponseBody
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    @ExceptionHandler(ConstraintViolationException.class)
    public Map<String, Object> handleConstraintValidationException(HttpServletRequest request,
            HttpServletResponse response,
            ConstraintViolationException e) {
        List<ValidationFieldError> validationErrors = e.getConstraintViolations().stream()
                .map(c -> new ValidationFieldError(c.getPropertyPath().toString(), c.getMessage()))
                .collect(toList());
        return Map.of(RESULT_KEY_VALIDATION_ERRORS, validationErrors);
    }

    @ResponseBody
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public Map<String, Object> handleMethodArgumentTypeMismatchException(HttpServletRequest request,
            HttpServletResponse response,
            MethodArgumentTypeMismatchException e) {
        List<ValidationFieldError> validationErrors = List.of(new ValidationFieldError(e.getName(), e.getMessage()));
        return Map.of(RESULT_KEY_VALIDATION_ERRORS, validationErrors);
    }

    @ExceptionHandler(Exception.class)
    // @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    @ResponseBody
    public Map<String, Object> handleException(HttpServletRequest request, HttpServletResponse response, Exception e) {
        logger.error("Request for " + request.getRequestURI() + " failed", e);
        if (e instanceof HttpStatusCodeAwareException ex) {
            response.setStatus(ex.getStatusCode());
            return createResponseMessage(e.getMessage());
        }

		response.setStatus(HttpStatus.INTERNAL_SERVER_ERROR.value());
        return createResponseMessage(e.getMessage());
    }

}
