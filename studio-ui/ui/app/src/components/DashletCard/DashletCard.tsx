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

import React, { PropsWithChildren, useLayoutEffect, useRef, useState } from 'react';
import { CommonDashletProps, parseDashletContentHeight } from '../SiteDashboard/utils';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';
import CardContent, { CardContentProps } from '@mui/material/CardContent';
import Box, { BoxProps } from '@mui/material/Box';
import { UNDEFINED } from '../../utils/constants';
import CardActions from '@mui/material/CardActions';
import OpenInFullOutlinedIcon from '@mui/icons-material/OpenInFullOutlined';
import CloseFullscreenOutlinedIcon from '@mui/icons-material/CloseFullscreenOutlined';
import IconButton from '@mui/material/IconButton';
import useSiteDashboardContext from '../SiteDashboard/useSiteDashboardContext';
import ButtonBase from '@mui/material/ButtonBase';
import { useIntl } from 'react-intl';
import { getFocusRingSx } from '../../styles/focusRing';

export type DashletCardProps = PropsWithChildren<
	CommonDashletProps & {
		title?: React.ReactNode;
		actionsBar?: React.ReactNode;
		actionsBarHeight?: number;
		footerHeight?: number;
		headerAction?: React.ReactNode;
		footer?: React.ReactNode;
		sxs?: Partial<{
			card: BoxProps['sx'];
			content: BoxProps['sx'];
			header: BoxProps['sx'];
			actionsBar: BoxProps['sx'];
			footer: BoxProps['sx'];
		}>;
		cardContentProps?: CardContentProps;
		maximizable?: boolean;
		collapsible?: boolean;
	}
>;

/**
 * Whether a title node gives the toggle a content-based accessible name. Numbers (0 included) render as
 * text. Booleans, null and blank strings render nothing. A host element counts only through its children
 * or its own label. A component element (e.g. FormattedMessage) is assumed to render text here, whatever
 * its children are; this is only the first guess, and DashletCard corrects it from the rendered toggle.
 */
export function nodeHasName(node: React.ReactNode): boolean {
	if (typeof node === 'string') {
		return node.trim() !== '';
	}
	if (typeof node === 'number' || typeof node === 'bigint') {
		return true;
	}
	if (node == null || typeof node === 'boolean') {
		return false;
	}
	if (Array.isArray(node)) {
		return node.some(nodeHasName);
	}
	if (React.isValidElement(node)) {
		const elementProps = (node.props ?? {}) as { children?: React.ReactNode; 'aria-label'?: unknown; alt?: unknown };
		if (typeof elementProps['aria-label'] === 'string' && elementProps['aria-label'].trim() !== '') {
			return true;
		}
		if (typeof elementProps.alt === 'string' && elementProps.alt.trim() !== '') {
			return true;
		}
		// A component decides what it renders and may ignore its children (e.g. <Title>{false}</Title>), so
		// only host elements and fragments are judged by their children.
		if (typeof node.type !== 'string' && node.type !== React.Fragment) {
			return true;
		}
		return nodeHasName(elementProps.children);
	}
	// Iterables, portals and other renderable values: assume they render content.
	return true;
}

/** Content under aria-hidden, hidden or display: none is not part of the name (nor is anything inside it). */
function isRemovedFromName(element: Element): boolean {
	if (element.getAttribute('aria-hidden') === 'true' || element.hasAttribute('hidden')) {
		return true;
	}
	return element.ownerDocument.defaultView?.getComputedStyle(element).display === 'none';
}

/** visibility: hidden/collapse is inherited, but a descendant can set visibility: visible again. */
function isInvisible(element: Element): boolean {
	const visibility = element.ownerDocument.defaultView?.getComputedStyle(element).visibility;
	return visibility === 'hidden' || visibility === 'collapse';
}

/**
 * Whether an element names itself: an image's alt text, an aria-label, or an aria-labelledby reference to
 * an element with text. A referenced label counts even when it is hidden (accname).
 */
