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

import { Site } from '../../models/Site';
import StandardAction from '../../models/StandardAction';
import { EnhancedDialogProps } from '../EnhancedDialog';
import { EnhancedDialogState } from '../../hooks/useEnhancedDialogState';

export type Source = { site: Site; error: Error };
export type Return = Omit<Source, 'error'>;

export interface EditSiteDialogBaseProps {
	site: Site;
}

export interface EditSiteDialogProps extends EditSiteDialogBaseProps, EnhancedDialogProps {
	onSaveSuccess?(response?: any): any;
	onSiteImageChange?(): void;
}

export interface EditSiteDialogStateProps extends EditSiteDialogBaseProps, EnhancedDialogState {
	onSaveSuccess?: StandardAction;
	onSiteImageChange?: StandardAction;
	onClose?: StandardAction;
	onClosed?: StandardAction;
}

export interface EditSiteDialogContainerProps
	extends
		EditSiteDialogBaseProps,
		Pick<EditSiteDialogProps, 'isSubmitting' | 'onSaveSuccess' | 'onSiteImageChange' | 'onClose'> {}
