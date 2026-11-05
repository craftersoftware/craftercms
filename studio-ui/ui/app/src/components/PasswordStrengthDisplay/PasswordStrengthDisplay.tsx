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

import React, { useEffect, useRef, useState } from 'react';
import Typography from '@mui/material/Typography';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import { ListItem } from '@mui/material';
import ListItemText from '@mui/material/ListItemText';
import { FullSxRecord, PartialSxRecord } from '../../models';
import Divider from '@mui/material/Divider';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import StarOutlineRoundedIcon from '@mui/icons-material/StarOutlineRounded';
import Collapse from '@mui/material/Collapse';
import { isBlank } from '../../utils/string';
import { nou } from '../../utils/object';
import palette from '../../styles/palette';

export type PasswordStrengthDisplayClassKey =
	| 'container'
	| 'scoreList'
	| 'scoreListItem'
	| 'scoreListItemDisplay'
	| 'scoreListItemText'
	| 'scoreActive20'
	| 'scoreActive40'
	| 'scoreActive60'
	| 'scoreActive80'
	| 'scoreActive100'
	| 'yourScoreText'
	| 'yourScoreIcon'
	| 'yourScoreTextInvalid'
	| 'yourScoreTextValid'
	| 'feedbackContainer'
	| 'divider';

export type PasswordStrengthDisplayFullSx = FullSxRecord<PasswordStrengthDisplayClassKey>;

export type PasswordStrengthDisplayPartialSx = PartialSxRecord<PasswordStrengthDisplayClassKey>;

export interface PasswordStrengthDisplayProps {
	value: string;
	passwordRequirementsMinComplexity: number;
	onValidStateChanged: (isValid: boolean) => void;
	sxs?: PasswordStrengthDisplayPartialSx;
}

function getStyles(sx?: PasswordStrengthDisplayPartialSx): PasswordStrengthDisplayFullSx {
	return {
		container: {
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			width: '330px'
		},
		scoreList: {
			display: 'flex',
			flexDirection: 'row',
			padding: 0,
			columnGap: '5px',
			marginTop: (theme) => theme.spacing(1),
			marginBottom: '5px',
			...sx?.scoreList
		},
		scoreListItem: {
			width: 'auto',
			padding: 0,
			...sx?.scoreListItem
		},
		scoreListItemDisplay: {
			width: '40px',
			textAlign: 'center',
			borderTop: '4px solid',
			borderColor: palette.gray.medium3,
			...sx?.scoreListItemDisplay
		},
		scoreListItemText: {
			margin: 0,
			...sx?.scoreListItemText
		},
		scoreActive20: {
			borderColor: (theme) => theme.palette.error.main,
			...sx?.scoreActive20
		},
		scoreActive40: {
			borderColor: (theme) => theme.palette.warning.main,
			...sx?.scoreActive40
		},
		scoreActive60: {
			borderColor: (theme) => (theme.palette.mode === 'dark' ? palette.yellow.tint : palette.yellow.main),
			...sx?.scoreActive60
		},
		scoreActive80: {
			borderColor: (theme) => theme.palette.info.main,
			...sx?.scoreActive80
		},
		scoreActive100: {
			borderColor: (theme) => theme.palette.success.main,
			...sx?.scoreActive100
		},
		yourScoreText: {
			display: 'flex',
			alignItems: 'center',
			...sx?.yourScoreText
		},
		yourScoreTextInvalid: {
			color: (theme) => theme.palette.error.main,
			...sx?.yourScoreTextInvalid
		},
		yourScoreTextValid: {
			color: (theme) => theme.palette.success.main,
			...sx?.yourScoreTextValid
		},
		yourScoreIcon: {
			fontSize: '15px',
			marginRight: (theme) => theme.spacing(1),
			...sx?.yourScoreIcon
		},
		feedbackContainer: {
			width: '100%',
			alignItems: 'center',
			...sx?.feedbackContainer
		},
		divider: {
			width: '40%',
			margin: (theme) => `${theme.spacing(1)} auto`,
			...sx?.divider
		}
	};
}

