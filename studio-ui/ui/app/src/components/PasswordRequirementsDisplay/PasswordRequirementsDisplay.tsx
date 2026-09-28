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

import React, { useEffect, useMemo } from 'react';
import { isBlank } from '../../utils/string';
import Typography from '@mui/material/Typography';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { passwordRequirementMessages } from '../../env/i18n-legacy';
import palette from '../../styles/palette';
import { PartialSxRecord } from '../../models';
import Box from '@mui/material/Box';

type PasswordRequirementsDisplayClassKey =
	'listOfConditions' | 'conditionItem' | 'conditionItemIcon' | 'conditionItemNotMet' | 'conditionItemMet';

export interface PasswordRequirementsDisplayProps {
	value: string;
	formatMessage: Function;
	onValidStateChanged: (isValid: boolean) => void;
	passwordRequirementsRegex: string;
	classes?: Partial<Record<PasswordRequirementsDisplayClassKey, string>>;
	sxs?: PartialSxRecord<PasswordRequirementsDisplayClassKey>;
}

export function PasswordRequirementsDisplay(props: PasswordRequirementsDisplayProps) {
	const { passwordRequirementsRegex, formatMessage, value, onValidStateChanged, sxs } = props;
	const { regEx, conditions } = useMemo(
		() => getPrimeMatter({ passwordRequirementsRegex, formatMessage }),
		[passwordRequirementsRegex, formatMessage]
	);
	useEffect(() => {
		onValidStateChanged(isBlank(value) ? null : regEx.test(value));
	}, [onValidStateChanged, regEx, value]);
	return (
		<Box
			component="ul"
			className={props.classes?.listOfConditions}
			sx={{
				listStyle: 'none',
				padding: 0,
				margin: '16px 0 16px 0',
				...sxs?.listOfConditions
			}}
		>
			{conditions.map(({ description, regEx: condition }, key) => {
				const blank = isBlank(value);
				const valid = condition.test(value);
				return (
					<Typography
						key={key}
						component="li"
						className={props.classes?.conditionItem}
						sx={{
							display: 'flex',
							alignItems: 'center',
							color: valid ? palette.green.shade : palette.yellow.shade,
							...sxs?.conditionItem
						}}
					>
						{valid && !blank ? (
							<CheckCircleOutlineRoundedIcon
								className={props.classes?.conditionItemIcon}
								sx={{
									marginRight: (theme) => theme.spacing(1),
									...sxs?.conditionItemIcon
								}}
							/>
						) : (
							<ErrorOutlineRoundedIcon
								className={props.classes?.conditionItemIcon}
								sx={{
									marginRight: (theme) => theme.spacing(1),
									...sxs?.conditionItemIcon
								}}
							/>
						)}
						{description}
					</Typography>
				);
			})}
		</Box>
	);
}

function getPrimeMatter(props: Partial<PasswordRequirementsDisplayProps>) {
	const { passwordRequirementsRegex, formatMessage } = props;
	let regEx = null;
	let captureGroups = passwordRequirementsRegex.match(/\(\?<.*?>.*?\)/g);
	let namedCaptureGroupSupport = true;
	let fallback;
	if (!captureGroups) {
		// RegExp may be valid and have no capture groups
		fallback = {
			regEx,
			description: formatMessage(passwordRequirementMessages.validationPassing)
		};
	}
	try {
		regEx = new RegExp(passwordRequirementsRegex);
		captureGroups = passwordRequirementsRegex.match(/\(\?<.*?>.*?\)/g);
	} catch (error) {
		console.warn(error);
		try {
			// reg ex without the capture groups and just need to remove the capture
			// If the reg ex is parsable without the capture groups, we can use the
			// group from the individual pieces later on the mapping.
			namedCaptureGroupSupport = false;
			regEx = new RegExp(passwordRequirementsRegex.replace(/\?<(.*?)>/g, ''));
		} catch (error) {
			// Allow everything and default to backend as regex wasn't
			// parsable/valid for current navigator
			regEx = /(.|\s)*\S(.|\s)*/;
			fallback = {
				regEx,
				description: formatMessage(passwordRequirementMessages.notBlank)
			};
			console.warn('Defaulting password validation to server due to issues in RegExp compilation.');
		}
	}
	return {
		regEx,
		conditions: captureGroups
			? captureGroups.map((captureGroup) => {
					let description;
					let captureGroupKey = captureGroup.match(/\?<(.*?)>/g)?.[0].replace(/\?<|>/g, '') ?? 'Unnamed condition';
					if (!namedCaptureGroupSupport) {
						captureGroup = captureGroup.replace(/\?<(.*?)>/g, '');
					}
					switch (captureGroupKey) {
						case 'hasSpecialChars':
							const allowedChars = (passwordRequirementsRegex.match(/\(\?<hasSpecialChars>(.*)\[(.*?)]\)/) || [
								'',
								'',
								''
							])[2];
							description = formatMessage(passwordRequirementMessages.hasSpecialChars, {
								chars: allowedChars ? `(${allowedChars})` : ''
							});
							break;
						case 'minLength':
							const min = ((passwordRequirementsRegex.match(/\(\?<minLength>(.*){(.*?)}\)/) || [''])[0].match(
								/{(.*?)}/
							) || ['', ''])[1].split(',')[0];
							description = formatMessage(passwordRequirementMessages.minLength, { min });
							break;
						case 'maxLength':
							const max = ((passwordRequirementsRegex.match(/\(\?<maxLength>(.*){(.*?)}\)/) || [''])[0].match(
								/{(.*?)}/
							) || ['', ''])[1].split(',')[1];
							description = formatMessage(passwordRequirementMessages.maxLength, { max });
							break;
						case 'minMaxLength':
							const minLength = ((passwordRequirementsRegex.match(/\(\?<minMaxLength>(.*){(.*?)}\)/) || [''])[0].match(
								/{(.*?)}/
							) || ['', ''])[1].split(',')[0];
							const maxLength = ((passwordRequirementsRegex.match(/\(\?<minMaxLength>(.*){(.*?)}\)/) || [''])[0].match(
								/{(.*?)}/
							) || ['', ''])[1].split(',')[1];
							description = formatMessage(passwordRequirementMessages.minMaxLength, {
								minLength,
								maxLength
							});
							break;
						default:
							description = formatMessage(
								passwordRequirementMessages[captureGroupKey] ?? passwordRequirementMessages.unnamedGroup
							);
							break;
					}
					return {
						regEx: new RegExp(captureGroup),
						description
					};
				})
			: [fallback]
	};
}

export default PasswordRequirementsDisplay;
