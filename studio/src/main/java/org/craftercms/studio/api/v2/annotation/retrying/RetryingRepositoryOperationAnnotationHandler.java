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

package org.craftercms.studio.api.v2.annotation.retrying;

import org.apache.commons.lang3.exception.ExceptionUtils;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.craftercms.commons.aop.AopUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.craftercms.studio.api.v2.exception.RetryingOperationErrorException;
import org.craftercms.studio.api.v2.exception.git.cli.GitCliException;
import org.craftercms.studio.api.v2.exception.git.cli.GitRepositoryLockedException;
import org.eclipse.jgit.api.errors.JGitInternalException;
import org.eclipse.jgit.errors.LockFailedException;
import org.springframework.core.annotation.Order;

import java.lang.reflect.Method;

import static java.lang.String.format;

@Aspect
@Order(1)
public class RetryingRepositoryOperationAnnotationHandler {

	private static final Logger logger = LoggerFactory.getLogger(RetryingRepositoryOperationAnnotationHandler.class);

	private static final int DEFAULT_MAX_RETRIES = 50;

	private int maxRetries = DEFAULT_MAX_RETRIES;
	private int maxSleep = 0;

	public int getMaxRetries() {
		return maxRetries;
	}

	public void setMaxRetries(int maxRetries) {
		this.maxRetries = maxRetries;
	}

	public int getMaxSleep() {
		return maxSleep;
	}

	public void setMaxSleep(int maxSleep) {
		this.maxSleep = maxSleep;
	}

	@Around("@within(org.craftercms.studio.api.v2.annotation.retrying.RetryingRepositoryOperation) || " +
		"@annotation(org.craftercms.studio.api.v2.annotation.retrying.RetryingRepositoryOperation)")
	public Object doRetryingOperation(ProceedingJoinPoint pjp) throws Throwable {
		Method method = AopUtils.getActualMethod(pjp);
		Exception lastException;

		int numAttempts = 0;
		do {
			numAttempts++;
			try {
				// Execute the business code again
				if (numAttempts > 1) {
					logger.debug("Retrying repository operation attempt '{}'", (numAttempts - 1));
				}
				return pjp.proceed();
			} catch (JGitInternalException | GitCliException e) {
				lastException = e;
				if (isRepositoryLocked(e)) {
					logger.debug("Failed to execute '{}' after '{}' attempts", method.getName(), numAttempts, e);
					if (numAttempts < maxRetries) {
						// If the maximum number of retries is not reached, sleep and execute it again
						long sleep = (long) (Math.random() * maxSleep);
						logger.debug("Git repository locked, will retry the operation '{}' after '{}' milliseconds",
							method.getName(), sleep);
						Thread.sleep(sleep);
					}
				} else {
					throw new RetryingOperationErrorException(format("Git operation '%s' has failed",
						method.getName()), e);
				}
			}
		} while (numAttempts < maxRetries);

		// If it gets here, numAttempts >= maxRetries, so we should fail entirely
		throw new RetryingOperationErrorException(format("Failed to execute '%s' after '%d' attempts " +
			"because the git repository was locked", method.getName(), numAttempts), lastException);
	}

	protected boolean isRepositoryLocked(Throwable ex) {
		// Check for JGit exception first, then for CLI exception (not need to check for null with instanceof)
		return ex.getCause() instanceof LockFailedException ||
			ExceptionUtils.getRootCause(ex) instanceof GitRepositoryLockedException;
	}

}
