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

import Typography from '@mui/material/Typography';

export interface SidebarFooterHtmlProps {
	/** Entitlement description HTML. A sentence with links in it, not a list of standalone links. */
	html: string;
}

/**
 * The caption under the logo in the global sidebar and in project tools. Both render the same
 * description, so the link treatment lives here.
 */
export function SidebarFooterHtml(props: SidebarFooterHtmlProps) {
	const { html } = props;
	return (
		<Typography
			component="p"
			variant="caption"
			sx={(theme) => ({
				color: theme.palette.text.secondary,
				// Colour alone does not tell a link apart from the sentence around it (1.4.1), so keep the underline.
				'& > a': {
					color: theme.palette.primary.main,
					textDecoration: 'underline'
				}
			})}
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}
