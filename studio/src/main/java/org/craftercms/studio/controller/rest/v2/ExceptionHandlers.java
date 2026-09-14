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

package org.craftercms.studio.controller.rest.v2;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.exc.MismatchedInputException;
import com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.ConstraintViolationException;

import org.craftercms.commons.config.profiles.ConfigurationProfileNotFoundException;
import org.craftercms.commons.exceptions.InvalidManagementTokenException;
import org.craftercms.commons.http.HttpUtils;
import org.craftercms.commons.security.exception.ActionDeniedException;
import org.craftercms.commons.validation.ValidationException;
import org.craftercms.commons.validation.ValidationResultAware;
import org.craftercms.commons.validation.ValidationRuntimeException;
import org.craftercms.core.controller.rest.ValidationFieldError;
import org.craftercms.core.exception.PathNotFoundException;
import org.craftercms.core.util.ExceptionUtils;
import org.craftercms.studio.api.v1.exception.*;
import org.craftercms.studio.api.v1.exception.repository.*;
import org.craftercms.studio.api.v1.exception.security.*;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage;
import org.craftercms.studio.api.v2.exception.*;
import org.craftercms.studio.api.v2.exception.configuration.InvalidConfigurationException;
import org.craftercms.studio.api.v2.exception.content.ContentExistException;
import org.craftercms.studio.api.v2.exception.content.ContentInPublishQueueException;
import org.craftercms.studio.api.v2.exception.content.ContentLockedByAnotherUserException;
import org.craftercms.studio.api.v2.exception.content.ContentMoveInvalidLocation;
import org.craftercms.studio.api.v2.exception.contentType.ContentTypeUsageException;
import org.craftercms.studio.api.v2.exception.git.MergeInProgressException;
import org.craftercms.studio.api.v2.exception.git.NoMergeStateException;
import org.craftercms.studio.api.v2.exception.logger.LoggerNotFoundException;
import org.craftercms.studio.api.v2.exception.marketplace.MarketplaceNotInitializedException;
import org.craftercms.studio.api.v2.exception.marketplace.MarketplaceUnreachableException;
import org.craftercms.studio.api.v2.exception.marketplace.PluginAlreadyInstalledException;
import org.craftercms.studio.api.v2.exception.marketplace.PluginInstallationException;
import org.craftercms.studio.api.v2.exception.publish.InvalidPackageStateException;
import org.craftercms.studio.api.v2.exception.publish.InvalidTargetException;
import org.craftercms.studio.api.v2.exception.publish.PackageAlreadyApprovedException;
import org.craftercms.studio.api.v2.exception.publish.PublishPackageNotFoundException;
import org.craftercms.studio.api.v2.exception.repository.InvalidRemoteException;
import org.craftercms.studio.api.v2.exception.repository.RepositoryNotFoundException;
import org.craftercms.studio.api.v2.exception.security.ActionsDeniedException;
import org.craftercms.studio.api.v2.exception.security.PackageSubmitterCheckException;
import org.craftercms.studio.api.v2.exception.security.PeerReviewCheckException;
import org.craftercms.studio.model.rest.ApiResponse;
import org.craftercms.studio.model.rest.Result;
import org.craftercms.studio.model.rest.ResultList;
import org.craftercms.studio.model.rest.ResultOne;
import org.owasp.esapi.ESAPI;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.event.Level;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.web.firewall.RequestRejectedException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.ExceptionHandlerMethodResolver;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.UndeclaredThrowableException;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

import static java.lang.String.format;

import org.craftercms.studio.api.v2.exception.contentType.ContentTypeInvalidLocationException;
import static org.craftercms.studio.controller.rest.v2.ResultConstants.*;
import static org.craftercms.studio.model.rest.ApiResponse.INVALID_PARAMS;
import static org.craftercms.studio.model.rest.ApiResponse.CONTENT_TYPE_INVALID_LOCATION;
import static org.slf4j.event.Level.DEBUG;
import static org.slf4j.event.Level.ERROR;
import static org.springframework.http.HttpStatus.*;

/**
 * Controller advice that handles exceptions thrown by API 2 REST controllers.
 *
 * @author avasquez
 */
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice({"org.craftercms.studio.controller.rest.v2", "org.craftercms.studio.controller.web.v1"})
public class ExceptionHandlers {

	private static final Logger logger = LoggerFactory.getLogger(ExceptionHandlers.class);

