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

import React, {
	ElementType,
	Fragment,
	lazy,
	PropsWithChildren,
	ReactNode,
	Suspense,
	useLayoutEffect,
	useState
} from 'react';
import { ThemeOptions } from '@mui/material/styles';
import { setRequestForgeryToken } from '../../utils/auth';
import { CrafterCMSStore, getStore } from '../../state/store';
import { SnackbarProvider, SnackbarProviderProps } from 'notistack';
import I18nProvider from '../I18nProvider';
import StoreProvider from '../StoreProvider';
import CrafterThemeProvider from '../CrafterThemeProvider';
import SnackbarCloseButton from '../SnackbarCloseButton';
import { publishCrafterGlobal } from '../../env/craftercms';
import { registerComponents } from '../../env/registerComponents';
import LoadingState from '../LoadingState';
import GlobalStyles from '../GlobalStyles';
import ErrorState from '../ErrorState/ErrorState';
import NotistackVariant from '../NotistackVariant';
import useSnackbarDuration from '../../hooks/useSnackbarDuration';
const LegacyConcierge = lazy(() => import('../LegacyConcierge/LegacyConcierge'));
const GlobalDialogManager = lazy(() => import('../GlobalDialogManager/GlobalDialogManager'));

export function CrafterCMSNextBridge(
	props: PropsWithChildren<{
		mountGlobalDialogManager?: boolean;
		mountSnackbarProvider?: boolean;
		mountLegacyConcierge?: boolean;
		mountCssBaseline?: boolean;
		suspenseFallback?: ReactNode;
		themeOptions?: ThemeOptions;
	}>
) {
	const [store, setStore] = useState<CrafterCMSStore>(null);
	const [storeError, setStoreError] = useState<string>();
	const autoHideDuration = useSnackbarDuration();
	const {
		children,
		themeOptions,
		suspenseFallback = '',
		mountCssBaseline = true,
		mountGlobalDialogManager = true,
		mountSnackbarProvider = true,
		mountLegacyConcierge = false
	} = props;
	const SnackbarOrFragment: ElementType = mountSnackbarProvider ? SnackbarProvider : Fragment;
	const snackbarOrFragmentProps = mountSnackbarProvider
		? ({
				maxSnack: 5,
				autoHideDuration: autoHideDuration,
				anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
				action: (id) => <SnackbarCloseButton id={id} />,
				Components: {
					error: NotistackVariant,
					success: NotistackVariant,
					warning: NotistackVariant,
					info: NotistackVariant
				}
			} as SnackbarProviderProps)
		: {};
	useLayoutEffect(() => {
		registerComponents();
		publishCrafterGlobal();
		setRequestForgeryToken();
		getStore().subscribe({
			next: (store) => setStore(store),
			error: ({ message }) => setStoreError(message)
		});
	}, []);

	return (
		<CrafterThemeProvider themeOptions={themeOptions}>
			<I18nProvider>
				<SnackbarOrFragment {...snackbarOrFragmentProps}>
					{storeError ? (
						<ErrorState
							title={storeError}
							imageUrl="/studio/static-assets/images/warning_state.svg"
							sxs={{ title: { textAlign: 'center' }, image: { width: 250, marginBottom: '10px', marginTop: '10px' } }}
						/>
					) : store ? (
						<StoreProvider store={store}>
							<Suspense fallback={suspenseFallback} children={children} />
							{mountGlobalDialogManager && (
								<Suspense fallback="">
									<GlobalDialogManager />
								</Suspense>
							)}
							{mountLegacyConcierge && (
								<Suspense fallback="">
									<LegacyConcierge />
								</Suspense>
							)}
						</StoreProvider>
					) : (
						<LoadingState />
					)}
				</SnackbarOrFragment>
			</I18nProvider>
			<GlobalStyles cssBaseline={mountCssBaseline} />
		</CrafterThemeProvider>
	);
}

export default CrafterCMSNextBridge;
