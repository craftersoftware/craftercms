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

import React, { SyntheticEvent, useEffect, useId, useRef, useState } from 'react';
import EnhancedDialog, { EnhancedDialogProps, useEnhancedDialogContext } from '../EnhancedDialog';
import { FormattedMessage, useIntl } from 'react-intl';
import { useDispatch } from 'react-redux';
import GlobalState from '../../models/GlobalState';
import useUpdateRefs from '../../hooks/useUpdateRefs';
import DialogBody from '../DialogBody';
import DateTimeTimezonePicker, { DateTimeTimezonePickerProps } from '../DateTimeTimezonePicker/DateTimeTimezonePicker';
import DialogFooter from '../DialogFooter';
import SecondaryButton from '../SecondaryButton';
import PrimaryButton from '../PrimaryButton';
import useSelection from '../../hooks/useSelection';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import Box from '@mui/material/Box';
import Chip, { ChipProps } from '@mui/material/Chip';
import { MenuProps as MuiMenuProps } from '@mui/material/Menu';
import useSiteList from '../../hooks/useSiteList';
import { Theme, useTheme } from '@mui/material/styles';
import MenuItem from '@mui/material/MenuItem';
import { FormHelperText } from '@mui/material';
import FormLabel from '@mui/material/FormLabel';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import { encrypt } from '../../services/security';
import { copyToClipboard, pushErrorDialog } from '../../utils/system';
import { showSystemNotification } from '../../state/actions/system';
import useSitesBranch from '../../hooks/useSitesBranch';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import hljs from '../../env/hljs';
import useEnv from '../../hooks/useEnv';
import useActiveSiteId from '../../hooks/useActiveSiteId';

interface BodyProps extends Pick<EnhancedDialogProps, 'isSubmitting' | 'onClose'> {
	onTokenGenerated?(token: string): void;
}

export interface CreateTokenDialogProps extends EnhancedDialogProps, BodyProps {}

export function CreatePreviewTokenDialog(props: CreateTokenDialogProps) {
	const { onTokenGenerated, ...rest } = props;

	return (
		<EnhancedDialog
			title={<FormattedMessage defaultMessage="Create Preview Token" />}
			subtitle={<FormattedMessage defaultMessage="Authorize external applications to access project preview" />}
			maxWidth="sm"
			{...rest}
		>
			<Body onTokenGenerated={onTokenGenerated} isSubmitting={props.isSubmitting} />
		</EnhancedDialog>
	);
}

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps: Partial<MuiMenuProps> = {
	slotProps: {
		paper: {
			style: {
				maxHeight: ITEM_HEIGHT * 6.5 + ITEM_PADDING_TOP,
				width: 250
			}
		}
	}
};

const COOKIE_NAME = 'crafterPreview';
const HEADER_NAME = 'X-Crafter-Preview';

function getStyles(name: string, personName: readonly string[], theme: Theme) {
	return {
		fontWeight: personName.includes(name) ? theme.typography.fontWeightMedium : theme.typography.fontWeightRegular
	};
}

const templates = {
	js: `// Setting the cookie
document.cookie = "${COOKIE_NAME}={token}; path=/; expires={expiresAt}";

// Setting the header
const headers = { '${HEADER_NAME}': "{rawToken}" };

// QSA
window.location.href = "{domain}?${COOKIE_NAME}={token}";`,
	express: `// Setting the cookie
res.cookie('${COOKIE_NAME}', '{rawToken}', { path: '/', expires: new Date({time}), httpOnly: true });

// Setting the header
res.setHeader('${HEADER_NAME}', '{rawToken}');

// QSA
res.redirect('{domain}?${COOKIE_NAME}={token}');`,
	next: `// Setting the cookie
res.setHeader('Set-Cookie', '${COOKIE_NAME}={rawToken}; Path=/; Expires={expiresAt}; HttpOnly; Secure');

// Setting the header
res.setHeader('${HEADER_NAME}', '{rawToken}');

// QSA
return { redirect: { destination: '{domain}?${COOKIE_NAME}={token}', permanent: false } }`,
	curl: `curl --header "cookie: ${COOKIE_NAME}={token};" "{domain}/api/1/site/content_store/item.json?url=/site/website/index.xml&crafterSite={site}"`
};

type TabKeys = keyof typeof templates;

const getInitialDate = () => {
	const date = new Date();
	date.setMonth(date.getMonth() + 1);
	return date;
};