	private final ExceptionHandlerMethodResolver exceptionHandlerMethodResolver =
		new ExceptionHandlerMethodResolver(getClass());

	@ExceptionHandler({UndeclaredThrowableException.class, InvocationTargetException.class})
	public Result handleWrappedException(HttpServletRequest request, HttpServletResponse response, Exception e)
		throws Exception {
		Throwable unwrapped = unwrapException(e);
		if (unwrapped instanceof Exception ex) {
			return invokeExceptionHandler(request, response, ex);
		}
		return handleException(request, e);
	}

	/**
	 * Invokes the exception handler for the given exception. If the exception
	 * is a wrapped exception, it will be unwrapped and the exception handler
	 * for the unwrapped exception will be invoked.
	 *
	 * @param request the HTTP request
	 * @param response the HTTP response
	 * @param ex the exception to invoke the exception handler for
	 * @return the result of the exception handler
	 * @throws Exception if the exception handler throws an exception
	 */
	private Result invokeExceptionHandler(HttpServletRequest request, HttpServletResponse response, Exception ex)
			throws Exception {
		if (ex instanceof UndeclaredThrowableException || ex instanceof InvocationTargetException) {
			return handleException(request, ex);
		}

		Method method = exceptionHandlerMethodResolver.resolveMethod(ex);
		if (method == null) {
			return handleException(request, ex);
		}

		ResponseStatus responseStatus = AnnotatedElementUtils.findMergedAnnotation(method, ResponseStatus.class);
		if (responseStatus != null) {
			response.setStatus(responseStatus.code().value());
		}

		return (Result) method.invoke(this, request, ex);
	}

	/**
	 * Unwraps the exception to get the actual exception.
	 *
	 * @param ex the exception to unwrap
	 * @return the actual exception
	 */
	private static Throwable unwrapException(Throwable ex) {
		Throwable current = ex;
		while (current != null) {
			if (current instanceof UndeclaredThrowableException ute) {
				current = ute.getUndeclaredThrowable();
			} else if (current instanceof InvocationTargetException ite) {
				current = ite.getTargetException();
			} else {
				break;
			}
		}
		return current != null ? current : ex;
	}

	@ExceptionHandler(AuthenticationException.class)
	@ResponseStatus(HttpStatus.UNAUTHORIZED)
	public Result handleAuthenticationException(HttpServletRequest request, AuthenticationException e) {
		return handleExceptionInternal(request, e, ApiResponse.UNAUTHENTICATED);
	}

	@ExceptionHandler(ActionDeniedException.class)
	@ResponseStatus(HttpStatus.FORBIDDEN)
	public Result handleActionDeniedException(HttpServletRequest request, ActionDeniedException e) {
		return handleExceptionInternal(request, e, ApiResponse.UNAUTHORIZED);
	}

	@ExceptionHandler(PeerReviewCheckException.class)
	@ResponseStatus(HttpStatus.FORBIDDEN)
	public Result handlePeerReviewException(HttpServletRequest request, PeerReviewCheckException e) {
		return handleExceptionInternal(request, e, ApiResponse.PEER_REVIEW_CHECK_FAILED);
	}

	@ExceptionHandler(PackageSubmitterCheckException.class)
	@ResponseStatus(HttpStatus.FORBIDDEN)
	public Result handlePackageSubmitterCheckException(HttpServletRequest request, PackageSubmitterCheckException e) {
		return handleExceptionInternal(request, e, ApiResponse.PACKAGE_SUBMITTER_CHECK_FAILED);
	}

	@ExceptionHandler(ActionsDeniedException.class)
	@ResponseStatus(HttpStatus.FORBIDDEN)
	public Result handleActionsDeniedException(HttpServletRequest request, ActionsDeniedException e) {
		return handleExceptionInternal(request, e, ApiResponse.UNAUTHORIZED);
	}

