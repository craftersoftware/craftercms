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

package org.craftercms.studio.api.v2.dal;

public enum ItemState {

	NEW(0),
	MODIFIED(1),
	DELETED(2),
	USER_LOCKED(3),
	SYSTEM_PROCESSING(4),
	IN_WORKFLOW(5),
	SCHEDULED(6),
	PUBLISHING(7),
	DESTINATION(8),
	STAGED(9),
	LIVE(10),
	DISABLED(11),
	RESERVED_12(12),
	RESERVED_11(13),
	RESERVED_10(14),
	RESERVED_9(15),
	RESERVED_8(16),
	RESERVED_7(17),
	RESERVED_6(18),
	RESERVED_5(19),
	RESERVED_4(20),
	RESERVED_3(21),
	RESERVED_2(22),
	RESERVED_1(23),
	TRANSLATION_UP_TO_DATE(24),
	TRANSLATION_PENDING(25),
	TRANSLATION_IN_PROGRESS(26);

	public final long value;

	ItemState(long exponent) {
		this.value = Math.round(Math.pow(2, exponent));
	}

	// Masks
	public static final long CANCEL_WORKFLOW_ON_MASK = MODIFIED.value;
	public static final long CANCEL_WORKFLOW_OFF_MASK =
		SYSTEM_PROCESSING.value + IN_WORKFLOW.value + SCHEDULED.value + USER_LOCKED.value + DESTINATION.value;

	public static final long SAVE_ON_MASK = MODIFIED.value;
	public static final long SAVE_OFF_MASK = SYSTEM_PROCESSING.value + IN_WORKFLOW.value + SCHEDULED.value +
		DESTINATION.value;

	public static final long SYNC_FROM_REPOSITORY_OFF_MASK = SAVE_OFF_MASK + USER_LOCKED.value;

	public static final long CANCEL_PUBLISH_PACKAGE_ON_MASK = MODIFIED.value;
	public static final long CANCEL_PUBLISH_PACKAGE_OFF_MASK = IN_WORKFLOW.value +
		SCHEDULED.value + DESTINATION.value;

	public static final long SUBMIT_TO_WORKFLOW_ON_MASK = IN_WORKFLOW.value;
	public static final long SUBMIT_TO_WORKFLOW_OFF_MASK =
		USER_LOCKED.value + SYSTEM_PROCESSING.value + SCHEDULED.value + DESTINATION.value;
	public static final long SUBMIT_TO_WORKFLOW_LIVE_ON_MASK = IN_WORKFLOW.value + DESTINATION.value;
	public static final long SUBMIT_TO_WORKFLOW_LIVE_OFF_MASK =
		USER_LOCKED.value + SYSTEM_PROCESSING.value + SCHEDULED.value;

	public static final long SUBMIT_TO_WORKFLOW_SCHEDULED_ON_MASK = IN_WORKFLOW.value + SCHEDULED.value;
	public static final long SUBMIT_TO_WORKFLOW_SCHEDULED_OFF_MASK =
		USER_LOCKED.value + SYSTEM_PROCESSING.value + DESTINATION.value;
	public static final long SUBMIT_TO_WORKFLOW_SCHEDULED_LIVE_ON_MASK =
		IN_WORKFLOW.value + SCHEDULED.value + DESTINATION.value;
	public static final long SUBMIT_TO_WORKFLOW_SCHEDULED_LIVE_OFF_MASK =
		USER_LOCKED.value + SYSTEM_PROCESSING.value;

	public static final long REJECT_ON_MASK = 0L;
	public static final long REJECT_OFF_MASK =
		USER_LOCKED.value + SYSTEM_PROCESSING.value + IN_WORKFLOW.value + SCHEDULED.value;

	public static final long DELETE_ON_MASK = DELETED.value;
	public static final long DELETE_OFF_MASK =
		NEW.value + MODIFIED.value + USER_LOCKED.value + SYSTEM_PROCESSING.value + IN_WORKFLOW.value +
			SCHEDULED.value + STAGED.value + LIVE.value + TRANSLATION_UP_TO_DATE.value + TRANSLATION_PENDING.value +
			TRANSLATION_IN_PROGRESS.value;

	public static final long PUBLISH_TO_STAGE_ON_MASK = STAGED.value;
	public static final long PUBLISH_TO_STAGE_OFF_MASK =
		USER_LOCKED.value + SYSTEM_PROCESSING.value + IN_WORKFLOW.value + SCHEDULED.value;

