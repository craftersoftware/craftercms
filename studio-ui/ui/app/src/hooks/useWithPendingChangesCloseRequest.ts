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

import { useDispatch } from 'react-redux';
import { useIntl } from 'react-intl';
import translations from '../components/CodeEditorDialog/translations';
import { EnhancedDialogProps as DialogProps } from '../components/EnhancedDialog';
import { popDialog } from '../state/actions/dialogStack';
import { nanoid } from 'nanoid';
import { pushConfirmDialog } from '../utils/system';

export function useWithPendingChangesCloseRequest(onClose: DialogProps['onClose']): DialogProps['onClose'] {
	const dispatch = useDispatch();
	const { formatMessage } = useIntl();
	return (e, reason) => {
		const dialogId = nanoid();
		dispatch(
			pushConfirmDialog({
				id: dialogId,
				props: {
					title: formatMessage(translations.pendingChanges),
					onOk: () => {
						dispatch(popDialog({ id: dialogId }));
						onClose(e, reason);
					},
					onCancel: () => dispatch(popDialog({ id: dialogId }))
				}
			})
		);
	};
}

export default useWithPendingChangesCloseRequest;
