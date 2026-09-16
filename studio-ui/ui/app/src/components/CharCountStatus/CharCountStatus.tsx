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
import palette from '../../styles/palette';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { FormattedMessage } from 'react-intl';
import { useSelector } from 'react-redux';
import GlobalState from '../../models/GlobalState';

interface CharCountStatusContainerProps {
	commentLength: number;
}

interface CharCountStatusProps {
	commentLength: number;
	commentMaxLength: number;
}

function CharCountStatus(props: CharCountStatusProps) {
	const { commentLength, commentMaxLength } = props;

	return (
        <Grid
            container
            direction="row"
            sx={{
                justifyContent: "space-between",
                padding: '5px'
            }}>
            <Grid>
				<Typography sx={{ fontSize: '14px', color: palette.gray.medium4 }}>
					<FormattedMessage
						id="deleteDialog.maxCharacters"
						defaultMessage="Max {maxLength} characters"
						values={{ maxLength: commentMaxLength }}
					/>
				</Typography>
			</Grid>

            <Grid>
				<Typography sx={{ fontSize: '14px', color: palette.gray.medium4 }}>
					{commentLength}/{commentMaxLength}
				</Typography>
			</Grid>
        </Grid>
    );
}

export function CharCountStatusContainer(props: CharCountStatusContainerProps) {
	const { commentLength } = props;

	const commentMaxLength = useSelector<GlobalState, number>(
		(state) => state.uiConfig.publishing.submissionCommentMaxLength
	);

	return <CharCountStatus commentLength={commentLength} commentMaxLength={commentMaxLength}></CharCountStatus>;
}

export default CharCountStatus;
