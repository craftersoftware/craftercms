/*
 * Copyright (C) 2007-2023 Crafter Software Corporation. All Rights Reserved.
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

import { DuplicateSiteState, LookupTable } from '../../models';
import { DialogBody } from '../DialogBody';
import Box from '@mui/material/Box';
import { DialogFooter } from '../DialogFooter';
import Button from '@mui/material/Button';
import { FormattedMessage, useIntl } from 'react-intl';
import PrimaryButton from '../PrimaryButton';
import React, { MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/Edit';
import { keyframes } from '@emotion/react';
import { fadeIn } from 'react-animations';
import { ApiResponseErrorState } from '../ApiResponseErrorState';
import { CreateSiteDialogLoader } from '../CreateSiteDialog';
import { duplicate, fetchAll, fetchSite } from '../../services/sites';
import { setSiteCookie } from '../../utils/auth';
import { getSystemLink } from '../../utils/system';
import useEnv from '../../hooks/useEnv';
import { nnou } from '../../utils/object';
import { Subscription } from 'rxjs';
import useMount from '../../hooks/useMount';
import {
	cleanupGitBranch,
	cleanupSiteId,
	getSiteIdFromSiteName,
	siteIdExist,
	siteNameExist
} from '../CreateSiteDialog/utils';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormHelperText from '@mui/material/FormHelperText';
import BaseSiteForm from '../CreateSiteDialog/BaseSiteForm';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Alert from '@mui/material/Alert';
import useUpdateRefs from '../../hooks/useUpdateRefs';
import { useDispatch } from 'react-redux';
import { showSystemNotification } from '../../state/actions/system';
import { useEnhancedDialogContext } from '../EnhancedDialog';

interface DuplicateSiteDialogContainerProps {
	site: DuplicateSiteState;
	setSite: (site: Partial<DuplicateSiteState>) => void;
	handleClose(event?: React.MouseEvent, reason?: string): void;
	isSubmitting: boolean;
	onGoBack?(): void;
}

export function DuplicateSiteDialogContainer(props: DuplicateSiteDialogContainerProps) {
	const { site, setSite, handleClose, onGoBack, isSubmitting } = props;
	const [error, setError] = useState(null);
	const { authoringBase, useBaseDomain } = useEnv();
	const fieldsErrorsLookup: LookupTable<boolean> = useMemo(
		() => ({
			sourceSiteId: !site.sourceSiteId,
			siteName: !site.siteName || site.siteNameExist,
			siteId: !site.siteId || site.siteIdExist || site.invalidSiteId,
			description: false,
			gitBranch: false
		}),
		[site.invalidSiteId, site.siteId, site.siteIdExist, site.siteName, site.siteNameExist, site.sourceSiteId]
	);
	const [sourceSiteHasBlobStores, setSourceSiteHasBlobStores] = useState(null);
	const primaryButtonRef = useRef(null);
	const siteDuplicateSubscription = useRef<Subscription>(undefined);
	const [sites, setSites] = useState(null);
	const { updateSubmittingOrHasPendingChanges } = useEnhancedDialogContext();
	const fnRefs = useUpdateRefs({ updateSubmittingOrHasPendingChanges, handleClose });
	const mountedRef = useRef(true);
	const dispatch = useDispatch();
	const { formatMessage } = useIntl();

	const validateForm = () => {
		return !(
			!site.sourceSiteId ||
			!site.siteId ||
			site.siteIdExist ||
			!site.siteName ||
			site.siteNameExist ||
			site.invalidSiteId
		);
	};

	const duplicateSite = () => {
		updateSubmittingOrHasPendingChanges({ isSubmitting: true });
		siteDuplicateSubscription.current = duplicate({
			sourceSiteId: site.sourceSiteId,
			siteId: site.siteId,
			siteName: site.siteName,
			description: site.description,
			sandboxBranch: site.gitBranch,
			enableStaging: site.enableStaging,
			...(sourceSiteHasBlobStores && { readOnlyBlobStores: site.readOnlyBlobStores })
		}).subscribe({
			next: () => {
				siteDuplicateSubscription.current = null;
				if (mountedRef.current) {
					fnRefs.current.updateSubmittingOrHasPendingChanges({ isSubmitting: false });
					fnRefs.current.handleClose();
					setSiteCookie(site.siteId, useBaseDomain);
					window.location.href = getSystemLink({
						systemLinkId: 'preview',
						authoringBase,
						site: site.siteId,
						page: '/'
					});
				}
			},
			error: ({ response }) => {
				siteDuplicateSubscription.current = null;
				if (mountedRef.current) {
					setError(response.response);
					fnRefs.current.updateSubmittingOrHasPendingChanges({ isSubmitting: false });
				} else {
					console.error('Error duplicating site', response);
					dispatch(
						showSystemNotification({
							message: formatMessage({ defaultMessage: `Error creating site "{name}"` }, { name: site.siteName }),
							options: { variant: 'error' }
						})
					);
				}
			}
		});
	};

	const handleBack = () => {
		let back = site.selectedView - 1;
		setSite({ selectedView: back });
	};

	const handleErrorBack = () => {
		setError(null);
	};

	const handleFinish = (e: MouseEvent) => {
		e && e.preventDefault();
		if (site.selectedView === 0) {
			const isFormValid = validateForm();
			if (isFormValid && !site.siteIdExist) {
				setSite({ selectedView: 1 });
			} else {
				setSite({ submitted: true });
			}
		}
		if (site.selectedView === 1) {
			duplicateSite();
		}
	};

	const onKeyPress = (event: React.KeyboardEvent) => {
		if (event.key === 'Enter') {
			handleFinish(null);
		}
	};

	function checkSites(event: any) {
		setSite({ siteIdExist: siteIdExist(sites, event.target.value) });
	}

	function checkSiteNames(event: any) {
		setSite({ siteNameExist: siteNameExist(sites, event.target.value) });
	}

	const handleInputChange = (e: any) => {
		e.persist?.();
		if (e.target.name === 'sourceSiteId') {
			setSite({ [e.target.name]: e.target.value, ...(sourceSiteHasBlobStores && { readOnlyBlobStores: true }) });
		} else if (e.target.name === 'siteId') {
			const invalidSiteId =
				e.target.value.startsWith('0') || e.target.value.startsWith('-') || e.target.value.startsWith('_');
			const siteId = cleanupSiteId(e.target.value);
			setSite({
				[e.target.name]: siteId,
				invalidSiteId: invalidSiteId
			});
		} else if (e.target.name === 'siteName') {
			const currentSiteNameParsed = getSiteIdFromSiteName(site.siteName);

			// if current siteId has been edited directly (different to siteName processed)
			// or if siteId is empty -> do not change it.
			if (site.siteId === currentSiteNameParsed || site.siteId === '') {
				const siteId = getSiteIdFromSiteName(e.target.value);
				const invalidSiteId = siteId.startsWith('0') || siteId.startsWith('-') || siteId.startsWith('_');
				const siteIdExist = Boolean(sites.find((site: any) => site.id === siteId));
				setSite({
					[e.target.name]: e.target.value,
					siteId,
					invalidSiteId,
					siteIdExist
				});
			} else {
				setSite({ [e.target.name]: e.target.value });
			}
		} else if (e.target.name === 'gitBranch') {
			setSite({ [e.target.name]: cleanupGitBranch(e.target.value) });
		} else if (e.target.type === 'checkbox') {
			setSite({ [e.target.name]: e.target.checked });
		} else {
			setSite({ [e.target.name]: e.target.value });
		}
	};

	useMount(() => {
		mountedRef.current = true;
		if (sites === null) {
			fetchAll({ limit: 1000, offset: 0 }).subscribe(setSites);
		}
		return () => {
			mountedRef.current = false;
			siteDuplicateSubscription.current?.unsubscribe();
		};
	});

	useEffect(() => {
		if (site.sourceSiteId) {
			fetchSite(site.sourceSiteId).subscribe({
				next: ({ blobStores }) => {
					setSourceSiteHasBlobStores(nnou(blobStores) && blobStores.length > 0);
				},
				error: ({ response }) => {
					setError(response.response);
				}
			});
		}
	}, [site?.sourceSiteId, setError]);

	useEffect(() => {
		if (primaryButtonRef && primaryButtonRef.current && site.selectedView === 1) {
			primaryButtonRef.current.focus();
		}
	}, [site.selectedView]);

	return (
		<>
			<DialogBody>
				{error ? (
					<Box sx={{ height: '100%', display: 'flex', justifyContent: 'center' }}>
						<ApiResponseErrorState error={error} onButtonClick={handleErrorBack} />
					</Box>
				) : isSubmitting ? (
					<CreateSiteDialogLoader
						title={<FormattedMessage defaultMessage="Duplicating Project" />}
						handleClose={() => {
							// Avoid cancelling the request if the user sends to background.
							siteDuplicateSubscription.current = null;
							handleClose();
							updateSubmittingOrHasPendingChanges({ hasPendingChanges: false, isSubmitting: false });
						}}
					/>
				) : (
					<Box
						sx={{
							flexWrap: 'wrap',
							height: '100%',
							overflow: 'auto',
							display: 'flex',
							padding: '25px',
							animation: `${keyframes`${fadeIn}`} 1s`
						}}
					>
						{site.selectedView === 0 && (
							<Box component="form" sx={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}>
								<Grid container spacing={3}>
									<Grid size={12} data-field-id="sourceSiteId">
										<FormControl fullWidth>
											<InputLabel>
												<FormattedMessage defaultMessage="Project" />
											</InputLabel>
											<Select
												value={site.sourceSiteId}
												id="sourceSiteId"
												name="sourceSiteId"
												required
												label={<FormattedMessage defaultMessage="Project" />}
												onChange={handleInputChange}
												error={site.submitted && fieldsErrorsLookup['sourceSiteId']}
											>
												<MenuItem value="">Select project</MenuItem>
												{sites?.map((siteObj) => (
													<MenuItem key={siteObj.uuid} value={siteObj.id}>
														{siteObj.name}
													</MenuItem>
												))}
											</Select>
											{site.submitted && !site.sourceSiteId && (
												<FormHelperText error>
													<FormattedMessage defaultMessage="Source project is required" />
												</FormHelperText>
											)}
										</FormControl>
									</Grid>
									<BaseSiteForm
										inputs={site}
										fieldsErrorsLookup={fieldsErrorsLookup}
										checkSites={checkSites}
										checkSiteNames={checkSiteNames}
										handleInputChange={handleInputChange}
										onKeyPress={onKeyPress}
										sourceProjectStagingHelp
									/>
									{sourceSiteHasBlobStores && (
										<Grid size={12} data-field-id="readOnlyBlobStores">
											<FormControlLabel
												control={
													<Switch
														name="readOnlyBlobStores"
														checked={site.readOnlyBlobStores}
														color="primary"
														onChange={handleInputChange}
													/>
												}
												label={<FormattedMessage defaultMessage="Read-only Blob Stores" />}
											/>
											<Alert severity={site.readOnlyBlobStores ? 'info' : 'warning'} icon={false} sx={{ mt: 1 }}>
												<Typography>
													<FormattedMessage defaultMessage="Content stored in blob stores is shared between the original site and the copy" />
												</Typography>
											</Alert>
										</Grid>
									)}
								</Grid>
							</Box>
						)}
						{site.selectedView === 1 && (
							<Grid container spacing={3} sx={{ maxWidth: '600px', margin: 'auto' }}>
								<Grid size={12}>
									<Typography variant="h6" gutterBottom sx={{ mb: onGoBack ? 0 : null }}>
										<FormattedMessage defaultMessage="Creation Strategy" />
										{onGoBack && (
											<IconButton
												onClick={onGoBack}
												size="large"
												sx={{
													color: (theme) => theme.palette.primary.main,
													'& svg': {
														fontSize: '1.2rem'
													}
												}}
											>
												<EditIcon />
											</IconButton>
										)}
									</Typography>
									<div>
										<Typography variant="body2" gutterBottom>
											<FormattedMessage defaultMessage="Duplicate Project" />
										</Typography>
										<Typography variant="body2" gutterBottom>
											<span>
												<FormattedMessage defaultMessage="Source project" />:{' '}
											</span>{' '}
											{site.sourceSiteId}
										</Typography>
									</div>
								</Grid>
								<Grid size={12}>
									<Typography variant="h6" gutterBottom>
										<FormattedMessage defaultMessage="Project Info" />
										<IconButton
											onClick={handleBack}
											size="large"
											sx={{
												color: (theme) => theme.palette.primary.main,
												'& svg': {
													fontSize: '1.2rem'
												}
											}}
										>
											<EditIcon />
										</IconButton>
									</Typography>
									<Typography variant="body2" gutterBottom noWrap>
										<span>
											<FormattedMessage defaultMessage="Project Name" />:{' '}
										</span>
										{site.siteName}
									</Typography>
									<Typography variant="body2" gutterBottom>
										<span>
											<FormattedMessage defaultMessage="Project ID" />:{' '}
										</span>
										{site.siteId}
									</Typography>
									<Typography variant="body2" gutterBottom>
										<span>
											<FormattedMessage defaultMessage="Description" />:{' '}
										</span>
										{site.description ? (
											site.description
										) : (
											<span>
												(<FormattedMessage defaultMessage="No description supplied" />)
											</span>
										)}
									</Typography>
									<Typography variant="body2" gutterBottom>
										<span>
											<FormattedMessage defaultMessage="Git Branch" />:
										</span>
										{` ${site.gitBranch ? site.gitBranch : 'master'}`}
									</Typography>
									<Typography variant="body2" gutterBottom>
										<span>
											<FormattedMessage defaultMessage="Enable staging" />:{' '}
										</span>
										{site.enableStaging ? (
											<FormattedMessage defaultMessage="Yes" />
										) : (
											<FormattedMessage defaultMessage="No" />
										)}
									</Typography>
									{sourceSiteHasBlobStores && (
										<Typography variant="body2" gutterBottom>
											<span>
												<FormattedMessage defaultMessage="Blob Stores mode" />:{' '}
											</span>
											{site.readOnlyBlobStores ? (
												<FormattedMessage defaultMessage="Read-only" />
											) : (
												<FormattedMessage defaultMessage="Read-write" />
											)}
										</Typography>
									)}
								</Grid>
							</Grid>
						)}
					</Box>
				)}
			</DialogBody>
			{!isSubmitting && !error && (
				<DialogFooter>
					{(site.selectedView === 1 || onGoBack) && (
						<Button
							color="primary"
							variant="outlined"
							onClick={(e) => {
								if (onGoBack && site.selectedView === 0) {
									onGoBack();
								} else {
									handleBack();
								}
							}}
						>
							<FormattedMessage defaultMessage="Back" />
						</Button>
					)}
					<PrimaryButton ref={primaryButtonRef} onClick={handleFinish}>
						{site.selectedView === 0 && <FormattedMessage defaultMessage="Review" />}
						{site.selectedView === 1 && <FormattedMessage defaultMessage="Duplicate Project" />}
					</PrimaryButton>
				</DialogFooter>
			)}
		</>
	);
}

export default DuplicateSiteDialogContainer;
