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

/**
 * Class on every toast surface, whichever content component drew it: notistack's default
 * (`MaterialDesignContent`, which also adds `notistack-MuiContent`) and the Alert-based variants used for
 * error, warning, success and info (which add no such class). Styling that must reach all toasts, such as
 * the focus ring for native links in a message, keys on this instead of a notistack class.
 *
 * It lives on its own so a stylesheet can read it without importing the toast components and, with them,
 * notistack.
 */
export const TOAST_HOST_CLASS = 'crafter-toast';

export default TOAST_HOST_CLASS;
