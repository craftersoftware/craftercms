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

import * as React from 'react';
import { ReactNode, useId, useMemo, useRef } from 'react';
import { useOnClose } from '../../hooks/useOnClose';
import MuiDialog, { DialogProps as MuiDialogProps } from '@mui/material/Dialog';
import { useUnmount } from '../../hooks/useUnmount';
import DialogHeader, { DialogHeaderProps } from '../DialogHeader';
import MinimizedBar from '../MinimizedBar';
import { EnhancedDialogState, onSubmittingAndOrPendingChangeProps } from '../../hooks/useEnhancedDialogState';
import { EnhancedDialogContext, EnhancedDialogContextProps } from './useEnhancedDialogContext';
import Suspencified from '../Suspencified';
import useUpdateRefs from '../../hooks/useUpdateRefs';

export interface EnhancedDialogProps extends Omit<MuiDialogProps, 'title'>, EnhancedDialogState {
	title?: ReactNode;
	subtitle?: ReactNode;
	onMinimize?(): void;
	onMaximize?(): void;
	onClosed?(): void;
	onFullScreen?(): void;
	onCancelFullScreen?(): void;
	onWithPendingChangesCloseRequest?: MuiDialogProps['onClose'];
	updateSubmittingOrHasPendingChanges?(changes: onSubmittingAndOrPendingChangeProps): void;
	omitHeader?: boolean;
	dialogHeaderProps?: Partial<DialogHeaderProps>;
}

type PaperSlotProps = NonNullable<NonNullable<MuiDialogProps['slotProps']>['paper']>;
type DialogLabellingProps = Pick<MuiDialogProps, 'aria-label' | 'aria-labelledby'>;

/**
 * Adds the dialog's labelling props to the caller's paper slot. The caller's own props win, so a slot that
 * already names the dialog keeps its name. A function slot is resolved first, so its label is seen too.
 */
function withPaperProps(
	paper: PaperSlotProps,
	getProps: (resolvedPaper?: DialogLabellingProps) => DialogLabellingProps
): PaperSlotProps {
	if (typeof paper === 'function') {
		return (ownerState) => {
			const resolved = paper(ownerState);
			return { ...getProps(resolved), ...resolved };
		};
	}
	return { ...getProps(paper), ...paper };
}