function hasOwnLabel(element: Element): boolean {
	if (element.tagName === 'IMG' && (element.getAttribute('alt') ?? '').trim() !== '') {
		return true;
	}
	if ((element.getAttribute('aria-label') ?? '').trim() !== '') {
		return true;
	}
	return (element.getAttribute('aria-labelledby') ?? '')
		.split(/\s+/)
		.filter(Boolean)
		.some((id) => {
			const label = element.ownerDocument.getElementById(id);
			return (
				label !== null &&
				((label.textContent ?? '').trim() !== '' || (label.getAttribute('aria-label') ?? '').trim() !== '')
			);
		});
}

/**
 * Whether the rendered toggle has content that names it: text, an image with alt text, or a labelled
 * descendant. The toggle's own aria-label (the fallback) is not counted. Reads the live tree, since a
 * detached copy has no computed style. Visually hidden (clipped) text still counts: assistive technology
 * exposes it.
 */
function renderedHasName(button: HTMLElement): boolean {
	// visibility is inherited. When the whole toggle is invisible (e.g. inside a minimized, keepMounted dialog),
	// that says nothing about the title, and no mutation inside the toggle would re-check it once the ancestor
	// shows again. Only visibility set inside the toggle counts.
	const toggleInvisible = isInvisible(button);
	const invisible = (element: Element) => !toggleInvisible && isInvisible(element);
	const contentNames = (parent: Element): boolean =>
		Array.from(parent.childNodes).some((child) => {
			if (child.nodeType === 3 /* TEXT_NODE */) {
				return (child.textContent ?? '').trim() !== '' && !invisible(parent);
			}
			if (child.nodeType !== 1 /* ELEMENT_NODE */ || isRemovedFromName(child as Element)) {
				return false;
			}
			const element = child as Element;
			return (hasOwnLabel(element) && !invisible(element)) || contentNames(element);
		});
	return contentNames(button);
}

