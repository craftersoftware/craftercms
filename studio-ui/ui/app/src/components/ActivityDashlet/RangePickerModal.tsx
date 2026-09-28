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

import useSpreadState from '../../hooks/useSpreadState';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import { FormattedMessage } from 'react-intl';
import DialogContent from '@mui/material/DialogContent';
import Box from '@mui/material/Box';
import { AdapterMoment as DateAdapter } from '@mui/x-date-pickers/AdapterMoment';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import Stack from '@mui/material/Stack';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import DialogActions from '@mui/material/DialogActions';
import SecondaryButton from '../SecondaryButton';
import PrimaryButton from '../PrimaryButton';
import React, { useState } from 'react';
import moment, { Moment } from 'moment-timezone';

interface RangePickerModalProps {
	open: boolean;
	onAccept?(from: Date, to: Date): void;
	onClose(): void;
	onSwitchToTimelineClick?(): void;
}

export function RangePickerModal(props: RangePickerModalProps) {
	const { open, onAccept, onClose, onSwitchToTimelineClick } = props;
	// Can't ever have data before the release of CrafterCMS 4.0.0
	const minDate = new Date('2022-03-30T00:00:00.000Z');
	const today = new Date();
	const [fromPickerOpen, setFromPickerOpen] = useState(false);
	const [toPickerOpen, setToPickerOpen] = useState(false);
	const [{ pickerDateFrom, pickerDateTo }, setState] = useSpreadState({
		openRangePicker: true,
		dateFrom: null,
		dateTo: null,
		pickerDateFrom: null,
		pickerDateTo: null
	});
	const onDatePickerChange = (field, value) => {
		value.setSeconds(0);
		value.setMilliseconds(0);
		setState({ [field]: value });
	};
	const onRangePickerAccept = () => {
		// Because of the reverse chronological nature of the timeline, people
		// may confuse or have a different mental model of what to/from is.
		// Here we make sure dates are always coherent with what's expected on the back.
		if (pickerDateFrom < pickerDateTo) {
			onAccept(pickerDateFrom, pickerDateTo);
		} else {
			onAccept(pickerDateTo, pickerDateFrom);
		}
	};
	const openFromPicker = () => setFromPickerOpen(true);
	const closeFromPicker = () => setFromPickerOpen(false);
	const openToPicker = () => setToPickerOpen(true);
	const closeToPicker = () => setToPickerOpen(false);
	return (
		<Dialog open={open} onClose={onClose} aria-labelledby="rangePickerModalTitle">
			<DialogTitle id="rangePickerModalTitle">
				<FormattedMessage id="activityDashlet.selectRangeModalTitle" defaultMessage="Select Date Range" />
			</DialogTitle>
			<DialogContent>
				<Box sx={{ pt: 1 }}>
					<LocalizationProvider dateAdapter={DateAdapter}>
						<Stack direction="row" spacing={1}>
							<DateTimePicker
								open={fromPickerOpen}
								onOpen={openFromPicker}
								onClose={closeFromPicker}
								onAccept={closeFromPicker}
								label={<FormattedMessage id="words.from" defaultMessage="From" />}
								minDate={moment(minDate)}
								slotProps={{
									textField: {
										onClick: openFromPicker,
										slotProps: {
											input: {
												onChange: (e) => e.preventDefault()
											}
										}
									}
								}}
								value={moment(pickerDateFrom)}
								onChange={(arg) => {
									let newValue: Moment = arg as any;
									newValue.isValid() && onDatePickerChange('pickerDateFrom', newValue.toDate());
								}}
							/>
							<DateTimePicker
								open={toPickerOpen}
								onOpen={openToPicker}
								onClose={closeToPicker}
								onAccept={closeToPicker}
								maxDate={moment(today)}
								minDate={moment(minDate)}
								label={<FormattedMessage id="words.to" defaultMessage="To" />}
								slotProps={{
									textField: {
										onClick: openToPicker,
										slotProps: {
											input: {
												onChange: (e) => e.preventDefault()
											}
										}
									}
								}}
								value={moment(pickerDateTo)}
								onChange={(arg) => {
									let newValue: Moment = arg as any;
									newValue.isValid() && onDatePickerChange('pickerDateTo', newValue.toDate());
								}}
							/>
						</Stack>
					</LocalizationProvider>
				</Box>
			</DialogContent>
			<DialogActions>
				{onSwitchToTimelineClick && (
					<SecondaryButton onClick={onSwitchToTimelineClick} sx={{ mr: 'auto' }}>
						<FormattedMessage id="activityDashlet.switchToTimeline" defaultMessage="Switch to timeline" />
					</SecondaryButton>
				)}
				<SecondaryButton onClick={onClose}>
					<FormattedMessage id="words.cancel" defaultMessage="Cancel" />
				</SecondaryButton>
				<PrimaryButton
					disabled={!(pickerDateFrom && pickerDateTo && pickerDateFrom.getTime() !== pickerDateTo.getTime())}
					onClick={onRangePickerAccept}
				>
					<FormattedMessage id="words.accept" defaultMessage="Accept" />
				</PrimaryButton>
			</DialogActions>
		</Dialog>
	);
}

export default RangePickerModal;