export function EnhancedDialog(props: EnhancedDialogProps) {
	// region const { ... } = props
	const {
		open,
		isSubmitting = false,
		hasPendingChanges = false,
		isMinimized = false,
		isFullScreen = false,
		title,
		subtitle,
		onClosed,
		onMinimize,
		onMaximize,
		onWithPendingChangesCloseRequest,
		updateSubmittingOrHasPendingChanges,
		children,
		dialogHeaderProps,
		omitHeader = false,
		'aria-label': ariaLabel,
		'aria-labelledby': ariaLabelledBy,
		slotProps,
		onFullScreen,
		onCancelFullScreen,
		...dialogProps
	} = props;
	// endregion
	const id = useId();
	const titleId = dialogHeaderProps?.titleId ?? dialogHeaderProps?.titleTypographyProps?.id ?? `${id}-title`;
	const headerTitle = title ?? dialogHeaderProps?.title;
	// Naming the dialog by its title only works while the title element holds text, so a dialog whose header
	// is omitted or has no title is left unnamed instead of pointing at an element that is not rendered.
	const hasTitle = headerTitle != null && typeof headerTitle !== 'boolean' && headerTitle !== '';
	const canUseTitle = !omitHeader && hasTitle;
	// MUI puts a top-level aria-label on the root instead of the element with the role, so a caller's name is
	// read from either place and lands on the paper, next to aria-labelledby.
	const getLabelling = (paper?: DialogLabellingProps) => {
		const callerLabel = ariaLabel || paper?.['aria-label'];
		const callerLabelledBy = ariaLabelledBy || paper?.['aria-labelledby'];
		const labelledBy = callerLabelledBy ?? (callerLabel || !canUseTitle ? undefined : titleId);
		return { callerLabel, labelledBy };
	};
	const staticPaper = typeof slotProps?.paper === 'function' ? undefined : slotProps?.paper;
	const dialogLabelledBy = getLabelling(staticPaper).labelledBy;
	const getPaperOverrides = (paper?: DialogLabellingProps) => {
		const { callerLabel, labelledBy } = getLabelling(paper);
		const overrides: DialogLabellingProps = {};
		// MUI also points the paper at an id it generates for its own DialogTitle, which this dialog never renders.
		if (!labelledBy) overrides['aria-labelledby'] = undefined;
		if (callerLabel) overrides['aria-label'] = callerLabel;
		return overrides;
	};
	const resolvedSlotProps: MuiDialogProps['slotProps'] =
		typeof slotProps?.paper === 'function' || Object.keys(getPaperOverrides(staticPaper)).length
			? { ...slotProps, paper: withPaperProps(slotProps?.paper, getPaperOverrides) }
			: slotProps;
	const onClose = useOnClose({
		onClose(e, reason) {
			if (hasPendingChanges) {
				onWithPendingChangesCloseRequest?.(e, reason);
			} else if (!isSubmitting) {
				dialogProps.onClose?.(e, reason);
			}
		},
		disableBackdropClick: isSubmitting,
		disableEscapeKeyDown: isSubmitting
	});
	const callbackRefs = useUpdateRefs({ onClose, updateSubmittingOrHasPendingChanges });
	const stableRefs = useRef({
		// When context is recreated, `stableRefs` remain stable and won't trigger
		// effects or have closure issues on the consumer components.
		onClose(e, reason) {
			callbackRefs.current.onClose?.(e, reason);
		},
		updateSubmittingOrHasPendingChanges(changes: onSubmittingAndOrPendingChangeProps) {
			callbackRefs.current.updateSubmittingOrHasPendingChanges?.(changes);
		}
	});
	const context = useMemo<EnhancedDialogContextProps>(
		() => ({
			open,
			isMinimized,
			isFullScreen,
			isSubmitting,
			hasPendingChanges,
			onClose: stableRefs.current.onClose,
			updateSubmittingOrHasPendingChanges: stableRefs.current.updateSubmittingOrHasPendingChanges
		}),
		[hasPendingChanges, isFullScreen, isMinimized, isSubmitting, open]
	);
	return (
		<EnhancedDialogContext.Provider value={context}>
			<MuiDialog
				open={open && !isMinimized}
				keepMounted={isMinimized}
				fullWidth
				maxWidth="md"
				fullScreen={isFullScreen}
				{...dialogProps}
				aria-labelledby={dialogLabelledBy}
				slotProps={resolvedSlotProps}
				onClose={onClose}
			>
				{!omitHeader && (
					<DialogHeader
						{...dialogHeaderProps}
						titleId={titleId}
						title={headerTitle}
						subtitle={subtitle ?? dialogHeaderProps?.subtitle}
						disabled={isSubmitting}
						onMinimizeButtonClick={onMinimize}
						onFullScreenButtonClick={isFullScreen ? onCancelFullScreen : onFullScreen}
						onCloseButtonClick={(e) => onClose(e, null)}
					/>
				)}
				<Suspencified>
					{React.Children.map(children, (child) =>
						React.cloneElement(
							child as React.ReactElement<{ onClose(event, reason: 'backdropClick' | 'escapeKeyDown'): void }>,
							{ onClose }
						)
					)}
				</Suspencified>
				<OnClosedInvoker onClosed={onClosed} />
			</MuiDialog>
			<MinimizedBar open={isMinimized} onMaximize={onMaximize} title={title} />
		</EnhancedDialogContext.Provider>
	);
}

export default EnhancedDialog;

function OnClosedInvoker({ onClosed }: { onClosed }): React.JSX.Element | null {
	useUnmount(onClosed);
	return null;
}
