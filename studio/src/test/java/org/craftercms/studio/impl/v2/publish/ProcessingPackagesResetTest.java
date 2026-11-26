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
package org.craftercms.studio.impl.v2.publish;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.craftercms.studio.api.v2.dal.RetryingDatabaseOperationFacade;
import org.craftercms.studio.api.v2.dal.publish.PublishDAO;
import org.craftercms.studio.impl.v2.upgrade.StudioUpgradeManagerImpl;
import org.craftercms.studio.impl.v2.utils.spring.context.BootstrapManagerImpl;
import org.craftercms.studio.impl.v2.utils.spring.event.BootstrapFinishedEvent;
import org.craftercms.studio.impl.v2.utils.spring.event.StartSystemUpgradeEvent;
import org.junit.Test;
import org.springframework.context.annotation.AnnotationConfigUtils;
import org.springframework.context.event.EventListener;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;

import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.PROCESSING;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.READY;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

public class ProcessingPackagesResetTest {

	@Test
	public void resetIsAttemptedOnlyOnce() {
		PublishDAO publishDao = mock(PublishDAO.class);
		ProcessingPackagesReset reset = new ProcessingPackagesReset(publishDao, runningFacade());
		assertFalse(reset.isResetAttempted());

		reset.resetProcessingPackages();
		reset.resetProcessingPackages();

		verify(publishDao, times(1)).resetProcessingPackages(READY.value, PROCESSING.value);
		assertTrue(reset.isResetAttempted());
	}

	@Test
	public void resetIsNotMarkedAttemptedWhileItRuns() {
		PublishDAO publishDao = mock(PublishDAO.class);
		RetryingDatabaseOperationFacade facade = runningFacade();
		ProcessingPackagesReset reset = new ProcessingPackagesReset(publishDao, facade);
		boolean[] attemptedDuringReset = {true};
		doAnswer(invocation -> {
			attemptedDuringReset[0] = reset.isResetAttempted();
			return null;
		}).when(publishDao).resetProcessingPackages(anyLong(), anyLong());

		reset.resetProcessingPackages();

		// A publish request handled while the reset runs is deferred by Publisher
		assertFalse(attemptedDuringReset[0]);
		assertTrue(reset.isResetAttempted());
	}

	@Test
	public void failedResetIsNotRetriedAndStillMarksTheAttempt() {
		PublishDAO publishDao = mock(PublishDAO.class);
		doThrow(new RuntimeException("reset failed")).when(publishDao).resetProcessingPackages(anyLong(), anyLong());
		ProcessingPackagesReset reset = new ProcessingPackagesReset(publishDao, runningFacade());

		reset.resetProcessingPackages();
		reset.resetProcessingPackages();

		verify(publishDao, times(1)).resetProcessingPackages(READY.value, PROCESSING.value);
		assertTrue(reset.isResetAttempted());
	}

	@Test
	public void resetListenerRunsAfterTheSystemUpgradeAndBeforeTheBootstrapFinishes() throws Exception {
		Order upgradeOrder = StudioUpgradeManagerImpl.class.getMethod("startUpgrade").getAnnotation(Order.class);
		Order resetOrder = ProcessingPackagesReset.class.getMethod("resetProcessingPackages").getAnnotation(Order.class);
		Order bootstrapOrder = BootstrapManagerImpl.class.getMethod("onStartSystemUpgrade").getAnnotation(Order.class);

		assertEquals(ProcessingPackagesReset.RESET_ORDER, resetOrder.value());
		assertTrue(upgradeOrder.value() < resetOrder.value());
		assertEquals(Ordered.LOWEST_PRECEDENCE, bootstrapOrder.value());
		assertTrue(resetOrder.value() < bootstrapOrder.value());
	}

