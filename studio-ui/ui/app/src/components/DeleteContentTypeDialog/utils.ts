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
import ContentType from '../../models/ContentType';
import { FetchContentTypeUsageResponse } from '../../services/contentTypes';
import { EnhancedDialogProps } from '../EnhancedDialog';
import React from 'react';

export interface DeleteContentTypeBaseProps {
	contentType: ContentType;
}

export interface DeleteContentTypeDialogProps extends DeleteContentTypeBaseProps, EnhancedDialogProps {
	onComplete?();
}

export interface DeleteContentTypeDialogContainerProps
	extends DeleteContentTypeBaseProps, Pick<DeleteContentTypeDialogProps, 'onComplete' | 'onClose' | 'isSubmitting'> {}

export interface DeleteContentTypeDialogBodyProps {
	submitting: boolean;
	contentType: ContentType;
	data: FetchContentTypeUsageResponse;
	password?: string;
	onCloseButtonClick?(e: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
	onSubmit(): void;
}
