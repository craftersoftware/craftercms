/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { ReactNode, SyntheticEvent } from 'react';
import type { AllowedPathsData } from '../controls/NodeSelector';

/** Renders a FormControl with a RadioGroup to select from allowed content paths in the datasource selection dialog in
 * the Forms Engine Controls. */
export function ContentPicker(props: {
	label: ReactNode;
	allowedPaths: AllowedPathsData[];
	onChange(e, choice: AllowedPathsData): void;
}) {
	const { label, allowedPaths, onChange } = props;
	const handleChange = (event: SyntheticEvent) =>
		onChange?.(event, allowedPaths[(event.target as HTMLInputElement).value]);

	return (
        <FormControl>
            <FormLabel id="contentTypeLabel" sx={{ mb: 1 }}>
				{label}
			</FormLabel>
            <RadioGroup aria-labelledby="contentTypeLabel" name="contentType">
				{allowedPaths?.map((data, index) => (
					<FormControlLabel
						disableTypography
						key={index}
						value={index}
						control={<Radio />}
						label={
							<Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    py: 1
                                }}>
								<Typography component="span">{data.title}</Typography>
								<Typography variant="body2" color="textSecondary" component="span">
									{data.path}
								</Typography>
							</Box>
						}
						onChange={handleChange}
					/>
				))}
			</RadioGroup>
        </FormControl>
    );
}
