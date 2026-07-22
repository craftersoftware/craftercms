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

import React from 'react';
import DependenciesDialogContainer from './DependenciesDialogContainer';
import { DependenciesDialogProps } from './utils';
import EnhancedDialog from '../EnhancedDialog/EnhancedDialog';
import { FormattedMessage } from 'react-intl';

export function DependenciesDialog(props: DependenciesDialogProps) {
	const { item, dependenciesShown, rootPath, ...rest } = props;
	return (
		<EnhancedDialog title={<FormattedMessage defaultMessage="Content Item References" />} {...rest}>
			<DependenciesDialogContainer item={item} rootPath={rootPath} dependenciesShown={dependenciesShown} />
		</EnhancedDialog>
	);
}

export default DependenciesDialog;
