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
import { deepmerge, isPlainObject } from '@mui/utils';
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

/**
 * The palette entry for a component's `color` prop, or undefined when there is none. A plugin can pass a
 * colour name through the `*PropsColorOverrides` augmentation without registering a palette entry, and
 * MUI's own variants skip such a name (`createSimplePaletteValueFilter`). Reading `.main` off it here would
 * throw, so the overrides fall through to MUI's default styling instead, the same way `MuiAlert` does.
 */
function paletteColour(theme: Theme, color: string | undefined) {
	const entry = theme.palette[color ?? 'primary'];
	return entry && typeof entry.main === 'string' ? entry : undefined;
}

/**
 * MUI's deepmerge replaces a styleOverrides slot when either side is a function, so a caller's
 * callback — or a plain object, once this provider supplies a callback — would be discarded.
 * Compose the two results instead. Unrelated caller keys stay, and our keys win on conflict.
 * A slot the caller did not set is returned unchanged, which keeps today's contrast rules as they are.
 */
function composeStyleOverride<T>(caller: unknown, ours: T): T {
	if (caller == null) {
		return ours;
	}
	if (typeof caller !== 'function' && typeof ours !== 'function') {
		return mergeStyleResults(caller, ours) as T;
	}
	return ((props: object) =>
		mergeStyleResults(
			typeof caller === 'function' ? caller(props) : caller,
			typeof ours === 'function' ? ours(props) : ours
		)) as T;
}

function mergeStyleResults(callerStyles: unknown, ourStyles: unknown): unknown {
	if (isPlainObject(callerStyles) && isPlainObject(ourStyles)) {
		return deepmerge(callerStyles, ourStyles);
	}
	// `&&` overrides return false when the rule does not apply. Keep whichever side has styles.
	if (callerStyles == null || callerStyles === false) {
		return ourStyles;
	}
	if (ourStyles == null || ourStyles === false) {
		return callerStyles;
	}
	return [callerStyles, ourStyles];
}

function readStyleSlot(
	components: ThemeOptions['components'] | undefined,
	component: string,
	slotName: string
): unknown {
	const entry = components?.[component as keyof NonNullable<ThemeOptions['components']>] as
		{ styleOverrides?: unknown } | undefined;
	const overrides = entry?.styleOverrides;
	if (!isPlainObject(overrides)) {
		return undefined;
	}
	return overrides[slotName];
}

