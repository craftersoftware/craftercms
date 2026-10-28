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

import React, { useEffect } from 'react';
import Button from '@mui/material/Button';
import { useIntl } from 'react-intl';

export const SKIP_TO_ACTIONS_SHORTCUT = 'Alt+Shift+S';

/**
 * First-in-tab-order control that moves focus to a dialog's action group.
 * Hidden until focused. Alt+Shift+S does the same from anywhere inside `scopeRef`
 * (or the document, when no scope is given) so Save/Publish/Delete are not 30+ tabs away.
 * The accessible name states the shortcut.
 */
export function SkipToActionsLink({
	targetId,
	scopeRef
}: {
	targetId: string;
	scopeRef?: React.RefObject<HTMLElement | null | undefined>;
}) {
	const { formatMessage } = useIntl();
	const label = formatMessage({ defaultMessage: 'Skip to actions (Alt+Shift+S)' });

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) return;
			// event.code is layout-independent. On macOS, Option+Shift+S sets event.key to "Í".
			const keyIsS = event.code === 'KeyS' || event.key.toLowerCase() === 's';
			if (!keyIsS) return;
			const target = document.getElementById(targetId);
			if (!(target instanceof HTMLElement)) return;
			const eventTarget = event.target;
			if (!(eventTarget instanceof Node)) return;
			const scope = scopeRef?.current;
			if (scope) {
				if (!scope.contains(eventTarget)) return;
			} else {
				// Without an explicit scope, only handle the shortcut inside the same dialog as the
				// action target so a background form does not steal it from a dialog on top.
				const owner = target.closest('[role="dialog"], [role="alertdialog"]');
				if (owner) {
					if (!owner.contains(eventTarget)) return;
				} else if (eventTarget instanceof Element && eventTarget.closest('[role="dialog"], [role="alertdialog"]')) {
					return;
				}
			}
			event.preventDefault();
			target.focus();
		};
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, [scopeRef, targetId]);

	return (
		<Button
			type="button"
			disableRipple
			onClick={() => {
				const target = document.getElementById(targetId);
				if (target instanceof HTMLElement) target.focus();
			}}
			sx={{
				position: 'absolute',
				top: 8,
				left: 8,
				zIndex: 2,
				width: '1px',
				height: '1px',
				padding: 0,
				margin: 0,
				overflow: 'hidden',
				clip: 'rect(0, 0, 0, 0)',
				whiteSpace: 'nowrap',
				border: 0,
				// Stay absolutely positioned when focused so the header does not shift.
				'&:focus, &:focus-visible': {
					width: 'auto',
					height: 'auto',
					padding: '6px 12px',
					overflow: 'visible',
					clip: 'auto',
					whiteSpace: 'normal',
					backgroundColor: 'background.paper',
					color: 'primary.main',
					outline: '2px solid',
					outlineColor: 'primary.main',
					outlineOffset: '2px'
				}
			}}
		>
			{label}
		</Button>
	);
}

export default SkipToActionsLink;
