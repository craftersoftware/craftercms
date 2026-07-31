/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

import React, {
	forwardRef,
	PropsWithChildren,
	ReactNode,
	type RefCallback,
	RefObject,
	useCallback,
	useContext,
	useImperativeHandle,
	useLayoutEffect
} from 'react';
import { useTheme } from '@mui/material/styles';
import { FormsEngineAtoms, ItemMetaContext, StableFormContext, StableGlobalContext } from '../lib/formsEngineContext';
import Box, { BoxProps } from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import { useAtomValue, useStore as useJotaiStore } from 'jotai/index';
import { UIBlocker } from '../../UIBlocker';
import { getScrollContainer } from '../lib/formUtils';
import { stackFormCountAtom } from '../lib/formConsts';
import { createStore } from 'jotai';
import { getMarginSxProps } from '../../../utils/ui';
import { useResizeObserver } from '../../../hooks/useResizeObserver';

export type FormLayoutProps = PropsWithChildren<{
	targetHeight: string;
	mainContentGrid: ReactNode;
	headerFragment: ReactNode;
	containerRef: RefObject<HTMLDivElement>;
	sentinelRef: RefObject<HTMLDivElement>;
	mainContentRefCallback: RefCallback<HTMLDivElement>;
	hasStackedForms: boolean;
	stackIndex: number;
	style?: BoxProps['style'];
}>;

function collectSectionExpandedState(
	store: ReturnType<typeof createStore>,
	atomLookup: FormsEngineAtoms['expandedStateBySectionId']
): Record<string, boolean> {
	return Object.entries(atomLookup).reduce((acc, [section, atom]) => {
		acc[section] = store.get(atom);
		return acc;
	}, {});
}

export const FormLayout = forwardRef<HTMLDivElement, FormLayoutProps>(function (props, ref) {
	const {
		children,
		mainContentGrid,
		targetHeight,
		containerRef,
		mainContentRefCallback,
		sentinelRef,
		headerFragment,
		hasStackedForms,
		stackIndex,
		style
	} = props;
	const theme = useTheme();
	const store = useJotaiStore();
	const { api: contextApi } = useContext(StableGlobalContext);
	const { state: stateCache, atoms } = useContext(StableFormContext);
	const { id } = useContext(ItemMetaContext);
	const isLargeContainerAtom = atoms.isLargeContainer;
	const isLargeContainer = useAtomValue(isLargeContainerAtom);

	useImperativeHandle(ref, () => containerRef.current);

	// Restore previous scroll position if provided.
	const collapsedToCAtom = atoms.collapseToC;
	const previousScrollTopPosition = stateCache?.previousScrollTopPosition;
	useLayoutEffect(() => {
		// Only a single stacked form is rendered at a time, so the scroll position of stacked forms is stored before opening a new one for later restoration here.
		if (containerRef.current != null && previousScrollTopPosition != null) {
			// Restore the previous scroll position
			const container: HTMLElement = getScrollContainer(containerRef.current);
			container.scrollTop = previousScrollTopPosition;
		}
		// TODO: Once mounted back, clean the state cache. Assumes everything should have grabbed the cached values by now.
		//   contextApi.deleteStateCache(stackIndex);
		return () => {
			// Getting the count directly from the store provides the latest value. React may not have been updated `stackFormCount` yet.
			const currentCount = store.get(stackFormCountAtom);
			// If the count is greater than the stackIndex, a new form is being opened, so store the scroll position before dismounting.
			if (currentCount > stackIndex) {
				contextApi.setStateCache(stackIndex, {
					collapsedToC: store.get(collapsedToCAtom),
					previousScrollTopPosition: getScrollContainer(containerRef.current).scrollTop,
					sectionExpandedState: collectSectionExpandedState(store, atoms.expandedStateBySectionId)
				});
			}
		};
	}, [
		containerRef,
		previousScrollTopPosition,
		contextApi,
		stackIndex,
		store,
		collapsedToCAtom,
		atoms.expandedStateBySectionId
	]);

	// Freeze/manage scroll when stacked forms are open, and set the --scroll-top css property for stacked
	// forms to position themselves at the right position.
	useLayoutEffect(() => {
		if (hasStackedForms) {
			const scrollContainer = getScrollContainer(containerRef.current);
			// Store the current scroll position to restore
			const scrollTop = scrollContainer.scrollTop;
			const scrollLeft = scrollContainer.scrollLeft;
			// Disable scrolling
			scrollContainer.style.overflow = 'hidden';
			// Restore the scroll position
			scrollContainer.scrollTop = scrollTop;
			scrollContainer.scrollLeft = scrollLeft;
			scrollContainer.style.setProperty('--scroll-top', `${scrollTop}px`);
			return () => {
				scrollContainer.style.overflow = '';
			};
		}
	}, [containerRef, hasStackedForms]);

	const measureContainer = useCallback(() => {
		const container = containerRef.current;
		if (!container) return;
		const rect: DOMRect = container.getBoundingClientRect();
		const width = rect.width;
		container.style.setProperty('--container-width', `${width}px`);
		container.style.setProperty('--container-height', `${rect.height}px`);
		store.set(isLargeContainerAtom, width >= theme.breakpoints.values.lg);
	}, [containerRef, isLargeContainerAtom, store, theme.breakpoints.values.lg]);

	// The form may swap in a brand new set of atoms without remounting (e.g. reloading after saving an amend, or
	// after a rename). The resize observer won't fire for a container that hasn't changed size, so the new
	// `isLargeContainer` atom would keep its default and the table of contents would render collapsed.
	useLayoutEffect(() => {
		measureContainer();
	}, [measureContainer]);

	// Resize observer attached to the [scroll] container
	useResizeObserver(containerRef, measureContainer);

	return (
		<Box
			ref={containerRef}
			style={style}
			data-model-id={id}
			data-area-id="formContainer"
			sx={{
				display: 'flex',
				height: targetHeight,
				flexDirection: 'column',
				position: 'relative',
				overflow: 'auto',
				...getMarginSxProps()
			}}
		>
			<UIBlockerOverlay />
			<Paper component="header" data-area-id="formHeader" elevation={0} square>
				{headerFragment}
				<Divider />
			</Paper>
			<Box
				ref={mainContentRefCallback}
				sx={{
					// TODO: Tabs will be done at a later phase.
					// display: activeTab === 0 ? 'inherit' : 'none',
					position: 'relative',
					height: '100%',
					px: 0,
					pt: 2,
					backgroundColor: theme.palette.background.default,
					overflow: 'auto'
				}}
			>
				<div
					ref={sentinelRef}
					style={{
						position: 'absolute',
						top: '60px',
						height: '1px',
						width: '1px',
						pointerEvents: 'none',
						visibility: 'hidden'
					}}
				/>
				<Container maxWidth={isLargeContainer ? 'xl' : undefined}>
					<Grid container spacing={2}>
						{mainContentGrid}
					</Grid>
				</Container>
			</Box>
			{/*
      TODO: Tabs differed to a later stage. Should tabs be pluggable & configurable?
      {activeTab === 1 && (
        <IFrame
          url={useEnv().guestBase}
          title="Preview"
          sx={{ display: 'flex', flex: '1' }}
          styles={{ iframe: { height: null } }}
        />
      )}
      */}
			{children}
		</Box>
	);
});

function UIBlockerOverlay() {
	const stableFormContext = useContext(StableFormContext);
	const isSubmitting = useAtomValue(stableFormContext.atoms.isSubmitting);
	return <UIBlocker open={isSubmitting} />;
}

export default FormLayout;
