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

import { PublishingStatus, PublishingStatusCodes } from '../../models/Publishing';
import { defineMessages, IntlShape, type MessageValue } from 'react-intl';
import { nnou, nou } from '../../utils/object';

export const publishingStatusMessages = {
	...defineMessages({
		ready: {
			id: 'words.ready',
			defaultMessage: 'Ready'
		},
		processing: {
			id: 'words.processing',
			defaultMessage: 'Processing'
		},
		publishing: {
			id: 'words.publishing',
			defaultMessage: 'Publishing'
		},
		queued: {
			id: 'words.queued',
			defaultMessage: 'Queued'
		},
		stopped: {
			id: 'words.stopped',
			defaultMessage: 'Stopped'
		},
		error: {
			id: 'words.error',
			defaultMessage: 'Error'
		},
		readyWithErrors: { defaultMessage: 'Ready' },
		disabled: {
			id: 'words.disabled',
			defaultMessage: 'Disabled'
		},
		unknown: {
			id: 'words.unknown',
			defaultMessage: 'Unknown'
		},
		stoppedMessage: {
			id: 'publishingStatusMessages.stoppedMessage',
			defaultMessage: 'The publisher was stopped by an administrator.'
		},
		errorMessage: {
			id: 'publishingStatusMessages.errorMessage',
			defaultMessage: 'The publisher was stopped due to an error.'
		},
		refresh: {
			id: 'words.refresh',
			defaultMessage: 'Refresh'
		},
		unlock: {
			id: 'words.unlock',
			defaultMessage: 'Unlock'
		},
		start: {
			id: 'words.start',
			defaultMessage: 'Start'
		},
		stop: {
			id: 'words.stop',
			defaultMessage: 'Stop'
		},
		publishingStatus: {
			id: 'publishingStatusMessages.publishingStatus',
			defaultMessage: 'Publishing Status'
		},
		disabledMessage: {
			id: 'publishingStatusMessages.isDisabledMessage',
			defaultMessage: 'The publisher is disabled.'
		},
		yes: {
			id: 'words.yes',
			defaultMessage: 'Yes'
		},
		no: {
			id: 'words.no',
			defaultMessage: 'No'
		},
		confirmUnlockPublisher: {
			id: 'publishingStatusMessages.confirmUnlockPublisher',
			defaultMessage: 'Confirm you wish to unlock the publisher?'
		}
	}),
	...defineMessages<{
		publishingMessage: { readonly submissionId: MessageValue };
		lockOwner: { readonly lockOwner: MessageValue };
		lockTTL: { readonly lockTTL: MessageValue };
	}>({
		publishingMessage: {
			id: 'publishingStatusMessages.publishingMessage',
			defaultMessage: 'Publishing items. Package id is {submissionId}.'
		},
		lockOwner: {
			id: 'publishingStatusMessages.lockOwnerDisplayMessage',
			defaultMessage: 'Locked by {lockOwner}'
		},
		lockTTL: {
			id: 'publishingStatusMessages.lockTTLMessage',
			defaultMessage: 'TTL {lockTTL}'
		}
	})
};

export function getPublishingStatusState(status: PublishingStatus): string {
	let publishingStatusState: string;
	if (nnou(status.currentTask)) {
		publishingStatusState = 'publishing';
	} else if (status.enabled) {
		publishingStatusState = 'ready';
	} else if (!status.enabled) {
		publishingStatusState = 'stopped';
	}
	return publishingStatusState;
}

export function getPublishingStatusText(status: PublishingStatus, formatMessage: IntlShape['formatMessage']): string {
	if (!status.enabled) {
		return formatMessage(publishingStatusMessages.disabled);
	}
	const publishingStatusState = getPublishingStatusState(status);
	return formatMessage(publishingStatusMessages[publishingStatusState] ?? publishingStatusMessages.unknown);
}

export function getPublishingStatusMessage(props: PublishingStatus, formatMessage: IntlShape['formatMessage']): string {
	if (nou(props.enabled)) {
		return formatMessage({ defaultMessage: 'The publisher status details did not load correctly.' });
	}

	const publishingStatusState = getPublishingStatusState(props);
	switch (publishingStatusState) {
		case 'ready':
			return formatMessage(publishingStatusMessages.ready);
		case 'publishing':
			return formatMessage(publishingStatusMessages.publishingMessage, {
				submissionId: props.currentTask?.taskId?.packageId ?? 12
			});
		case 'stopped':
			return formatMessage(publishingStatusMessages.stoppedMessage);
		default:
			return formatMessage(publishingStatusMessages.stoppedMessage);
	}
	// region Compiler hints
	// Var below is for typescript to complain if we ever add/remove codes.
	// eslint-disable-next-line no-unreachable,@typescript-eslint/no-unused-vars
	const control: Record<PublishingStatusCodes, any> = {
		publishing: undefined,
		ready: undefined,
		stopped: undefined
	};
	// endregion
}
