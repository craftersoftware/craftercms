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
import { createTheme, Theme, ThemeOptions, ThemeProvider } from '@mui/material/styles';
import { createDefaultThemeOptions } from '../../styles/theme';
import useMediaQuery from '@mui/material/useMediaQuery';
import palette, { getStudioPaletteOptions } from '../../styles/palette';
import { getFocusRingThemeOptions } from '../../styles/focusRing';
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

const underlineBorder = ({ theme }: { theme: Theme }) =>
	theme.palette.mode === 'light' && { '&::before': { borderBottomColor: theme.palette.border.control } };

const selectedBar = {
	'&.Mui-selected': {
		backgroundImage: 'linear-gradient(currentColor, currentColor)',
		backgroundSize: '3px 100%',
		backgroundRepeat: 'no-repeat'
	}
};

export function CrafterThemeProvider(props: CrafterThemeProviderProps) {
	const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
	const enableAnimations = useEnableAnimations();

	const theme = useMemo(() => {
		const mode = prefersDarkMode ? 'dark' : 'light';
		const auxTheme = createTheme({ palette: { mode } });
		const defaultThemeOptions = createDefaultThemeOptions({ mode });
		return createTheme({
			// Keyboard focus ring for every ButtonBase-based control (2.4.7, 1.4.11). See styles/focusRing.ts.
			...getFocusRingThemeOptions(mode),
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
				...getStudioPaletteOptions(mode),
				action: {
					selected: palette.blue.highlight
				},
				background: {
					default: prefersDarkMode ? palette.gray.dark7 : palette.gray.light0
				},
				divider: prefersDarkMode ? 'rgba(59, 74, 89, 0.3)' : auxTheme.palette.divider,
				// MUI picks every contrastText from this threshold (its default is 3, which yields white on
				// #FF2D55 at 3.65:1). At 4.5 a label on a fill is AA without a per-component check.
				contrastThreshold: 4.5,
				...props.themeOptions?.palette
			},
			components: deepmerge((props.themeOptions ?? defaultThemeOptions).components ?? {}, {
				// Switch root is overflow: hidden, so MUI draws the theme ring inset on it (see styles/focusRing.ts).
				MuiSwitch: {
					styleOverrides: {
						// The default 38% / 50% tracks are 2.2:1 to 2.7:1 on white. 1.4.11 needs 3:1.
						root: ({ ownerState, theme }) => ({
							'& .MuiSwitch-track': { opacity: 1, backgroundColor: theme.palette.border.control },
							'& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
								opacity: 1,
								backgroundColor:
									ownerState.color === 'default'
										? theme.palette.text.secondary
										: theme.palette[ownerState.color ?? 'primary'].main
							}
						}),
						switchBase: ({ theme }) => ({
							...(theme.palette.mode === 'dark' && { '&:not(.Mui-checked)': { color: palette.white } })
						})
					}
				},
				// The default 50% (button) and 70% (chip) alpha borders are 2:1 to 2.9:1. A full-strength border is 3:1 or more.
				MuiButton: {
					styleOverrides: {
						// MUI darkens the fill on hover. Dark text on the darkened tint is 3.9:1, so lighten it instead.
						contained: ({ ownerState, theme }) =>
							theme.palette.mode === 'dark' &&
							ownerState.color !== 'inherit' && {
								'@media (hover: hover)': {
									'&:hover': { '--variant-containedBg': theme.palette[ownerState.color ?? 'primary'].light }
								}
							},
						outlined: ({ ownerState, theme }) => ({
							borderColor:
								ownerState.color === 'inherit' ? 'currentColor' : theme.palette[ownerState.color ?? 'primary'].main
						})
					}
				},
				MuiChip: {
					styleOverrides: {
						outlined: ({ ownerState, theme }) => ({
							borderColor:
								ownerState.color === 'default' ? theme.palette.border.control : theme.palette[ownerState.color].main
						})
					}
				},
				// A tinted background alone does not tell a selected item apart (1.4.1), so add a leading bar.
				MuiListItemButton: { styleOverrides: { root: selectedBar } },
				MuiMenuItem: { styleOverrides: { root: selectedBar } },
				MuiListItem: { styleOverrides: { root: selectedBar } },
				MuiLink: {
					defaultProps: {
						underline: 'always'
					}
				},
				MuiOutlinedInput: {
					styleOverrides: {
						root: ({ theme }) => ({ backgroundColor: theme.palette.background.paper }),
						// The default rgba(0,0,0,.23) border is 1.74:1 on white. 3:1 is needed on every surface, dialogs included.
						notchedOutline: ({ theme }) => ({ borderColor: theme.palette.border.control })
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
				// The default 42% black underline is 2.98:1 on white. Dark mode (70% white) already passes.
				MuiInput: { styleOverrides: { underline: underlineBorder } },
				MuiFilledInput: { styleOverrides: { underline: underlineBorder } },
				MuiInputBase: {
					styleOverrides: {
						root: ({ theme }) => ({ backgroundColor: theme.palette.background.paper }),
						// The default placeholder is 42% (light) / 50% (dark) opacity, 2.7:1 on white.
						input: ({ theme }) => ({
							'&::placeholder, &:focus::placeholder': { opacity: 1, color: theme.palette.text.secondary }
						})
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