	public static final long PUBLISH_TO_LIVE_ON_MASK = LIVE.value;
	public static final long PUBLISH_TO_LIVE_OFF_MASK =
		NEW.value + MODIFIED.value + USER_LOCKED.value + SYSTEM_PROCESSING.value + IN_WORKFLOW.value + SCHEDULED.value;

	public static final long PUBLISH_TO_STAGE_AND_LIVE_ON_MASK = STAGED.value + LIVE.value;
	public static final long PUBLISH_TO_STAGE_AND_LIVE_OFF_MASK =
		NEW.value + MODIFIED.value + USER_LOCKED.value + SYSTEM_PROCESSING.value + IN_WORKFLOW.value + SCHEDULED.value;

	public static final long NEW_MASK = NEW.value;
	public static final long MODIFIED_MASK = MODIFIED.value;
	public static final long SUBMITTED_MASK = IN_WORKFLOW.value;
	public static final long IN_PROGRESS_MASK = NEW.value + MODIFIED.value + IN_WORKFLOW.value;
	public static final long UNPUBLISHED_MASK = NEW.value + MODIFIED.value;

	private static long applyMask(long value, long onBits, long offBits) {
		return (value | onBits) & ~offBits;
	}

	public static long deleted() {
		return applyMask(0L, DELETED.value, NEW.value + MODIFIED.value + USER_LOCKED.value +
			SYSTEM_PROCESSING.value + IN_WORKFLOW.value + SCHEDULED.value + STAGED.value + LIVE.value +
			TRANSLATION_UP_TO_DATE.value + TRANSLATION_PENDING.value + TRANSLATION_IN_PROGRESS.value);
	}

	public static long publishedToStaged(long currentState) {
		return applyMask(currentState, STAGED.value,
			USER_LOCKED.value + SYSTEM_PROCESSING.value + IN_WORKFLOW.value + SCHEDULED.value);
	}

	public static long publishedToLive(long currentState) {
		return applyMask(currentState, LIVE.value,
			NEW.value + USER_LOCKED.value + SYSTEM_PROCESSING.value + IN_WORKFLOW.value + SCHEDULED.value);
	}

	public static long publishedToStagedAndLive(long currentState) {
		return applyMask(currentState, STAGED.value + LIVE.value,
			NEW.value + USER_LOCKED.value + SYSTEM_PROCESSING.value + IN_WORKFLOW.value + SCHEDULED.value);
	}

	public static long savedAndClosed(long currentState) {
		return applyMask(currentState, SAVE_ON_MASK, SAVE_OFF_MASK);
	}

	public static long savedAndNotClosed(long currentState) {
		return applyMask(currentState, MODIFIED.value,
			SYSTEM_PROCESSING.value + IN_WORKFLOW.value + SCHEDULED.value + STAGED.value + LIVE.value);
	}

	public static long canceledWorkflow(long currentState) {
		return applyMask(currentState, CANCEL_WORKFLOW_ON_MASK, CANCEL_WORKFLOW_OFF_MASK);
	}

	public static boolean isNew(long currentState) {
		return (currentState & NEW.value) > 0;
	}

	public static boolean isModified(long currentState) {
		return (currentState & MODIFIED.value) > 0;
	}

	public static boolean isDeleted(long currentState) {
		return (currentState & DELETED.value) > 0;
	}

	public static boolean isUserLocked(long currentState) {
		return (currentState & USER_LOCKED.value) > 0;
	}

	public static boolean isSystemProcessing(long currentState) {
		return (currentState & SYSTEM_PROCESSING.value) > 0;
	}

	public static boolean isInWorkflow(long currentState) {
		return (currentState & IN_WORKFLOW.value) > 0;
	}

	public static boolean isScheduled(long currentState) {
		return (currentState & SCHEDULED.value) > 0;
	}

	public static boolean isPublishing(long currentState) {
		return (currentState & PUBLISHING.value) > 0;
	}

	public static boolean isStaged(long currentState) {
		return (currentState & STAGED.value) > 0;
	}

	public static boolean isLive(long currentState) {
		return (currentState & LIVE.value) > 0;
	}

	public static boolean isInWorkflowOrScheduled(long currentState) {
		return (currentState & (IN_WORKFLOW.value + SCHEDULED.value)) > 0;
	}

	public static boolean isTranslationUpToDate(long currentState) {
		return (currentState & TRANSLATION_UP_TO_DATE.value) > 0;
	}

	public static boolean isTranslationPending(long currentState) {
		return (currentState & TRANSLATION_PENDING.value) > 0;
	}

	public static boolean isTranslationInProgress(long currentState) {
		return (currentState & TRANSLATION_IN_PROGRESS.value) > 0;
	}
}