export function DashletCard(props: DashletCardProps) {
	// region Props
	const {
		sxs,
		children,
		actionsBar,
		title = '',
		borderLeftColor,
		contentHeight: contentHeightProp,
		actionsBarHeight = 35,
		footerHeight = 51,
		headerAction,
		cardContentProps,
		footer,
		maximizable = false,
		collapsible = true
	} = props;
	// endregion
	const cardHeaderHeight = 62;
	const renderCardHeader = nodeHasName(title) || Boolean(headerAction);
	const [isMaximized, setIsMaximized] = useState(false);
	const dashboardState = useSiteDashboardContext();
	const [isExpanded, setIsExpanded] = useState(true);
	const { formatMessage } = useIntl();
	const showCardBody = isExpanded || isMaximized;
	const isToggleable = collapsible && !isMaximized;
	const [disableHeaderToggleRipple, setDisableHeaderToggleRipple] = useState(false);
	// A visible title is the toggle's accessible name (2.5.3). headerAction alone still renders the header,
	// and that toggle would otherwise be an empty button.
	// What a component title renders (null while loading, an empty message) is only known after it renders,
	// so the element-tree guess is just the initial value and the rendered button decides.
	const toggleRef = useRef<HTMLButtonElement>(null);
	const [titleNamesToggle, setTitleNamesToggle] = useState(() => nodeHasName(title));
	// No deps: re-check after every render of the card (title changes included). React bails out on an
	// unchanged value, so this does not loop.
	useLayoutEffect(() => {
		if (toggleRef.current) {
			setTitleNamesToggle(renderedHasName(toggleRef.current));
		}
	});
	// A title component can re-render on its own (e.g. once its data loads) without the card re-rendering.
	useLayoutEffect(() => {
		const button = toggleRef.current;
		if (!button || typeof MutationObserver === 'undefined') {
			return;
		}
		const observer = new MutationObserver(() => setTitleNamesToggle(renderedHasName(button)));
		observer.observe(button, {
			childList: true,
			subtree: true,
			characterData: true,
			attributes: true,
			// class and style can show or hide title content (display / visibility).
			attributeFilter: ['alt', 'aria-label', 'aria-labelledby', 'aria-hidden', 'hidden', 'class', 'style']
		});
		return () => observer.disconnect();
	}, [renderCardHeader, isToggleable]);
	const untitledToggleLabel = formatMessage({ defaultMessage: 'Toggle section' });

	const updateMaximized = () => {
		setIsMaximized(!isMaximized);
		if (isMaximized) {
			dashboardState.onDashletMinimize();
		} else {
			dashboardState.onDashletMaximize();
		}
	};

	const contentHeight = contentHeightProp
		? // Subtract toolbar and footer height to avoid misalignment with other widgets, also, if CardHeader won't be rendered,
			// increase its size
			parseDashletContentHeight(contentHeightProp) -
			(actionsBar ? actionsBarHeight : 0) -
			(footer ? footerHeight : 0) +
			(!renderCardHeader ? cardHeaderHeight : 0)
		: UNDEFINED;

	return (
		<Card
			sx={{
				display: 'flex',
				flexDirection: 'column',
				borderLeft: 5,
				borderLeftColor,
				...sxs?.card,
				...(isMaximized && {
					position: 'absolute',
					zIndex: 5,
					top: 0,
					bottom: 0,
					left: 0,
					right: 0,
					borderRadius: 0
				})
			}}
		>
			{/* region Header */}
			{renderCardHeader && (
				<CardHeader
					title={
						isToggleable ? (
							// The title is the only control in the header. Its ::after stretches over the whole header so a mouse
							// click anywhere toggles the dashlet, while the header actions are siblings (not descendants) of
							// the toggle button, which is what keeps interactive controls from nesting.
							<ButtonBase
								ref={toggleRef}
								type="button"
								disableRipple={disableHeaderToggleRipple}
								aria-expanded={isExpanded}
								aria-label={titleNamesToggle ? undefined : untitledToggleLabel}
								onClick={() => setIsExpanded(!isExpanded)}
								sx={{
									position: 'static',
									font: 'inherit',
									color: 'inherit',
									textAlign: 'start',
									'&::after': { content: '""', position: 'absolute', inset: 0, cursor: 'pointer' },
									'&.Mui-focusVisible': { outline: 'none' },
									'&.Mui-focusVisible::after': getFocusRingSx({ inset: true })
								}}
							>
								{title}
							</ButtonBase>
						) : (
							title
						)
					}
					slotProps={{ title: { variant: 'h6', component: 'h2' } }}
					action={
						<Box
							sx={{ position: 'relative', zIndex: 1 }}
							onMouseOver={() => setDisableHeaderToggleRipple(true)}
							onMouseOut={() => setDisableHeaderToggleRipple(false)}
						>
							{maximizable && (
								<IconButton
									onClick={updateMaximized}
									aria-label={
										isMaximized
											? formatMessage({ defaultMessage: 'Minimize' })
											: formatMessage({ defaultMessage: 'Maximize' })
									}
								>
									{isMaximized ? <CloseFullscreenOutlinedIcon /> : <OpenInFullOutlinedIcon />}
								</IconButton>
							)}
							{headerAction}
						</Box>
					}
					sx={{
						position: 'relative',
						...(isToggleable && { '&:hover': { bgcolor: 'action.hover' } }),
						...sxs?.header
					}}
				/>
			)}
			{/* endregion */}
			{showCardBody && (
				<>
					<Divider />
					{actionsBar && (
						<Box
							sx={{
								display: 'flex',
								position: 'relative',
								borderBottom: '1px solid',
								borderBottomColor: 'divider',
								pr: 1,
								pl: 1,
								...sxs?.actionsBar
							}}
						>
							{actionsBar}
						</Box>
					)}
					{/* region Body */}
					<CardContent
						sx={{
							display: 'flex',
							flexDirection: 'column',
							flexGrow: 1,
							overflow: 'auto',
							height: parseDashletContentHeight(contentHeight),
							pt: 0,
							...sxs?.content
						}}
						{...cardContentProps}
					>
						{children}
					</CardContent>
					{/* endregion */}
					{/* region Actions */}
					{footer && (
						<CardActions
							sx={{
								borderTop: '1px solid',
								borderColor: 'divider',
								paddingTop: '4px',
								paddingBottom: '4px',
								...sxs?.footer
							}}
						>
							{footer}
						</CardActions>
					)}
					{/* endregion */}
				</>
			)}
		</Card>
	);
}

export default DashletCard;
