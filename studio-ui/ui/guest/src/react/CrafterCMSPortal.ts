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

import { createPortal } from 'react-dom';
import React, { PropsWithChildren, useLayoutEffect, useRef } from 'react';

export type CrafterCMSPortalProps = PropsWithChildren<{}>;

export function CrafterCMSPortal(props: CrafterCMSPortalProps) {
	const portalRef = useRef<HTMLElement>(null);
	if (portalRef.current === null) {
		portalRef.current = document.createElement('craftercms-portal');
	}

	useLayoutEffect(() => {
		const body: HTMLElement = document.body;
		const portal = portalRef.current;
		body.appendChild(portal);
		return () => {
			body.removeChild(portal);
		};
	}, []);

	return createPortal(props.children, portalRef.current) as React.JSX.Element;
}

export default CrafterCMSPortal;