	@Test
	public void resetRunsOnceBeforeTheSystemIsReady() {
		List<String> steps = new CopyOnWriteArrayList<>();
		PublishDAO publishDao = mock(PublishDAO.class);
		try (GenericApplicationContext context = bootstrapContext(publishDao, steps)) {
			BootstrapManagerImpl bootstrapManager = context.getBean(BootstrapManagerImpl.class);
			ProcessingPackagesReset reset = context.getBean(ProcessingPackagesReset.class);
			doAnswer(invocation -> {
				steps.add("reset, system ready: " + bootstrapManager.isSystemReady());
				return null;
			}).when(publishDao).resetProcessingPackages(anyLong(), anyLong());
			assertFalse(bootstrapManager.isSystemReady());

			context.publishEvent(new StartSystemUpgradeEvent(this));

			assertEquals(List.of("system upgrade", "reset, system ready: false", "bootstrap finished"), steps);
			assertTrue(bootstrapManager.isSystemReady());
			assertTrue(reset.isResetAttempted());
			verify(publishDao, times(1)).resetProcessingPackages(READY.value, PROCESSING.value);
		}
	}

	@Test
	public void failedResetDoesNotBlockTheSystemReadiness() {
		List<String> steps = new CopyOnWriteArrayList<>();
		PublishDAO publishDao = mock(PublishDAO.class);
		try (GenericApplicationContext context = bootstrapContext(publishDao, steps)) {
			BootstrapManagerImpl bootstrapManager = context.getBean(BootstrapManagerImpl.class);
			ProcessingPackagesReset reset = context.getBean(ProcessingPackagesReset.class);
			doAnswer(invocation -> {
				steps.add("reset failed");
				throw new RuntimeException("reset failed");
			}).when(publishDao).resetProcessingPackages(anyLong(), anyLong());

			context.publishEvent(new StartSystemUpgradeEvent(this));

			assertEquals(List.of("system upgrade", "reset failed", "bootstrap finished"), steps);
			assertTrue(bootstrapManager.isSystemReady());
			assertTrue(reset.isResetAttempted());
			verify(publishDao, times(1)).resetProcessingPackages(READY.value, PROCESSING.value);
		}
	}

	/**
	 * Context with the real bootstrap manager and reset listeners, plus a listener standing in for the system
	 * upgrade. It has a parent so the bootstrap manager ignores the context refresh and the test drives the
	 * bootstrap from the {@link StartSystemUpgradeEvent}.
	 */
	private static GenericApplicationContext bootstrapContext(PublishDAO publishDao, List<String> steps) {
		GenericApplicationContext parent = new GenericApplicationContext();
		parent.refresh();
		GenericApplicationContext context = new GenericApplicationContext(parent);
		AnnotationConfigUtils.registerAnnotationConfigProcessors(context);
		context.registerBean(BootstrapManagerImpl.class);
		context.registerBean(ProcessingPackagesReset.class, () -> new ProcessingPackagesReset(publishDao, runningFacade()));
		context.registerBean(SystemUpgradeStub.class, () -> new SystemUpgradeStub(steps));
		context.registerBean(BootstrapFinishedRecorder.class, () -> new BootstrapFinishedRecorder(steps));
		context.refresh();
		return context;
	}

	private static RetryingDatabaseOperationFacade runningFacade() {
		RetryingDatabaseOperationFacade facade = mock(RetryingDatabaseOperationFacade.class);
		doAnswer(invocation -> {
			invocation.getArgument(0, Runnable.class).run();
			return null;
		}).when(facade).retry(any(Runnable.class));
		return facade;
	}

	public static class SystemUpgradeStub {
		private final List<String> steps;

		public SystemUpgradeStub(List<String> steps) {
			this.steps = steps;
		}

		// Same order as StudioUpgradeManagerImpl.startUpgrade
		@Order(10)
		@EventListener(StartSystemUpgradeEvent.class)
		public void startUpgrade() {
			steps.add("system upgrade");
		}
	}

	public static class BootstrapFinishedRecorder {
		private final List<String> steps;

		public BootstrapFinishedRecorder(List<String> steps) {
			this.steps = steps;
		}

		@EventListener(BootstrapFinishedEvent.class)
		public void onBootstrapFinished() {
			steps.add("bootstrap finished");
		}
	}
}
