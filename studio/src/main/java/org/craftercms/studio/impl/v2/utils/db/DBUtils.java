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

package org.craftercms.studio.impl.v2.utils.db;

import org.craftercms.studio.impl.v2.utils.Wrapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.function.ThrowingSupplier;

/**
 * Utility class for database-related operations.
 */
public class DBUtils {

	private final static Logger logger = LoggerFactory.getLogger(DBUtils.class);

	/**
	 * Execute a runnable in a transaction.
	 * This method will use the provided transactionManager to run the given runnable in a transaction. It will
	 * be automatically committed (or rolled back if an exception is thrown).
	 * After transaction is complete, this method will rethrow any exception thrown by the runnable.
	 *
	 * @param transactionManager The transaction manager
	 * @param transactionName    The name of the transaction
	 * @param runnable           The runnable to execute
	 * @throws Exception any exception thrown by the runnable
	 */
	public static void runInTransaction(final PlatformTransactionManager transactionManager,
										final String transactionName,
										final ThrowingRunnable runnable) throws Exception {
		runInTransaction(transactionManager, transactionName, null, () -> {
			runnable.run();
			return null; // Return null since we are not expecting a result
		});
	}

	/**
	 * Execute a runnable in a transaction.
	 * This method will use the provided transactionManager to run the given supplier in a transaction. It will
	 * be automatically committed (or rolled back if an exception is thrown).
	 * After transaction is complete, this method will rethrow any exception thrown by the runnable.
	 * If no exception is thrown, the result of the runnable will be returned.
	 *
	 * @param transactionManager The transaction manager
	 * @param transactionName    The name of the transaction
	 * @param supplier           The supplier to execute
	 * @return the result of the supplier
	 * @throws Exception any exception thrown by the runnable
	 */
	public static <T> T runInTransaction(final PlatformTransactionManager transactionManager,
										 final String transactionName,
										 final ThrowingSupplier<T> supplier) throws Exception {
		return runInTransaction(transactionManager, transactionName, null, supplier);
	}

	/**
	 * Execute a runnable in a transaction.
	 * This method will use the provided transactionManager to run the given supplier in a transaction. It will
	 * be automatically committed (or rolled back if an exception is thrown).
	 * After transaction is complete, this method will rethrow any exception thrown by the runnable.
	 * If no exception is thrown, the result of the runnable will be returned.
	 *
	 * @param transactionManager The transaction manager
	 * @param transactionName    The name of the transaction
	 * @param isolationLevel     The isolation level for the transaction
	 * @param supplier           The supplier to execute
	 * @return the result of the supplier
	 * @throws Exception any exception thrown by the runnable
	 */
	public static <T> T runInTransaction(final PlatformTransactionManager transactionManager,
										 final String transactionName,
										 final Integer isolationLevel,
										 final ThrowingSupplier<T> supplier) throws Exception {
		return runInTransaction(transactionManager, transactionName, isolationLevel,
				TransactionDefinition.PROPAGATION_REQUIRED, supplier);
	}

	/**
	 * Execute a runnable in a savepoint of the current transaction.
	 * If there is a current transaction, the runnable runs in a nested transaction (a savepoint). If it throws,
	 * only the work done inside the runnable is rolled back, the current transaction stays usable, and the
	 * exception is rethrown. If there is no current transaction, a new one is created.
	 * The transaction manager must support nested transactions (for example, a
	 * {@link org.springframework.jdbc.datasource.DataSourceTransactionManager}).
	 *
	 * @param transactionManager The transaction manager
	 * @param transactionName    The name of the transaction
	 * @param runnable           The runnable to execute
	 * @throws Exception any exception thrown by the runnable
	 */
	public static void runInNestedTransaction(final PlatformTransactionManager transactionManager,
											  final String transactionName,
											  final ThrowingRunnable runnable) throws Exception {
		runInTransaction(transactionManager, transactionName, null, TransactionDefinition.PROPAGATION_NESTED, () -> {
			runnable.run();
			return null;
		});
	}

	private static <T> T runInTransaction(final PlatformTransactionManager transactionManager,
										  final String transactionName,
										  final Integer isolationLevel,
										  final int propagationBehavior,
										  final ThrowingSupplier<T> supplier) throws Exception {
		Wrapper<Exception> exception = new Wrapper<>();
		TransactionTemplate transactionTemplate = new TransactionTemplate(transactionManager);
		transactionTemplate.setName(transactionName);
		transactionTemplate.setPropagationBehavior(propagationBehavior);
		if (isolationLevel != null) {
			transactionTemplate.setIsolationLevel(isolationLevel);
		}
		T result = transactionTemplate.execute(status -> {
			logger.trace("Starting transaction '{}'", status.getTransactionName());
			try {
				return supplier.getWithException();
			} catch (Exception e) {
				logger.trace("Error occurred during transaction '{}', rolling back", status.getTransactionName(), e);
				status.setRollbackOnly();
				exception.set(e);
			}
			return null;
		});
		if (exception.hasValue()) {
			logger.error("Error occurred during transaction '{}', rolling back", transactionName, exception.get());
			throw exception.get();
		}
		logger.trace("Completed transaction '{}'", transactionName);
		return result;
	}

	/**
	 * Registers a callback to be executed after the current transaction is committed. If there is no active transaction, the callback will be executed immediately.
	 *
	 * @param callback the callback to be executed after the transaction is committed
	 */
	public static void runAfterCommit(Runnable callback) {
		if (TransactionSynchronizationManager.isSynchronizationActive()) {
			TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
				@Override
				public void afterCommit() {
					callback.run();
				}
			});
		} else {
			callback.run();
		}
	}

	/**
	 * Registers a callback to be executed after the current transaction is rolled back.
	 * If there is no active transaction, the callback will not be executed.
	 *
	 * @param callback the callback to be executed after the transaction is rolled back
	 */
	public static void runAfterRollback(Runnable callback) {
		if (TransactionSynchronizationManager.isSynchronizationActive()) {
			TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
				@Override
				public void afterCompletion(int status) {
					if (status == TransactionSynchronization.STATUS_ROLLED_BACK) {
						callback.run();
					}
				}
			});
		}
	}

	/**
	 * Runnable interface that can throw an exception.
	 */
	@FunctionalInterface
	public interface ThrowingRunnable {
		void run() throws Exception;
	}

}