export function CrafterThemeProvider(props: CrafterThemeProviderProps) {
	const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
	const enableAnimations = useEnableAnimations();

	const theme = useMemo(() => {
		const mode = prefersDarkMode ? 'dark' : 'light';
		const auxTheme = createTheme({ palette: { mode } });
		const defaultThemeOptions = createDefaultThemeOptions({ mode });
		const callerComponents = (props.themeOptions ?? defaultThemeOptions).components;
		function styleSlot<T>(component: string, slotName: string, ours: T): T {
			return composeStyleOverride(readStyleSlot(callerComponents, component, slotName), ours);
		}
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
			components: deepmerge(callerComponents ?? {}, {
				// Switch root is overflow: hidden, so MUI draws the theme ring inset on it (see styles/focusRing.ts).
				MuiSwitch: {
					styleOverrides: {
						// The default 38% / 50% tracks are 2.2:1 to 2.7:1 on white. 1.4.11 needs 3:1.
						// `:not(.Mui-disabled)` leaves MUI's own disabled track rules in charge, so a read-only
						// checked switch (FormsEngine's checkbox control uses one) keeps its disabled look
						// instead of a full-strength track. 1.4.11 exempts disabled controls, so nothing is lost.
						root: styleSlot('MuiSwitch', 'root', ({ ownerState, theme }) => ({
							'& .MuiSwitch-track': { opacity: 1, backgroundColor: theme.palette.border.control },
							'& .MuiSwitch-switchBase.Mui-checked:not(.Mui-disabled) + .MuiSwitch-track': {
								opacity: 1,
								backgroundColor:
									ownerState.color === 'default'
										? theme.palette.text.secondary
										: paletteColour(theme, ownerState.color)?.main
							}
						})),
						switchBase: styleSlot('MuiSwitch', 'switchBase', ({ theme }) => ({
							...(theme.palette.mode === 'dark' && { '&:not(.Mui-checked)': { color: palette.white } })
						}))
					}
				},
				// The default 50% (button) and 70% (chip) alpha borders are 2:1 to 2.9:1. A full-strength border is 3:1 or more.
				MuiButton: {
					styleOverrides: {
						// MUI darkens the fill on hover. Dark text on the darkened tint is 3.9:1, so lighten it instead.
						contained: styleSlot(
							'MuiButton',
							'contained',
							({ ownerState, theme }) =>
								theme.palette.mode === 'dark' &&
								ownerState.color !== 'inherit' &&
								paletteColour(theme, ownerState.color) && {
									'@media (hover: hover)': {
										'&:hover': { '--variant-containedBg': paletteColour(theme, ownerState.color).light }
									}
								}
						),
						outlined: styleSlot('MuiButton', 'outlined', ({ ownerState, theme }) => {
							if (ownerState.color === 'inherit') {
								return { borderColor: 'currentColor' };
							}
							const colour = paletteColour(theme, ownerState.color);
							return colour ? { borderColor: colour.main } : {};
						})
					}
				},
				MuiChip: {
					styleOverrides: {
						outlined: styleSlot('MuiChip', 'outlined', ({ ownerState, theme }) => {
							if (ownerState.color === 'default') {
								return { borderColor: theme.palette.border.control };
							}
							const colour = paletteColour(theme, ownerState.color);
							return colour ? { borderColor: colour.main } : {};
						})
					}
				},
				// MUI fills a dark-mode Alert with palette[severity].dark but takes the label colour from .main,
				// so the pair mixes two shades (3.96:1 for error). Fill with .main in both modes, as Chip and
				// Button already do, and the label colour MUI derives from .main matches the fill.
				// Reachable through NotistackVariant's `alertVariant` prop, which plugins can pass.
				MuiAlert: {
					styleOverrides: {
						filled: styleSlot('MuiAlert', 'filled', ({ ownerState, theme }) => {
							const severity = ownerState.color ?? ownerState.severity;
							const colour = paletteColour(theme, severity);
							return colour ? { backgroundColor: colour.main } : {};
						})
					}
				},
				// colorDefault initials are background.default on grey[400] (light) and grey[600] (dark):
				// #FAFAFA on #BDBDBD is 1.80:1, #1C1C1E on #757575 is 3.69:1. The disc stays.
				// text.primary on those discs is 9.36:1 and 4.61:1. 20px regular text needs 4.5:1.
				MuiAvatar: {
					styleOverrides: {
						colorDefault: styleSlot('MuiAvatar', 'colorDefault', ({ theme }) => ({
							color: theme.palette.text.primary
						}))
					}
				},
				// A selected primary toggle paints primary.main on an 8% wash of itself. On
				// background.default (#FAFAFA) that is #0068DA on #E6EEF7, 4.49:1, and 4.24:1 once
				// hover adds hoverOpacity. Axe requires the ratio to be over 4.5. blue.shade (#0040DD)
				// is 6.46:1 and 6.09:1 on those washes. Dark mode's tint clears at rest (5.13:1).
				// Hover adds another 8% (a 24% wash): #54A6FF on that wash is 4.38:1, so the hovered
				// label uses text.primary (about 11:1). The scan does not hover, so the ratio test covers it.
				MuiToggleButton: {
					styleOverrides: {
						root: styleSlot('MuiToggleButton', 'root', ({ ownerState, theme }) =>
							ownerState.color !== 'primary'
								? {}
								: theme.palette.mode === 'light'
									? { '&.Mui-selected': { color: palette.blue.shade } }
									: { '&.Mui-selected:hover': { color: theme.palette.text.primary } }
						)
					}
				},
				// A tinted background alone does not tell a selected item apart (1.4.1), so add a leading bar.
				MuiListItemButton: { styleOverrides: { root: styleSlot('MuiListItemButton', 'root', selectedBar) } },
				MuiMenuItem: { styleOverrides: { root: styleSlot('MuiMenuItem', 'root', selectedBar) } },
				MuiListItem: { styleOverrides: { root: styleSlot('MuiListItem', 'root', selectedBar) } },
				MuiLink: {
					defaultProps: {
						underline: 'always'
					}
				},
				MuiOutlinedInput: {
					styleOverrides: {
						root: styleSlot('MuiOutlinedInput', 'root', ({ theme }) => ({
							backgroundColor: theme.palette.background.paper
						})),
						// The default rgba(0,0,0,.23) border is 1.74:1 on white. 3:1 is needed on every surface, dialogs included.
						notchedOutline: styleSlot('MuiOutlinedInput', 'notchedOutline', ({ theme }) => ({
							borderColor: theme.palette.border.control
						}))
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
				MuiInput: { styleOverrides: { underline: styleSlot('MuiInput', 'underline', underlineBorder) } },
				MuiFilledInput: { styleOverrides: { underline: styleSlot('MuiFilledInput', 'underline', underlineBorder) } },
				MuiInputBase: {
					styleOverrides: {
						root: styleSlot('MuiInputBase', 'root', ({ theme }) => ({
							backgroundColor: theme.palette.background.paper
						})),
						// The default placeholder is 42% (light) / 50% (dark) opacity, 2.7:1 on white.
						input: styleSlot('MuiInputBase', 'input', ({ theme }) => ({
							'&::placeholder, &:focus::placeholder': { opacity: 1, color: theme.palette.text.secondary }
						}))
					}
				},
				// Animations: Force-disable pure CSS transitions and animations.
				// CssBaseline's styleOverrides may itself be a function, which per-slot lookup cannot see.
				MuiCssBaseline: {
					...(!enableAnimations && {
						styleOverrides: composeStyleOverride(callerComponents?.MuiCssBaseline?.styleOverrides, {
							'*, *::before, *::after': {
								transition: 'none !important',
								animation: 'none !important'
							}
						})
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