	@ExceptionHandler(UserAlreadyExistsException.class)
	@ResponseStatus(HttpStatus.CONFLICT)
	public Result handleUserAlreadyExistsException(HttpServletRequest request, UserAlreadyExistsException e) {
		ApiResponse response = new ApiResponse(ApiResponse.USER_ALREADY_EXISTS);
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(UserNotFoundException.class)
	@ResponseStatus(HttpStatus.NOT_FOUND)
	public Result handleUserNotFoundException(HttpServletRequest request, UserNotFoundException e) {
		ApiResponse response = new ApiResponse(ApiResponse.USER_NOT_FOUND);
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(UserExternallyManagedException.class)
	@ResponseStatus(HttpStatus.FORBIDDEN)
	public Result handleUserExternallyManagedException(HttpServletRequest request, UserExternallyManagedException e) {
		ApiResponse response = new ApiResponse(ApiResponse.USER_EXTERNALLY_MANAGED);
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(GroupExternallyManagedException.class)
	@ResponseStatus(HttpStatus.FORBIDDEN)
	public Result handleGroupExternallyManagedException(HttpServletRequest request, GroupExternallyManagedException e) {
		ApiResponse response = new ApiResponse(ApiResponse.GROUP_EXTERNALLY_MANAGED);
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(NoSuchElementException.class)
	@ResponseStatus(HttpStatus.NOT_FOUND)
	public Result handleNoSuchElementException(HttpServletRequest request, NoSuchElementException e) {
		ApiResponse response = new ApiResponse(ApiResponse.CONTENT_NOT_FOUND);
		return handleExceptionInternal(request, e, response, Level.DEBUG);
	}

	@ExceptionHandler(LoggerNotFoundException.class)
	@ResponseStatus(HttpStatus.NOT_FOUND)
	public Result handleLoggerNotFoundException(HttpServletRequest request, LoggerNotFoundException e) {
		ApiResponse response = new ApiResponse(ApiResponse.LOGGER_NOT_FOUND);
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(ConfigurationProfileNotFoundException.class)
	@ResponseStatus(HttpStatus.NOT_FOUND)
	public Result handleConfigurationProfileNotFoundException(HttpServletRequest request, ConfigurationProfileNotFoundException e) {
		ApiResponse response = new ApiResponse(ApiResponse.CONFIGURATION_PROFILE_NOT_FOUND);
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(GroupAlreadyExistsException.class)
	@ResponseStatus(HttpStatus.CONFLICT)
	public Result handleGroupAlreadyExistsException(HttpServletRequest request, GroupAlreadyExistsException e) {
		ApiResponse response = new ApiResponse(ApiResponse.GROUP_ALREADY_EXISTS);
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(InvalidParametersException.class)
	@ResponseStatus(BAD_REQUEST)
	public Result handleInvalidParametersException(HttpServletRequest request, InvalidParametersException e) {
		ApiResponse response = new ApiResponse(INVALID_PARAMS);
		response.setMessage(response.getMessage() + " : " + e.getMessage());
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(ContentTypeInvalidLocationException.class)
	@ResponseStatus(BAD_REQUEST)
	public Result handleContentTypeInvalidLocationException(HttpServletRequest request, ContentTypeInvalidLocationException e) {
		ApiResponse response = new ApiResponse(CONTENT_TYPE_INVALID_LOCATION);
		response.setMessage(response.getMessage() + " : " + e.getMessage());
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(InvalidSiteStateException.class)
	@ResponseStatus(BAD_REQUEST)
	public Result handleInvalidSiteStateException(HttpServletRequest request, InvalidSiteStateException e) {
		ApiResponse response = new ApiResponse(ApiResponse.INVALID_SITE_STATE);
		return handleExceptionInternal(request, e, response, DEBUG);
	}

	@ExceptionHandler(MarketplaceNotInitializedException.class)
	@ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
	public Result handleMarketplaceNotInitializedException(HttpServletRequest request,
							       MarketplaceNotInitializedException e) {
		ApiResponse response = new ApiResponse(ApiResponse.MARKETPLACE_NOT_INITIALIZED);
		response.setMessage(response.getMessage() + ": " + e.getMessage());

		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(MarketplaceUnreachableException.class)
	@ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
	public Result handleMarketplaceUnreachableException(HttpServletRequest request,
							    MarketplaceUnreachableException e) {
		ApiResponse response = new ApiResponse(ApiResponse.MARKETPLACE_UNREACHABLE);
		response.setMessage(response.getMessage() + ": " + e.getMessage());

		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(PluginAlreadyInstalledException.class)
	@ResponseStatus(HttpStatus.CONFLICT)
	public Result handlePluginAlreadyInstalledException(HttpServletRequest request,
							    PluginAlreadyInstalledException e) {
		ApiResponse response = new ApiResponse(ApiResponse.PLUGIN_ALREADY_INSTALLED);
		response.setMessage(response.getMessage() + ": " + e.getMessage());

		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(MissingPluginParameterException.class)
	@ResponseStatus(BAD_REQUEST)
	public Result handleMissingPluginParameterException(HttpServletRequest request,
							    MissingPluginParameterException e) {
		ApiResponse response = new ApiResponse(ApiResponse.PLUGIN_INSTALLATION_ERROR);
		response.setMessage(response.getMessage() + ": " + e.getMessage());

		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(PluginInstallationException.class)
	@ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
	public Result handlePluginInstallationException(HttpServletRequest request,
							PluginInstallationException e) {
		ApiResponse response = new ApiResponse(ApiResponse.PLUGIN_INSTALLATION_ERROR);
		response.setMessage(response.getMessage() + ": " + e.getMessage());

		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(PublishedRepositoryNotFoundException.class)
	@ResponseStatus(HttpStatus.NOT_FOUND)
	public Result handlePublishedRepositoryNotFoundException(HttpServletRequest request,
								 PublishedRepositoryNotFoundException e) {
		ApiResponse response = new ApiResponse(ApiResponse.CONTENT_NOT_FOUND);
		response.setMessage(format("%s:%s", response.getMessage(), e.getMessage()));
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(ServiceLayerException.class)
	@ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
	public Result handleServiceException(HttpServletRequest request, ServiceLayerException e) {
		ApiResponse response = new ApiResponse(ApiResponse.INTERNAL_SYSTEM_FAILURE);
		response.setMessage(response.getMessage() + ": " + e.getMessage());

		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(CompositeException.class)
	@ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
	public Result handleCompositeException(HttpServletRequest request, CompositeException compositeException) {
		ApiResponse response = new ApiResponse(ApiResponse.INTERNAL_SYSTEM_FAILURE);
		String message = response.getMessage() + ": " + compositeException.getMessage() +
			". Caused by: [" +
			compositeException.getExceptions().stream()
				.map(Throwable::getMessage)
				.collect(Collectors.joining(", "))
			+ "]";
		response.setMessage(message);
		return handleExceptionInternal(request, compositeException, response);
	}

	@ExceptionHandler(GroupNotFoundException.class)
	@ResponseStatus(HttpStatus.NOT_FOUND)
	public Result handleGroupNotFoundException(HttpServletRequest request, GroupNotFoundException e) {
		ApiResponse response = new ApiResponse(ApiResponse.GROUP_NOT_FOUND);
		return handleExceptionInternal(request, e, response);
	}


	@ResponseStatus(BAD_REQUEST)
	@ExceptionHandler(JsonProcessingException.class)
	public Result handleJsonProcessingException(HttpServletRequest request, JsonProcessingException e) {
		ApiResponse response = new ApiResponse(INVALID_PARAMS);
		return handleExceptionInternal(request, e, response);
	}

	@ResponseStatus(BAD_REQUEST)
	@ExceptionHandler(UnrecognizedPropertyException.class)
	public Result handleUnrecognizedPropertyException(HttpServletRequest request, UnrecognizedPropertyException e) {
		ApiResponse response = new ApiResponse(INVALID_PARAMS);
		response.setMessage(format("Unrecognized '%s' property found in request", e.getPropertyName()));
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(SiteAlreadyExistsException.class)
	@ResponseStatus(HttpStatus.CONFLICT)
	public Result handleSiteAlreadyExistsException(HttpServletRequest request, SiteAlreadyExistsException e) {
		ApiResponse response = new ApiResponse(ApiResponse.SITE_ALREADY_EXISTS);
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(SiteNotFoundException.class)
	@ResponseStatus(HttpStatus.NOT_FOUND)
	public Result handleSiteNotFoundException(HttpServletRequest request, SiteNotFoundException e) {
		ApiResponse response = new ApiResponse(ApiResponse.SITE_NOT_FOUND);
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(RemoteAlreadyExistsException.class)
	@ResponseStatus(HttpStatus.CONFLICT)
	public Result handleRemoteAlreadyExistsException(HttpServletRequest request, RemoteAlreadyExistsException e) {
		ApiResponse response = new ApiResponse(ApiResponse.REMOTE_REPOSITORY_ALREADY_EXISTS);
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(InvalidRemoteUrlException.class)
	@ResponseStatus(BAD_REQUEST)
	public Result handleInvalidRemoteUrlException(HttpServletRequest request, InvalidRemoteUrlException e) {
		ApiResponse response = new ApiResponse(INVALID_PARAMS);
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(PasswordRequirementsFailedException.class)
	@ResponseStatus(BAD_REQUEST)
	public Result handlePasswordRequirementsFailedException(HttpServletRequest request,
								PasswordRequirementsFailedException e) {
		ApiResponse response = new ApiResponse(ApiResponse.USER_PASSWORD_REQUIREMENTS_FAILED);
		return handleExceptionInternal(request, e, response, DEBUG);
	}

	@ResponseStatus(BAD_REQUEST)
	@ExceptionHandler(RequestRejectedException.class)
	public Result handleRequestRejectedException(HttpServletRequest request, RequestRejectedException e) {
		ApiResponse response = new ApiResponse(INVALID_PARAMS);
		response.setMessage(e.getMessage());
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(PasswordDoesNotMatchException.class)
	@ResponseStatus(HttpStatus.UNAUTHORIZED)
	public Result handlePasswordDoesNotMatchException(HttpServletRequest request,
							  PasswordDoesNotMatchException e) {
		ApiResponse response = new ApiResponse(ApiResponse.USER_PASSWORD_DOES_NOT_MATCH);
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(PullFromRemoteConflictException.class)
	@ResponseStatus(HttpStatus.CONFLICT)
	public Result handlePullFromRemoteConflictException(HttpServletRequest request,
							    PullFromRemoteConflictException e) {
		ApiResponse response = new ApiResponse(ApiResponse.PULL_FROM_REMOTE_REPOSITORY_CONFLICT);
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(ContentNotFoundException.class)
	@ResponseStatus(HttpStatus.NOT_FOUND)
	public Result handleContentNotFoundException(HttpServletRequest request, ContentNotFoundException e) {
		ApiResponse response = new ApiResponse(ApiResponse.CONTENT_NOT_FOUND);
		response.setRemedialAction(
			format("Check that path '%s' is correct and it exists in site '%s'", e.getPath(), e.getSite()));
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(BlobNotFoundException.class)
	@ResponseStatus(HttpStatus.NOT_FOUND)
	public Result handleBlobNotFoundException(HttpServletRequest request, BlobNotFoundException e) {
		ApiResponse response = new ApiResponse(ApiResponse.BLOB_NOT_FOUND);
		response.setRemedialAction(
			format("Check your blob store configuration and that path '%s' is correct and it exists in site '%s'", e.getPath(), e.getSite()));
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(PublishPackageNotFoundException.class)
	@ResponseStatus(HttpStatus.NOT_FOUND)
	public ResultOne<Long> handlePublishPackageNotFoundException(HttpServletRequest request,
								     PublishPackageNotFoundException e) {
		ApiResponse response = new ApiResponse(ApiResponse.PUBLISH_PACKAGE_NOT_FOUND);
		handleExceptionInternal(request, e, response);

		ResultOne<Long> result = new ResultOne<>();
		result.setResponse(response);
		result.setEntity(RESULT_KEY_PACKAGE, e.getPackageId());

		return result;
	}

	@ExceptionHandler(MissingServletRequestParameterException.class)
	@ResponseStatus(BAD_REQUEST)
	public Result handleMissingServletRequestParameterException(HttpServletRequest request,
								    MissingServletRequestParameterException e) {
		ApiResponse response = new ApiResponse(INVALID_PARAMS);
		response.setRemedialAction(
			format("Add missing parameter '%s' of type '%s'", e.getParameterName(), e.getParameterType()));
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	@ResponseStatus(BAD_REQUEST)
	public ResultList<ValidationFieldError> handleMethodArgumentNotValidException(HttpServletRequest request,
										      MethodArgumentNotValidException e) {
		ApiResponse response = new ApiResponse(INVALID_PARAMS);
		handleExceptionInternal(request, e, response, DEBUG);
		ResultList<ValidationFieldError> result = new ResultList<>();
		result.setResponse(response);
		result.setEntities(RESULT_KEY_VALIDATION_ERRORS,
			e.getBindingResult()
				.getFieldErrors().stream()
				.map(error -> new ValidationFieldError(error.getField(), error.getDefaultMessage()))
				.collect(Collectors.toList()));
		return result;
	}

	@ResponseStatus(BAD_REQUEST)
	@ExceptionHandler(ConstraintViolationException.class)
	public ResultList<ValidationFieldError> handleConstraintValidationException(HttpServletRequest request,
										    ConstraintViolationException e) {
		ApiResponse response = new ApiResponse(INVALID_PARAMS);
		handleExceptionInternal(request, e, response);
		ResultList<ValidationFieldError> result = new ResultList<>();
		result.setEntities(RESULT_KEY_VALIDATION_ERRORS, e.getConstraintViolations().stream()
			.map(c -> new ValidationFieldError(c.getPropertyPath().toString(), c.getMessage()))
			.collect(Collectors.toList()));
		result.setResponse(response);

		return result;
	}

	@ExceptionHandler(HttpMessageNotReadableException.class)
	@ResponseStatus(BAD_REQUEST)
	public Result handleHttpMessageNotReadableException(HttpServletRequest request,
							    HttpMessageNotReadableException e) {
		UnrecognizedPropertyException unrecognizedPropertyException = ExceptionUtils.getThrowableOfType(e, UnrecognizedPropertyException.class);
		if (unrecognizedPropertyException != null) {
			return handleUnrecognizedPropertyException(request, unrecognizedPropertyException);
		}

		MismatchedInputException mismatchedInputException = ExceptionUtils.getThrowableOfType(e, MismatchedInputException.class);
		if (mismatchedInputException != null) {
			return handleMismatchInputException(request, mismatchedInputException);
		}
		ApiResponse response = new ApiResponse(INVALID_PARAMS);
		handleExceptionInternal(request, e, response);
		ResultOne<String> result = new ResultOne<>();
		result.setResponse(response);

		result.setEntity(RESULT_KEY_MESSAGE, e.getMessage());
		return result;
	}

	@ResponseStatus(BAD_REQUEST)
	@ExceptionHandler(MismatchedInputException.class)
	public Result handleMismatchInputException(HttpServletRequest request,
						   MismatchedInputException e) {
		ApiResponse response = new ApiResponse(INVALID_PARAMS);
		handleExceptionInternal(request, e, response);
		ResultList<ValidationFieldError> result = new ResultList<>();
		result.setResponse(response);
		String fieldName = e.getPath().get(0).getFieldName();

		result.setEntities(RESULT_KEY_VALIDATION_ERRORS,
			List.of(new ValidationFieldError(fieldName, ESAPI.encoder().encodeForJSON(e.getMessage()))));
		return result;
	}

	@ExceptionHandler(MethodArgumentTypeMismatchException.class)
	@ResponseStatus(BAD_REQUEST)
	public ResultList<ValidationFieldError> handleMethodArgumentTypeMismatchException(HttpServletRequest request,
											  MethodArgumentTypeMismatchException e) {
		ApiResponse response = new ApiResponse(INVALID_PARAMS);
		handleExceptionInternal(request, e, response);
		ResultList<ValidationFieldError> result = new ResultList<>();
		result.setResponse(response);
		result.setEntities(RESULT_KEY_VALIDATION_ERRORS,
			List.of(new ValidationFieldError(e.getName(), ESAPI.encoder().encodeForJSON(e.getMessage()))));
		return result;
	}

	@ExceptionHandler(InvalidManagementTokenException.class)
	@ResponseStatus(HttpStatus.UNAUTHORIZED)
	public Result handleInvalidManagementTokenException(HttpServletRequest request,
							    InvalidManagementTokenException e) {
		ApiResponse response = new ApiResponse(ApiResponse.UNAUTHORIZED);
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(BindException.class)
	@ResponseStatus(BAD_REQUEST)
	public Result handleBeanPropertyBindingResult(HttpServletRequest request, BindException e) {
		ApiResponse response = new ApiResponse(INVALID_PARAMS);
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(RemoteNotRemovableException.class)
	@ResponseStatus(BAD_REQUEST)
	public Result handleRemoteNotRemovableException(HttpServletRequest request, RemoteNotRemovableException e) {
		ApiResponse response = new ApiResponse(ApiResponse.REMOTE_REPOSITORY_NOT_REMOVABLE);
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(PathNotFoundException.class)
	@ResponseStatus(HttpStatus.NOT_FOUND)
	public Result handleException(HttpServletRequest request, PathNotFoundException e) {
		ApiResponse response = new ApiResponse(ApiResponse.CONTENT_NOT_FOUND);
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(InvalidConfigurationException.class)
	@ResponseStatus(BAD_REQUEST)
	public Result handleInvalidConfigurationException(HttpServletRequest request,
							  InvalidConfigurationException e) {
		ApiResponse response = new ApiResponse(INVALID_PARAMS);
		response.setMessage(format("%s:%s", response.getMessage(), e.getMessage()));
		return handleExceptionInternal(request, e, response);
	}

	@ResponseStatus(BAD_REQUEST)
	@ExceptionHandler
	public Result handleSitePolicyValidationException(HttpServletRequest request,
							  org.craftercms.studio.api.v2.exception.validation.ValidationException e) {
		ApiResponse response = new ApiResponse(INVALID_PARAMS);
		response.setMessage(format("%s:%s", response.getMessage(), e.getMessage()));
		return handleExceptionInternal(request, e, response);
	}


	@ExceptionHandler({ValidationRuntimeException.class, ValidationException.class})
	@ResponseStatus(BAD_REQUEST)
	public ResultList<ValidationFieldError> handleValidationRuntimeException(HttpServletRequest request,
										 ValidationResultAware e) {
		ApiResponse response = new ApiResponse(INVALID_PARAMS);
		handleExceptionInternal(request, (Exception) e, response);

		ResultList<ValidationFieldError> result = new ResultList<>();
		result.setEntities(RESULT_KEY_VALIDATION_ERRORS,
			e.getResult().getErrors().entrySet().stream().map(entry ->
					new ValidationFieldError(entry.getKey(), entry.getValue()))
				.collect(Collectors.toList()));
		result.setResponse(response);
		return result;
	}

	@ExceptionHandler(InvalidRemoteRepositoryCredentialsException.class)
	@ResponseStatus(BAD_REQUEST)
	public Result handleInvalidRemoteRepositoryCredentialsException(HttpServletRequest request,
									InvalidRemoteRepositoryCredentialsException e) {
		ApiResponse response = new ApiResponse(ApiResponse.REMOTE_REPOSITORY_AUTHENTICATION_FAILED);
		response.setMessage(format("%s:%s", response.getMessage(), e.getMessage()));
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(RemoteRepositoryNotFoundException.class)
	@ResponseStatus(BAD_REQUEST)
	public Result handleRemoteRepositoryNotFoundException(HttpServletRequest request,
							      RemoteRepositoryNotFoundException e) {
		ApiResponse response = new ApiResponse(ApiResponse.REMOTE_REPOSITORY_NOT_FOUND);
		response.setMessage(format("%s:%s", response.getMessage(), e.getMessage()));
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(ContentLockedByAnotherUserException.class)
	@ResponseStatus(HttpStatus.CONFLICT)
	public ResultOne<String> handleException(HttpServletRequest request, ContentLockedByAnotherUserException e) {
		var response = new ApiResponse(ApiResponse.CONTENT_ALREADY_LOCKED);
		handleExceptionInternal(request, e, response);
		var result = new ResultOne<String>();
		result.setResponse(response);
		result.setEntity(RESULT_KEY_PERSON, e.getLockOwner());
		return result;
	}

	@ExceptionHandler(ContentExistException.class)
	@ResponseStatus(HttpStatus.CONFLICT)
	public Result handleException(HttpServletRequest request, ContentExistException e) {
		ApiResponse response = new ApiResponse(ApiResponse.CONTENT_ALREADY_EXISTS);
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(ContentMoveInvalidLocation.class)
	@ResponseStatus(BAD_REQUEST)
	public Result handleException(HttpServletRequest request, ContentMoveInvalidLocation e) {
		ApiResponse response = new ApiResponse(ApiResponse.CONTENT_MOVE_INVALID_LOCATION);
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(MissingServletRequestPartException.class)
	@ResponseStatus(BAD_REQUEST)
	public Result handleException(HttpServletRequest request, MissingServletRequestPartException e) {
		ApiResponse response = new ApiResponse(ApiResponse.MISSING_REQUEST_PART);
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(ContentInPublishQueueException.class)
	@ResponseStatus(HttpStatus.CONFLICT)
	public ResultList<PublishPackage> handleException(HttpServletRequest request, ContentInPublishQueueException e) {
		ApiResponse response = new ApiResponse(ApiResponse.CONTENT_IN_PUBLISH_QUEUE);
		response.setMessage(e.getMessage());
		handleExceptionInternal(request, e, response);
		ResultList<PublishPackage> result = new ResultList<>();
		result.setResponse(response);
		result.setEntities(RESULT_KEY_PUBLISH_PACKAGES, e.getPublishPackages());

		return result;
	}

	@ExceptionHandler(InvalidPackageStateException.class)
	@ResponseStatus(HttpStatus.CONFLICT)
	public Result handleException(HttpServletRequest request, InvalidPackageStateException e) {
		ApiResponse response = new ApiResponse(ApiResponse.INVALID_PACKAGE_STATE);
		response.setMessage(e.getMessage());
		handleExceptionInternal(request, e, response);
		ResultOne<Long> result = new ResultOne<>();
		result.setResponse(response);
		result.setEntity(RESULT_KEY_PACKAGE, e.getPackageId());
		return result;
	}

	@ExceptionHandler(PackageAlreadyApprovedException.class)
	@ResponseStatus(HttpStatus.CONFLICT)
	public Result handleException(HttpServletRequest request, PackageAlreadyApprovedException e) {
		ApiResponse response = new ApiResponse(ApiResponse.PACKAGE_ALREADY_APPROVED);
		handleExceptionInternal(request, e, response);
		ResultOne<Long> result = new ResultOne<>();
		result.setResponse(response);
		result.setEntity(RESULT_KEY_PACKAGE, e.getPackageId());
		return result;
	}

	@ExceptionHandler
	@ResponseStatus(BAD_REQUEST)
	public Result handleException(HttpServletRequest request, InvalidTargetException e) {
		ApiResponse response = new ApiResponse(ApiResponse.INVALID_PUBLISH_TARGET);
		handleExceptionInternal(request, e, response);
		ResultOne<String[]> result = new ResultOne<>();
		result.setResponse(response);
		result.setEntity(RESULT_KEY_VALID_TARGETS, e.getValidTargets());
		return result;
	}

	@ExceptionHandler
	@ResponseStatus(NOT_FOUND)
	public Result handleException(HttpServletRequest request, RepositoryNotFoundException e) {
		ApiResponse response = new ApiResponse(ApiResponse.REPOSITORY_NOT_FOUND);
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(InvalidRemoteException.class)
	@ResponseStatus(INTERNAL_SERVER_ERROR)
	public Result handleException(HttpServletRequest request, InvalidRemoteException e) {
		ApiResponse response = new ApiResponse(ApiResponse.ADD_REMOTE_INVALID);
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler
	@ResponseStatus(HttpStatus.CONFLICT)
	public Result handleException(HttpServletRequest request, MergeInProgressException e) {
		ApiResponse response = new ApiResponse(ApiResponse.REPOSITORY_IN_MERGE_STATE);
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler
	@ResponseStatus(HttpStatus.CONFLICT)
	public Result handleException(HttpServletRequest request, NoMergeStateException e) {
		ApiResponse response = new ApiResponse(ApiResponse.REPOSITORY_NOT_IN_MERGE_STATE);
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler
	@ResponseStatus(CONFLICT)
	public Result handleException(HttpServletRequest request, ContentTypeUsageException e) {
		ApiResponse response = new ApiResponse(ApiResponse.CONTENT_TYPE_IN_USE);
		response.setMessage(e.getMessage());
		return handleExceptionInternal(request, e, response);
	}

	@ExceptionHandler(Exception.class)
	@ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
	public Result handleException(HttpServletRequest request, Exception e) {
		ApiResponse response = new ApiResponse(ApiResponse.INTERNAL_SYSTEM_FAILURE);
		return handleExceptionInternal(request, e, response);
	}

	protected Result handleExceptionInternal(HttpServletRequest request, Exception e, ApiResponse response) {
		return handleExceptionInternal(request, e, response, ERROR);
	}

	protected Result handleExceptionInternal(HttpServletRequest request, Exception e, ApiResponse response,
						 Level logLevel) {
		switch (logLevel) {
			case DEBUG:
				logger.debug("API endpoint '{}' failed with response '{}'",
					HttpUtils.getFullRequestUri(request, true), response, e);
				break;
			case WARN:
				logger.warn("API endpoint '{}' failed with response '{}'",
					HttpUtils.getFullRequestUri(request, true), response, e);
				break;
			case INFO:
				logger.info("API endpoint '{}' failed with response '{}'",
					HttpUtils.getFullRequestUri(request, true), response, e);
				break;
			case ERROR:
				logger.error("API endpoint '{}' failed with response '{}'",
					HttpUtils.getFullRequestUri(request, true), response, e);
				break;
			default:
				break;
		}

		Result result = new Result();
		result.setResponse(response);

		return result;
	}
}