const messages = defineMessages({
	'0': {
		id: 'passwordStrengthDisplay.tooGuessable',
		defaultMessage: 'Too guessable'
	},
	'1': {
		id: 'passwordStrengthDisplay.veryGuessable',
		defaultMessage: 'Very guessable'
	},
	'2': {
		id: 'passwordStrengthDisplay.somewhatGuessable',
		defaultMessage: 'Somewhat guessable'
	},
	'3': {
		id: 'passwordStrengthDisplay.safelyUnguessable',
		defaultMessage: 'Safely unguessable'
	},
	'4': {
		id: 'passwordStrengthDisplay.veryUnguessable',
		defaultMessage: 'Very unguessable'
	}
});

function getDisplayScore(score) {
	return (score + 1) * 20;
}

export function PasswordStrengthDisplay(props: PasswordStrengthDisplayProps) {
	const { value, passwordRequirementsMinComplexity, onValidStateChanged, sxs } = props;
	const sx = getStyles(sxs);
	const minScore = getDisplayScore(passwordRequirementsMinComplexity);
	const [password, setPassword] = useState(null);
	const passwordScore = value === '' || nou(password) ? 0 : getDisplayScore(password.score);
	const { formatMessage } = useIntl();
	const onChangeTimeoutRef = useRef<any>(null);

	useEffect(() => {
		clearTimeout(onChangeTimeoutRef.current);
		onChangeTimeoutRef.current = setTimeout(() => {
			import('zxcvbn').then(({ default: zxcvbn }) => {
				const pass = zxcvbn(value);
				setPassword(pass);
				onValidStateChanged(isBlank(value) ? null : pass.score >= passwordRequirementsMinComplexity);
			});
		}, 200);
	}, [value, onValidStateChanged, passwordRequirementsMinComplexity]);

	return (
		<Box sx={sx.container}>
			<Typography variant="subtitle2">
				<FormattedMessage id="passwordStrengthDisplay.passwordStrengthTitle" defaultMessage="Password Strength Score" />
			</Typography>
			<Typography variant="body2">
				<FormattedMessage
					id="passwordStrengthDisplay.minimumScore"
					defaultMessage="Minimum score {minScore}"
					values={{ minScore }}
				/>
			</Typography>
			<Box>
				<List sx={sx.scoreList}>
					{new Array(5).fill(null).map((x, i) => (
						<ListItem sx={sx.scoreListItem} key={i}>
							{/* @ts-ignore - spread styles not recognized as valid */}
							<Box
								sx={{
									...sx.scoreListItemDisplay,
									...(passwordScore >= getDisplayScore(i) && {
										...sx[`scoreActive${getDisplayScore(i)}`]
									})
								}}
							>
								<ListItemText
									primary={getDisplayScore(i)}
									sx={sx.scoreListItemText}
									slotProps={{
										primary: {
											// Weight marks a filled segment so the score is not colour alone.
											sx: { fontWeight: passwordScore >= getDisplayScore(i) ? 700 : 400 }
										}
									}}
								/>
							</Box>
						</ListItem>
					))}
				</List>
			</Box>
			<Typography
				variant="body2"
				/* @ts-ignore - spread styles not recognized as valid */
				sx={{
					...sx.yourScoreText,
					...(passwordScore > 0 && passwordScore < minScore
						? { ...sx.yourScoreTextInvalid }
						: passwordScore >= minScore
							? { ...sx.yourScoreTextValid }
							: {})
				}}
			>
				{passwordScore === minScore ? (
					<CheckCircleOutlineRoundedIcon sx={sx.yourScoreIcon} />
				) : passwordScore === 100 ? (
					<StarOutlineRoundedIcon sx={sx.yourScoreIcon} />
				) : (
					<InfoOutlinedIcon sx={sx.yourScoreIcon} />
				)}
				<FormattedMessage
					id="passwordStrengthDisplay.passwordScore"
					defaultMessage="Your score: {score}"
					values={{ score: passwordScore }}
				/>
			</Typography>
			<Collapse in={passwordScore > 0 && passwordScore < minScore} sx={sx.feedbackContainer}>
				<Divider sx={sx.divider} />
				<Box style={{ textAlign: 'left' }}>
					{password && (
						<>
							<Typography variant="body2">
								{formatMessage(messages[password.score])}.{' '}
								{password.feedback.warning ? `${password.feedback.warning}.` : ''}
							</Typography>
							{password?.feedback.suggestions.map((suggestion, i) => (
								<Typography variant="body2" key={i}>
									- {suggestion}
								</Typography>
							))}
						</>
					)}
				</Box>
			</Collapse>
		</Box>
	);
}

export default PasswordStrengthDisplay;