function Body(props: BodyProps) {
	const { isSubmitting, onTokenGenerated, onClose } = props;
	const id = useId();
	const siteId = useActiveSiteId();
	const [expiresAt, setExpiresAt] = useState(getInitialDate);
	const [open, setOpen] = useState(false);
	const [tab, setTab] = useState<TabKeys>('js');
	const [token, setToken] = useState<string>();
	const siteLookup = useSitesBranch().byId;
	const { guestBase } = useEnv();
	const sites = useSiteList();
	const { formatMessage } = useIntl();
	const dispatch = useDispatch();

	const locale = useSelection<GlobalState['uiConfig']['locale']>((state) => state.uiConfig.locale);
	const { updateSubmittingOrHasPendingChanges } = useEnhancedDialogContext();
	const functionRefs = useUpdateRefs({ updateSubmittingOrHasPendingChanges });
	const chipsContainerRef = useRef<HTMLDivElement>(undefined);

	const theme = useTheme();
	const [projects, setProjects] = React.useState<string[]>([]);
	const allProjectsSelected = projects.includes('*');

	const valid = projects.length > 0;

	const handleProjectsChange = (event: SelectChangeEvent<typeof projects>) => {
		const {
			target: { value }
		} = event;
		if (value.includes?.('*')) {
			setProjects(['*']);
			return;
		}
		setProjects(
			// On autofill we get a stringified value.
			typeof value === 'string' ? value.split(',') : value
		);
	};

	const handleChipDeleteButton = (e: SyntheticEvent, projectId: string) => {
		e.stopPropagation();
		setProjects(projects.filter((p) => p !== projectId));
	};

	const handleChipClick: ChipProps['onClick'] = () => {
		setOpen(true);
	};

	const handleSubmit = (e) => {
		e.preventDefault();
		e.stopPropagation();
		if (!valid) return;
		functionRefs.current.updateSubmittingOrHasPendingChanges({ isSubmitting: true });
		encrypt(`${projects.join(',')}|${expiresAt.getTime()}`).subscribe({
			next(token) {
				functionRefs.current.updateSubmittingOrHasPendingChanges({ isSubmitting: false, hasPendingChanges: false });
				onTokenGenerated?.(token);
				setToken(token);
				copy(token, false);
			},
			error(response) {
				functionRefs.current.updateSubmittingOrHasPendingChanges({ isSubmitting: false });
				dispatch(pushErrorDialog({ props: { error: response } }));
			}
		});
	};

	const handleClose = (e) => onClose(e, null);

	const handleDateChange: DateTimeTimezonePickerProps['onChange'] = (date) => {
		setExpiresAt(date);
	};

	const handleTabChanged = (event: SyntheticEvent, newValue: TabKeys) => {
		setTab(newValue);
	};

	const copy = (
		value: string,
		message: string | boolean = formatMessage({ defaultMessage: 'Value copied to clipboard' })
	) => {
		copyToClipboard(value).then(() => {
			typeof message === 'string' && dispatch(showSystemNotification({ message }));
		});
	};

	useEffect(() => {
		functionRefs.current.updateSubmittingOrHasPendingChanges({ hasPendingChanges: projects.length > 0 });
	}, [functionRefs, projects]);

	const selectLabel = formatMessage({ defaultMessage: 'Projects' });
	const cookieSettingCode = token
		? templates[tab]
				.replaceAll(
					'{token}',
					encodeURIComponent(token).replace(/%(2[346BF]|3[AC-F]|40|5[BDE]|60|7[BCD])/g, decodeURIComponent)
				)
				.replaceAll(
					'{rawToken}',
					encodeURIComponent(token).replace(/%(2[346BF]|3[AC-F]|40|5[BDE]|60|7[BCD])/g, decodeURIComponent)
				)
				.replaceAll('{expiresAt}', expiresAt.toUTCString())
				.replaceAll('{time}', String(expiresAt.getTime()))
				.replaceAll('{domain}', guestBase)
				.replaceAll('{site}', siteId)
		: '';

	return token ? (
		<>
			<DialogBody>
				<Alert variant="outlined" severity="success" sx={{ border: 'none' }}>
					<FormattedMessage defaultMessage="Token was created and copied to your clipboard, please store it securely. Preview tokens are not stored or displayed anywhere." />
				</Alert>
				<Box sx={{ mb: 2 }}>
					<InputLabel sx={{ ml: 1, mb: 0.5 }}>
						<FormattedMessage defaultMessage="Token" />
					</InputLabel>
					<OutlinedInput
						readOnly
						fullWidth
						value={token}
						onClick={(e) => {
							(e.target as HTMLInputElement).select();
							copy(token);
						}}
					/>
				</Box>

				<Box sx={{ ml: 1 }}>
					<Typography>
						<FormattedMessage defaultMessage="Here are the ways to use the token" />
					</Typography>
					<Typography variant="body2" component="div">
						<ul>
							<li>
								<FormattedMessage
									defaultMessage="Set a cookie with the name <c>{name}</c>"
									values={{
										name: COOKIE_NAME,
										c: (name) => <code>{name}</code>
									}}
								/>
							</li>
							<li>
								<FormattedMessage
									defaultMessage="Add a query string argument with the name <c>{name}</c>"
									values={{
										name: COOKIE_NAME,
										c: (name) => <code>{name}</code>
									}}
								/>
							</li>
							<li>
								<FormattedMessage
									defaultMessage="Set a header with the name <c>{name}</c>"
									values={{
										name: HEADER_NAME,
										c: (name) => <code>{name}</code>
									}}
								/>
							</li>
						</ul>
					</Typography>
				</Box>

				<Tabs value={tab} onChange={handleTabChanged}>
					<Tab label="JavaScript" value="js" autoFocus />
					<Tab label="Express" value="express" />
					<Tab label="NextJS" value="next" />
					<Tab label="Curl" value="curl" />
				</Tabs>
				<Box>
					<Box
						component="pre"
						sx={{ width: '100%', overflow: 'auto', bgcolor: 'background.paper', p: 1, borderRadius: 1 }}
						onClick={() => {
							copy(cookieSettingCode);
						}}
					>
						<code
							dangerouslySetInnerHTML={{
								__html: hljs.highlight(cookieSettingCode, { language: tab === 'curl' ? 'plaintext' : 'js' }).value
							}}
						/>
					</Box>
				</Box>
			</DialogBody>
			<DialogFooter sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
				<SecondaryButton
					onClick={() => {
						setToken(undefined);
						setProjects([]);
						setExpiresAt(getInitialDate());
						setTab('js');
					}}
				>
					<FormattedMessage defaultMessage="Start over" />
				</SecondaryButton>
				<SecondaryButton onClick={handleClose}>
					<FormattedMessage defaultMessage="Done" />
				</SecondaryButton>
			</DialogFooter>
		</>
	) : (
		<form onSubmit={handleSubmit}>
			<DialogBody>
				<FormControl fullWidth sx={{ mb: 2 }} disabled={isSubmitting}>
					<InputLabel id={`${id}_label`}>{selectLabel}</InputLabel>
					<Select
						autoFocus
						labelId={`${id}_label`}
						id={id}
						multiple
						value={projects}
						open={open}
						onChange={handleProjectsChange}
						onOpen={(e) => {
							// @ts-expect-error: The key prop is present when this is called via keyboard event.
							if (e.key === 'Enter' && valid) {
								handleSubmit(e);
								return;
							}
							// This allows chip click to occur, otherwise is swallowed by the Select open event somehow.
							setOpen(
								e.target === chipsContainerRef.current || !chipsContainerRef.current?.contains(e.target as HTMLElement)
							);
						}}
						onClose={() => setOpen(false)}
						input={<OutlinedInput label={selectLabel} />}
						MenuProps={MenuProps}
						renderValue={(selected) => (
							<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }} ref={chipsContainerRef}>
								{allProjectsSelected ? (
									<Chip
										key="*"
										label={<FormattedMessage defaultMessage="All Projects" />}
										onDelete={(e) => handleChipDeleteButton(e, '*')}
										onClick={handleChipClick}
									/>
								) : (
									selected
										.filter((value) => value !== '*')
										.map((value) => (
											<Chip
												key={value}
												label={siteLookup[value]?.name ?? <FormattedMessage defaultMessage="All Projects" />}
												onDelete={(e) => handleChipDeleteButton(e, value)}
												onClick={handleChipClick}
											/>
										))
								)}
							</Box>
						)}
					>
						<MenuItem value="*" style={getStyles('all', projects, theme)}>
							<FormattedMessage defaultMessage="All Projects" />
						</MenuItem>
						{sites.map(({ id, name }) => (
							<MenuItem key={id} value={id} style={getStyles(name, projects, theme)}>
								{name}
							</MenuItem>
						))}
					</Select>
					<FormHelperText>
						<FormattedMessage defaultMessage="Select which projects this token grants preview access" />
					</FormHelperText>
				</FormControl>

				<FormControl component="fieldset" disabled={isSubmitting}>
					<FormLabel component="legend">
						<FormattedMessage defaultMessage="Expiration Date" />
					</FormLabel>
					<DateTimeTimezonePicker
						disabled={isSubmitting}
						onChange={handleDateChange}
						value={expiresAt}
						disablePast
						localeCode={locale.localeCode}
						dateTimeFormatOptions={locale.dateTimeFormatOptions}
					/>
				</FormControl>

				<Divider sx={{ mx: -2, my: 1 }} />
				<Alert severity="warning" variant="outlined" sx={{ py: 0.5, border: 'none' }}>
					<FormattedMessage defaultMessage="Once generated, store securely. You won’t be able to see it’s value again." />
				</Alert>
			</DialogBody>
			<DialogFooter>
				<SecondaryButton onClick={handleClose}>
					<FormattedMessage id="words.cancel" defaultMessage="Cancel" />
				</SecondaryButton>
				<PrimaryButton
					type="submit"
					autoFocus
					disabled={isSubmitting || !valid}
					loading={isSubmitting}
					onClick={handleSubmit}
				>
					<FormattedMessage defaultMessage="Generate" />
				</PrimaryButton>
			</DialogFooter>
		</form>
	);
}

export default CreatePreviewTokenDialog;
