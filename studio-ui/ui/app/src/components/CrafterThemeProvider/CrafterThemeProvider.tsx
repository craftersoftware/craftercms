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

import React, { PropsWithChildren, useMemo } from 'react';
import { createTheme, ThemeOptions, ThemeProvider } from '@mui/material/styles';
import { createDefaultThemeOptions } from '../../styles/theme';
import useMediaQuery from '@mui/material/useMediaQuery';
import palette from '../../styles/palette';
import { deepmerge } from '@mui/utils';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import useEnableAnimations from '../../hooks/useEnableAnimations';

export type CrafterThemeProviderProps = PropsWithChildren<{ themeOptions?: ThemeOptions }>;

const muiCache = createCache({ key: 'mui', prepend: true });

const tssCache = createCache({ key: 'craftercms' });

// .compat = true to avoid console warnings regarding first-child
tssCache.compat = true;
muiCache.compat = true;

export function CrafterThemeProvider(props: CrafterThemeProviderProps) {
	const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
	const enableAnimations = useEnableAnimations();

	const theme = useMemo(() => {
		const mode = prefersDarkMode ? 'dark' : 'light';
		const auxTheme = createTheme({ palette: { mode } });
		const defaultThemeOptions = createDefaultThemeOptions({ mode });
		return createTheme({
			...(props.themeOptions ?? defaultThemeOptions),
			// Animations: Disable MUI JavaScript/CSS transition helpers
			...(!enableAnimations && {
				transitions: {
					...defaultThemeOptions?.transitions,
					...props.themeOptions?.transitions,
					create: () => 'none'
				}
			}),
			palette: {
				mode,
				primary: {
					main: prefersDarkMode ? palette.blue.tint : palette.blue.main
				},
				warning: {
					main: prefersDarkMode ? palette.orange.tint : palette.orange.main
				},
				error: {
					// Light #FF3B30 (palette.red.main) is 3.55:1 on white and 3.40:1 on #FAFAFA.
					// #D12E25 is 5.09:1 on #fff, 4.87:1 on #FAFAFA (background.default), and 4.58:1 on #F3F3F3.
					// Dark mode stays palette.red.tint (#FF6961), 6.64:1 on #121212.
					main: prefersDarkMode ? palette.red.tint : '#D12E25'
				},
				success: {
					main: prefersDarkMode ? palette.green.tint : palette.green.main
				},
				info: {
					main: prefersDarkMode ? palette.teal.tint : palette.teal.main
				},
				secondary: {
					main: prefersDarkMode ? palette.indigo.tint : palette.purple.tint
				},
				action: {
					selected: palette.blue.highlight
				},
				background: {
					default: prefersDarkMode ? palette.gray.dark7 : palette.gray.light0
				},
				divider: prefersDarkMode ? 'rgba(59, 74, 89, 0.3)' : auxTheme.palette.divider,
				...props.themeOptions?.palette
			},
			components: deepmerge((props.themeOptions ?? defaultThemeOptions).components ?? {}, {
				MuiLink: {
					defaultProps: {
						underline: 'hover'
					}
				},
				MuiOutlinedInput: {
					styleOverrides: {
						root: {
							backgroundColor: auxTheme.palette.background.paper
						}
					}
				},
				MuiButtonBase: {
					// Animations: Disable interactive ripple effects globally
					...(!enableAnimations && {
						defaultProps: {
							disableRipple: true
						}
					})
				},
				MuiInputBase: {
					styleOverrides: {
						root: {
							backgroundColor: auxTheme.palette.background.paper
						}
					}
				},
				// Animations: Force-disable pure CSS transitions and animations
				MuiCssBaseline: {
					...(!enableAnimations && {
						styleOverrides: {
							'*, *::before, *::after': {
								transition: 'none !important',
								animation: 'none !important'
							}
						}
					})
				}
			})
		});
	}, [prefersDarkMode, props.themeOptions, enableAnimations]);
	return (
		<CacheProvider value={muiCache}>
			<ThemeProvider theme={theme} children={props.children} />
		</CacheProvider>
	);
}

export default CrafterThemeProvider;
