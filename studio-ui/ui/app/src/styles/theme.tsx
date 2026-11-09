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

import { createTheme, ThemeOptions } from '@mui/material/styles';
import palette from './palette';

export const backgroundColor = palette.gray.light1;
export const RedColor = palette.red.main;

export function createDefaultThemeOptions({ mode }: { mode: ThemeOptions['palette']['mode'] }) {
	const defaultTheme = createTheme({ palette: { mode } });
	const theme: ThemeOptions = {
		typography: {
			button: {
				textTransform: 'none'
			},
			fontSize: 14,
			fontFamily: '"Source Sans Pro", "Open Sans", sans-serif',
			fontWeightMedium: 600,
			fontWeightBold: 700,
			fontWeightLight: 300,
			fontWeightRegular: 400
		},
		components: {
			MuiListItem: {
				styleOverrides: {
					root: {
						'&.Mui-selected, &.Mui-selected:hover': {
							backgroundColor: palette.blue.highlight
						}
					}
				}
			},
			MuiListItemIcon: {
				styleOverrides: {
					root: {
						marginRight: 10,
						minWidth: 'auto'
					}
				}
			},
			MuiFormLabel: {
				styleOverrides: {
					asterisk: {
						color: RedColor
					}
				}
			},
			MuiTabs: {
				styleOverrides: {
					indicator: {
						backgroundColor: palette.blue.main
					}
				}
			},
			MuiAccordion: {
				styleOverrides: {
					root: {
						'&:before': {
							display: 'none'
						}
					}
				}
			},
			MuiAccordionSummary: {
				styleOverrides: {
					root: {
						'&:hover:not(.Mui-disabled)': {
							background: defaultTheme.palette.action.hover
						}
					},
					content: {
						'&$expanded': {
							margin: '12px 0'
						}
					}
				}
			},
			MuiTableCell: {
				styleOverrides: {
					sizeSmall: {
						padding: '6px 10px'
					}
				}
			},
			MuiTextField: {
				defaultProps: {
					variant: 'outlined'
				}
			},
			MuiSelect: {
				defaultProps: {
					variant: 'outlined'
				}
			},
			MuiTooltip: {
				defaultProps: {
					disableInteractive: true
				}
			}
		}
	};
	return theme;
}
