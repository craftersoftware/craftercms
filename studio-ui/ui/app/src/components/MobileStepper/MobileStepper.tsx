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

import React, { ReactNode } from 'react';
import { useIntl } from 'react-intl';
import clsx from 'clsx';
import Paper from '@mui/material/Paper';
import { LinearProgress, Theme } from '@mui/material';
import { RedColor } from '../../styles/theme';
import { capitalize } from '../../utils/string';
import { SxProps } from '@mui/system';
import { styled } from '@mui/material/styles';

export interface MobileStepperProps {
	activeStep?: number;
	backButton?: ReactNode;
	onDotClick?: Function;
	classes?: Partial<Record<'root' | 'dots' | 'dot' | 'progress', string>>;
	className?: string;
	sx?: SxProps<Theme>;
	LinearProgressProps?: any;
	nextButton?: ReactNode;
	position?: 'bottom' | 'top' | 'static';
	steps: number;
	variant: 'text' | 'dots' | 'progress';
}

const mobileStepperRootClass = 'MuiMobileStepper';
const mobileStepperClasses = {
	root: mobileStepperRootClass,
	dots: `${mobileStepperRootClass}-dots`,
	dot: `${mobileStepperRootClass}-dot`,
	dotActive: `${mobileStepperRootClass}-dotActive`,
	progress: `${mobileStepperRootClass}-progress`,
	positionBottom: `${mobileStepperRootClass}-positionBottom`,
	positionTop: `${mobileStepperRootClass}-positionTop`
};

export const UnstyledMobileStepper = React.forwardRef<HTMLDivElement, MobileStepperProps>(
	function MobileStepper(props, ref) {
		const {
			activeStep = 0,
			backButton,
			onDotClick,
			classes = {},
			sx,
			className,
			LinearProgressProps,
			nextButton,
			position = 'bottom',
			steps,
			variant = 'dots',
			...other
		} = props;
		const { formatMessage } = useIntl();

		return (
			<Paper
				square
				elevation={0}
				className={clsx(classes?.root, `${mobileStepperClasses.root}-position${capitalize(position)}`, className)}
				sx={sx}
				onClick={(e) => e.stopPropagation()}
				ref={ref}
				{...other}
			>
				{backButton}
				{variant === 'text' && (
					<React.Fragment>
						{activeStep + 1} / {steps}
					</React.Fragment>
				)}
				{variant === 'dots' && (
					<div className={clsx(classes?.dots, mobileStepperClasses.dots)}>
						{[...new Array(steps)].map((_, index) =>
							onDotClick ? (
								<button
									type="button"
									key={index}
									onClick={(e) => onDotClick(e, index)}
									aria-label={formatMessage({ defaultMessage: 'Go to step {step}' }, { step: index + 1 })}
									aria-current={index === activeStep ? 'true' : undefined}
									className={clsx(classes?.dot, mobileStepperClasses.dot, {
										[mobileStepperClasses.dotActive]: index === activeStep
									})}
								/>
							) : (
								<div
									key={index}
									className={clsx(classes?.dot, mobileStepperClasses.dot, {
										[mobileStepperClasses.dotActive]: index === activeStep
									})}
								/>
							)
						)}
					</div>
				)}
				{variant === 'progress' && (
					<LinearProgress
						className={clsx(classes?.progress, mobileStepperClasses.progress)}
						variant="determinate"
						value={Math.ceil((activeStep / (steps - 1)) * 100)}
						{...LinearProgressProps}
					/>
				)}
				{nextButton}
			</Paper>
		);
	}
);

export const MobileStepper = styled(UnstyledMobileStepper, { name: mobileStepperClasses.root })(({ theme }) => ({
	display: 'flex',
	flexDirection: 'row',
	justifyContent: 'space-between',
	alignItems: 'center',
	background: theme.palette.background.default,
	padding: '8px',
	width: '100%',
	/* Styles applied to the root element if `position="bottom"`. */
	[`&.${mobileStepperClasses.positionBottom}`]: {
		position: 'fixed',
		bottom: 0,
		left: 0,
		right: 0,
		zIndex: theme.zIndex.mobileStepper
	},
	/* Styles applied to the root element if `position="top"`. */
	[`&.${mobileStepperClasses.positionTop}`]: {
		position: 'fixed',
		top: 0,
		left: 0,
		right: 0,
		zIndex: theme.zIndex.mobileStepper
	},
	/* Styles applied to the dots container if `variant="dots"`. */
	[`& .${mobileStepperClasses.dots}`]: {
		display: 'flex',
		flexDirection: 'row',
		margin: 'auto'
	},
	/* Styles applied to each dot if `variant="dots"`. */
	[`& .${mobileStepperClasses.dot}`]: {
		backgroundColor: theme.palette.action.disabled,
		borderRadius: '50%',
		width: 8,
		height: 8,
		margin: '0 2px',
		border: 0,
		padding: 0,
		display: 'block'
	},
	/* Clickable dots keep an 8px mark and a 24px hit target (WCAG 2.5.8). */
	[`& button.${mobileStepperClasses.dot}`]: {
		backgroundColor: 'transparent',
		width: 24,
		height: 24,
		margin: 0,
		cursor: 'pointer',
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		'&::before': {
			content: '""',
			width: 8,
			height: 8,
			borderRadius: '50%',
			backgroundColor: theme.palette.text.secondary
		}
	},
	/* Styles applied to a dot if `variant="dots"` and this is the active step. */
	[`& .${mobileStepperClasses.dotActive}`]: {
		backgroundColor: RedColor
	},
	[`& button.${mobileStepperClasses.dotActive}`]: {
		backgroundColor: 'transparent',
		'&::before': {
			backgroundColor: RedColor
		}
	},
	/* Styles applied to the Linear Progress component if `variant="progress"`. */
	[`& .${mobileStepperClasses.progress}`]: {
		width: '50%'
	}
}));

export default MobileStepper;
