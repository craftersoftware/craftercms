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

import React from 'react';
import { EnhancedDialog, EnhancedDialogProps } from '../EnhancedDialog';
import { type ContentTypeField } from '../../models';
import { FormattedMessage, useIntl } from 'react-intl';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import controlDescriptors from '../ContentTypeManagement/descriptors/controls';
import { commonControlFieldsDescriptors } from '../ContentTypeManagement/descriptors/controls/commonDescriptors';
import { getPossibleTranslation } from '../../utils/i18n';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { Chip } from '@mui/material';
import inputDescriptor from '../ContentTypeManagement/descriptors/controls/input';
import { nnou } from '../../utils/object';

export interface FieldInformationDialogProps extends EnhancedDialogProps {
	field: ContentTypeField;
}

const basicPropsMap = {
	help: 'helpText',
	title: 'name'
};

export function FieldInformationDialog(props: FieldInformationDialogProps) {
	const { field, ...rest } = props;

	return (
		<EnhancedDialog maxWidth="sm" title={<FormattedMessage defaultMessage="Field Information" />} {...rest}>
			<Body field={field} />
		</EnhancedDialog>
	);
}

export default FieldInformationDialog;

type FieldInformationDialogBodyProps = Pick<FieldInformationDialogProps, 'field'>;

function Body(props: FieldInformationDialogBodyProps) {
	const { field } = props;
	const { formatMessage } = useIntl();

	// retrieve control descriptor for field type
	const descriptor = controlDescriptors[field.type] ?? inputDescriptor;

	return (
		<Box sx={{ p: 2, gap: 2, display: 'flex', flexDirection: 'column' }}>
			<Card>
				<CardContent>
					<Typography
						variant="subtitle1"
						sx={{
							fontWeight: 'bold'
						}}
					>
						<FormattedMessage defaultMessage="Basic Properties" />
					</Typography>

					{Object.values(commonControlFieldsDescriptors).map((descriptor) => {
						const value = field[basicPropsMap[descriptor.id] ?? descriptor.id];
						const renderHtml = descriptor.id === 'help';
						return (
							<Grid container spacing={2} key={descriptor.id} sx={{ mt: 0.5 }}>
								<Grid size={{ xs: 4 }}>
									<Typography
										sx={{
											color: 'text.secondary'
										}}
									>
										{getPossibleTranslation(descriptor.name, formatMessage)}
									</Typography>
								</Grid>
								<Grid size={{ xs: 8 }}>
									{renderHtml ? (
										<Typography component="section" dangerouslySetInnerHTML={{ __html: value ?? '-' }} />
									) : (
										<Typography>{nnou(value) && value !== '' ? value : '-'}</Typography>
									)}
								</Grid>
							</Grid>
						);
					})}
				</CardContent>
			</Card>

			{descriptor.sections?.map((section, index) => (
				<Card key={`${section.title}_${index}`}>
					<CardContent>
						<Typography
							variant="subtitle1"
							sx={{
								fontWeight: 'bold'
							}}
						>
							{getPossibleTranslation(section.title, formatMessage)}
						</Typography>
						{section.fields?.map((fieldName) => {
							let value = field.properties?.[fieldName]?.value ?? field.validations?.[fieldName]?.value;
							if (typeof value === 'boolean') {
								value = value ? (
									<Chip label="true" color="success" size="small" />
								) : (
									<Chip label="false" color="default" size="small" />
								);
							}
							return (
								<Grid container spacing={2} key={fieldName} sx={{ mt: 0.5 }}>
									<Grid size={{ xs: 4 }}>
										<Typography
											sx={{
												color: 'text.secondary'
											}}
										>
											{getPossibleTranslation(descriptor.fields?.[fieldName]?.name ?? fieldName, formatMessage)}
										</Typography>
									</Grid>
									<Grid size={{ xs: 8 }}>
										<Typography>{nnou(value) && value !== '' ? value : '-'}</Typography>
									</Grid>
								</Grid>
							);
						})}
					</CardContent>
				</Card>
			))}
		</Box>
	);
}
