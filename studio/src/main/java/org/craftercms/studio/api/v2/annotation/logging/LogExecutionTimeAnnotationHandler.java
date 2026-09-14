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

package org.craftercms.studio.api.v2.annotation.logging;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.craftercms.commons.aop.AopUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.event.Level;
import org.slf4j.spi.LoggingEventBuilder;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.core.annotation.Order;

import java.lang.reflect.Method;
import java.util.Arrays;

/**
 * Handles the {@link LogExecutionTime} annotation.
 * Log execution time of a method if the method's class logger is enabled trace
 */
@Aspect
@Order()
public class LogExecutionTimeAnnotationHandler {

	private static final Logger logger = LoggerFactory.getLogger(LogExecutionTimeAnnotationHandler.class);

	// This method matches public methods and not internal call with one of the following conditions:
	// - methods declared on classes annotated with LogExecutionTime
	// - methods declared on classes meta-annotated with LogExecutionTime (only one level deep). e.g.: @LogExecutionTime, which is annotated with @LogExecutionTime
	// - methods annotated with LogExecutionTime
	// - methods meta-annotated with LogExecutionTime (only one level deep)
	@Around("@within(LogExecutionTime) || " +
		"within(@LogExecutionTime *) || " +
		"within(@(@LogExecutionTime *) *) || " +
		"@annotation(LogExecutionTime) || " +
		"execution(@(@LogExecutionTime *) * *(..))")
	public Object logExecutionTime(ProceedingJoinPoint pjp) throws Throwable {
		MethodSignature signature = (MethodSignature) pjp.getSignature();
		String methodName = signature.toShortString();
		String args = Arrays.toString(pjp.getArgs());
		Logger methodLogger = LoggerFactory.getLogger(signature.getDeclaringType());

		if (methodLogger == null) {
			logger.debug("Method '{}' is annotated with @LogExecutionTime but does not have a valid logger. " +
				"This annotation will be ignored.", methodName);
			return pjp.proceed();
		}

		Method method = AopUtils.getActualMethod(pjp);
		LogExecutionTime annotation = AnnotationUtils.findAnnotation(method, LogExecutionTime.class);
		if (annotation == null) {
			annotation = AnnotationUtils.findAnnotation(method.getDeclaringClass(), LogExecutionTime.class);
		}

		if (annotation == null) {
			logger.debug("Unable to find LogExecutionTime annotation on method '{}.{}'. ",
				method.getDeclaringClass().getName(), method.getName());
			return pjp.proceed();
		}

		Level logLevel = annotation.value() != null ? annotation.value() : Level.TRACE;

		long startTime = 0;
		if (methodLogger.isEnabledForLevel(logLevel)) {
			startTime = System.currentTimeMillis();
		}
		Object process = pjp.proceed();
		if (methodLogger.isEnabledForLevel(logLevel)) {
			LoggingEventBuilder loggingEventBuilder = methodLogger.atLevel(logLevel);
			loggingEventBuilder.log("Method '{}' with parameters '{}' executed in '{}' milliseconds",
				methodName, args, System.currentTimeMillis() - startTime);
		}

		return process;
	}
}
