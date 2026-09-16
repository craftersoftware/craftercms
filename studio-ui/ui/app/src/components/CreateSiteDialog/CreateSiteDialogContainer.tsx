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

import React, { ChangeEvent, MouseEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import useSpreadState from '../../hooks/useSpreadState';
import useEnv from '../../hooks/useEnv';
import { CreateSiteMeta, LookupTable, MarketplacePlugin, MarketplaceSite, SiteState, Views } from '../../models';
import {
	createSite as createSiteFromMarketplace,
	fetchBlueprints as fetchMarketplaceBlueprintsService
} from '../../services/marketplace';
import { setRequestForgeryToken, setSiteCookie } from '../../utils/auth';
import { Subscription } from 'rxjs';
import { create, exists, fetchBlueprints as fetchBuiltInBlueprints } from '../../services/sites';
import { getSystemLink } from '../../utils/system';
import Grid from '@mui/material/Grid';
import PluginCard from '../PluginCard';
import ConfirmDialog from '../ConfirmDialog';
import LoadingState from '../LoadingState';
import ApiResponseErrorState from '../ApiResponseErrorState';
import PluginDetailsView from '../PluginDetailsView';
import DialogHeader from '../DialogHeader';
import DialogBody from '../DialogBody';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import SearchIcon from '@mui/icons-material/Search';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import SearchBar from '../SearchBar';
import Box from '@mui/material/Box';
import SignalWifiBadRounded from '@mui/icons-material/SignalWifiBadRounded';
import Button from '@mui/material/Button';
import EmptyState from '../EmptyState';
import BlueprintForm from './BlueprintForm';
import BlueprintReview from './BlueprintReview';
import DialogFooter from '../DialogFooter';
import PrimaryButton from '../PrimaryButton';
import messages from './translations';
import { hasGlobalPermissions } from '../../services/users';
import SecondaryButton from '../SecondaryButton';
import useMount from '../../hooks/useMount';
import ContentCopyIcon from '@mui/icons-material/ContentCopyRounded';
import GitFilled from '../../icons/GitFilled';
import { previewSwitch } from '../../services/security';
import { keyframes } from '@emotion/react';
import { fadeIn } from 'react-animations';
import { extractErrorPayload } from '../../utils/ajax';

interface SearchState {
	searchKey: string;
	searchSelected: boolean;
}

interface DialogState {
	open: boolean;
	inProgress: boolean;
}

interface CreateSiteDialogContainerProps {
	site: SiteState;
	setSite(site: Partial<SiteState>): void;
	search: SearchState;
	setSearch(search: SearchState): void;
	handleClose(event?: React.MouseEvent, reason?: string): void;
	dialog: DialogState;
	setDialog(dialog: Partial<DialogState>): void;
	disableEnforceFocus: boolean;
	onShowDuplicate(): void;
}

const baseFormFields = ['siteName', 'siteId', 'description', 'gitBranch'];
const gitFormFields = ['repoUrl', 'repoRemoteName', 'repoUsername', 'repoPassword', 'repoToken', 'repoKey'];

export interface CreateSiteDialogLoaderProps {
	title?: ReactNode;
	subtitle?: ReactNode;
	handleClose(event?: React.MouseEvent, reason?: string): void;
}

export function CreateSiteDialogLoader(props: CreateSiteDialogLoaderProps) {
	const { title, subtitle, handleClose } = props;
	const { formatMessage } = useIntl();

	return (
		<Box sx={{ height: '100%' }}>
			<LoadingState
				title={title ?? formatMessage(messages.creatingSite)}
				subtitle={subtitle ?? formatMessage(messages.pleaseWait)}
				sxs={{
					root: {
						minHeight: 'calc(100% - 85px)',
						height: 'calc(100% - 85px)',
						margin: 0
					},
					graphicRoot: {
						flexGrow: 1,
						paddingBottom: '100px'
					},
					graphic: {
						width: 200
					}
				}}
			/>
			<Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
				<SecondaryButton sx={{ mb: 1 }} onClick={handleClose}>
					<FormattedMessage id="words.close" defaultMessage="Close" />
				</SecondaryButton>
				<Typography variant="body2" color="textSecondary">
					<FormattedMessage defaultMessage="Project creation will continue in the background" />
				</Typography>
			</Box>
		</Box>
	);
}

export function CreateSiteDialogContainer(props: CreateSiteDialogContainerProps) {
	const { site, setSite, search, setSearch, handleClose, dialog, setDialog, disableEnforceFocus, onShowDuplicate } =
		props;
	const [permissionsLookup, setPermissionsLookup] = useState<LookupTable<boolean>>({});
	const hasListPluginPermission = permissionsLookup['list_plugins'];

	const [blueprints, setBlueprints] = useState(null);
	const [marketplace, setMarketplace] = useState(null);
	const [apiState, setApiState] = useSpreadState({
		creatingSite: false,
		error: false,
		global: false,
		errorResponse: null,
		fetchingMarketplace: false,
		marketplaceError: false
	});

	const finishRef = useRef(null);
	const { current: refts } = useRef<any>({});
	refts.setSite = setSite;
	const { formatMessage } = useIntl();
	const { authoringBase, useBaseDomain } = useEnv();
	const siteCreateSubscription = useRef<Subscription>(undefined);
	const mounted = useRef(false);

	useMount(() => {
		setRequestForgeryToken();
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	});

	const views: Views = {
		0: {
			title: formatMessage(messages.createSite)
		},
		1: {
			title: formatMessage(messages.createSite),
			subtitle: formatMessage(messages.nameAndDescription),
			btnText: formatMessage(messages.review)
		},
		2: {
			title: formatMessage(messages.finish),
			subtitle: formatMessage(messages.reviewSite),
			btnText: formatMessage(messages.createSite)
		}
	};

	const fieldsErrorsLookup: LookupTable<boolean> = useMemo(() => {
		let map: LookupTable<boolean> = {
			siteName: !site.siteName || site.siteNameExist,
			siteId: !site.siteId || site.siteIdExist || site.invalidSiteId,
			description: false,
			gitBranch: false
		};

		if (site.blueprint?.parameters) {
			site.blueprint.parameters.forEach((parameter) => {
				map[parameter.name] = parameter.required && !site.blueprintFields[parameter.name];
			});
		}

		if (site.blueprint?.id === 'GIT') {
			map['repoUrl'] = !site.repoUrl;
			map['repoRemoteName'] = false;

			const type = site.repoAuthentication;
			if (type === 'basic') {
				map['repoUsername'] = !site.repoUsername;
			}
			if (type === 'basic') {
				map['repoPassword'] = !site.repoPassword;
			}
			if (type === 'token') {
				map['repoToken'] = !site.repoToken;
			}
			if (type === 'private_key') {
				map['repoKey'] = !site.repoKey;
			}
		}

		return map;
	}, [site]);

	const scrollToErrorInput = () => {
		const formFields = [
			...baseFormFields,
			...(site.blueprint?.parameters?.map((parameter) => parameter.name) ?? []),
			...(site.blueprint?.id === 'GIT' ? gitFormFields : [])
		];

		const firstFieldWithError = formFields.find((field) => fieldsErrorsLookup[field]);
		if (firstFieldWithError) {
			const element = document.querySelector(`[data-field-id="${firstFieldWithError}"]`);
			element?.scrollIntoView({ behavior: 'smooth' });
		}
	};

	function filterBlueprints(blueprints: MarketplacePlugin[], searchKey: string) {
		searchKey = searchKey.toLowerCase();
		return searchKey && blueprints
			? blueprints.filter((blueprint) => blueprint.name.toLowerCase().includes(searchKey))
			: blueprints;
	}

	const filteredMarketplace: MarketplacePlugin[] = filterBlueprints(marketplace, search.searchKey);

	const fetchMarketplaceBlueprints = useCallback(() => {
		setApiState({ fetchingMarketplace: true });
		return fetchMarketplaceBlueprintsService({
			showIncompatible: site.showIncompatible
		}).subscribe({
			next: (plugins) => {
				setApiState({ marketplaceError: false, fetchingMarketplace: false });
				setMarketplace(plugins);
			},
			error: ({ response }) => {
				if (response) {
					setApiState({
						creatingSite: false,
						error: true,
						marketplaceError: response.response,
						fetchingMarketplace: false
					});
				}
			}
		});
	}, [setApiState, site?.showIncompatible]);

	function handleCloseDetails() {
		setSite({ details: { blueprint: null, index: null } });
	}

	function handleErrorBack() {
		setApiState({ error: false, global: false });
	}

	function handleSearchClick() {
		setSearch({ ...search, searchSelected: !search.searchSelected, searchKey: '' });
	}

	function handleOnSearchChange(searchKey: string) {
		setSearch({ ...search, searchKey });
	}

	function handleBlueprintSelected(blueprint: MarketplacePlugin, view: number) {
		if (blueprint.id === 'GIT') {
			setSite({
				selectedView: view,
				submitted: false,
				blueprint: blueprint,
				pushSite: false,
				createAsOrphan: false,
				details: { blueprint: null, index: null }
			});
		} else if (blueprint.source === 'GIT') {
			setSite({
				selectedView: view,
				submitted: false,
				blueprint: blueprint,
				pushSite: false,
				createAsOrphan: true,
				details: { blueprint: null, index: null }
			});
		} else if (blueprint.id === 'DUPLICATE') {
			handleClose();
			onShowDuplicate();
		} else {
			setSite({
				selectedView: view,
				submitted: false,
				blueprint: blueprint,
				createAsOrphan: true,
				details: { blueprint: null, index: null }
			});
		}
	}

	function handleBack() {
		let back = site.selectedView - 1;
		setSite({ selectedView: back });
	}

	function handleGoTo(step: number) {
		setSite({ selectedView: step });
	}

	function handleFinish(e: MouseEvent) {
		e && e.preventDefault();
		if (site.selectedView === 1) {
			const isFormValid = validateForm();
			if (isFormValid && !site.siteIdExist) {
				setSite({ selectedView: 2 });
			} else {
				setSite({ submitted: true });
				if (!isFormValid) {
					scrollToErrorInput();
				}
			}
		}
		if (site.selectedView === 2) {
			setApiState({ creatingSite: true });
			// it is a marketplace plugin
			if (site.blueprint.source === 'GIT') {
				const marketplaceParams: MarketplaceSite = createMarketplaceParams();
				createNewSiteFromMarketplace(marketplaceParams);
			} else {
				const blueprintParams = createParams();
				createSite(blueprintParams);
			}
		}
	}

	function handleShowIncompatibleChange(e: ChangeEvent<HTMLInputElement>) {
		setMarketplace(null);
		setSite({ showIncompatible: e.target.checked });
	}

	function checkAdditionalFields() {
		let valid = true;
		if (site.blueprint.parameters) {
			site.blueprint.parameters.forEach((parameter: any) => {
				if (parameter.required && !site.blueprintFields[parameter.name]) {
					valid = false;
				}
			});
		}
		return valid;
	}

	function validateForm() {
		if (!site.siteId || site.siteIdExist || !site.siteName || site.siteNameExist || site.invalidSiteId) {
			return false;
		} else if (!site.repoUrl && site.blueprint.id === 'GIT') {
			return false;
		} else if (site.pushSite || site.blueprint.id === 'GIT') {
			if (!site.repoUrl) return false;
			else if (site.repoAuthentication === 'basic' && (!site.repoUsername || !site.repoPassword)) return false;
			else if (site.repoAuthentication === 'token' && !site.repoToken) return false;
			else return !(site.repoAuthentication === 'private_key' && !site.repoKey);
		} else {
			return checkAdditionalFields();
		}
	}

	function createMarketplaceParams() {
		const params: MarketplaceSite = {
			siteId: site.siteId,
			name: site.siteName,
			description: site.description,
			blueprintId: site.blueprint.id,
			blueprintVersion: {
				major: site.blueprint.version.major,
				minor: site.blueprint.version.minor,
				patch: site.blueprint.version.patch
			}
		};
		if (site.gitBranch) params.sandboxBranch = site.gitBranch as string;
		if (site.blueprintFields) params.siteParams = site.blueprintFields;
		return params;
	}

	function createParams() {
		if (site.blueprint) {
			const params: CreateSiteMeta = {
				siteId: site.siteId,
				singleBranch: site.singleBranch,
				createAsOrphan: site.createAsOrphan,
				name: site.siteName,
				sourceType: 'blueprint',
				authentication: { type: 'none' }
			};
			if (site.blueprint.id !== 'GIT') {
				params.blueprintId = site.blueprint.id;
			} else {
				params.sourceType = 'remote';
			}
			if (site.gitBranch) params.sandboxBranch = site.gitBranch as string;
			if (site.description) params.description = site.description;
			if (site.pushSite || site.blueprint.id === 'GIT') {
				if (site.repoRemoteName) params.remoteName = site.repoRemoteName;
				if (site.repoUrl) params.remoteUrl = site.repoUrl;
				if (site.gitBranch) {
					params.remoteBranch = site.gitBranch as string;
				}

				const authentication: CreateSiteMeta['authentication'] = {
					type: site.repoAuthentication
				};

				if (site.repoAuthentication === 'basic') {
					authentication.username = site.repoUsername;
					authentication.password = site.repoPassword;
				}
				if (site.repoAuthentication === 'token') {
					authentication.token = site.repoToken;
				}
				if (site.repoAuthentication === 'private_key') {
					authentication.privateKey = site.repoKey;
				}

				params.authentication = authentication;
			}
			if (Object.keys(site.blueprintFields).length) params.siteParams = site.blueprintFields;
			return params;
		}
	}

	function createSite(site: CreateSiteMeta | MarketplaceSite, fromMarketplace = false) {
		const next = () => {
			siteCreateSubscription.current = null;
			if (mounted.current === true) {
				setApiState({ creatingSite: false });
				handleClose();
				// Prop differs between regular site and marketplace site due to API versions 1 vs 2 differences
				setSiteCookie(site.siteId, useBaseDomain);
				previewSwitch().subscribe(() => {
					window.location.href = getSystemLink({
						systemLinkId: 'preview',
						authoringBase,
						site: site.siteId,
						page: '/'
					});
				});
			}
		};
		const error = ({ response }) => {
			if (response) {
				if (fromMarketplace) {
					setApiState({
						creatingSite: false,
						error: true,
						errorResponse: response.response,
						global: true
					});
				} else {
					// TODO: I'm wrapping the API response as a API2 response, change it when create site is on API2
					const _response = { ...response, code: '', documentationUrl: '', remedialAction: '' };
					setApiState({
						creatingSite: false,
						error: true,
						errorResponse: _response,
						global: true
					});
				}
			}
		};
		if (fromMarketplace) {
			siteCreateSubscription.current = createSiteFromMarketplace(site as MarketplaceSite).subscribe({ next, error });
		} else {
			siteCreateSubscription.current = create(site as CreateSiteMeta).subscribe({ next, error });
		}
	}

	function createNewSiteFromMarketplace(site: MarketplaceSite) {
		createSite(site, true);
	}

	function checkNameExist(siteId: string) {
		if (siteId) {
			exists(siteId).subscribe(
				(exists) => {
					if (exists) {
						refts.setSite({ siteIdExist: exists, selectedView: 1 });
					} else {
						refts.setSite({ siteIdExist: false });
					}
				},
				({ response }) => {
					// TODO: I'm wrapping the API response as a API2 response, change it when create site is on API2
					const _response = { ...response, code: '', documentationUrl: '', remedialAction: '' };
					setApiState({ creatingSite: false, error: true, errorResponse: _response });
				}
			);
		}
	}

	function onDetails(blueprint: MarketplacePlugin, index: number) {
		setSite({ details: { blueprint: blueprint, index: index } });
	}

	function renderBlueprints(list: MarketplacePlugin[], isMarketplace: boolean = false) {
		return list.map((item: MarketplacePlugin) => {
			const isGitItem = item.id === 'GIT';
			const isDuplicateItem = item.id === 'DUPLICATE';
			const isGitOrDuplicateItem = isGitItem || isDuplicateItem;
			const disableCard = isDuplicateItem && !permissionsLookup['duplicate_site'];

			return (
				<Grid
					size={{ xs: 12, sm: 6, md: isGitOrDuplicateItem ? 6 : 4, lg: isGitOrDuplicateItem ? 6 : 3 }}
					key={item.id}
				>
					<PluginCard
						plugin={item}
						onPluginSelected={handleBlueprintSelected}
						isMarketplacePlugin={isMarketplace}
						onDetails={onDetails}
						disableCardActionClick={disableCard}
					/>
				</Grid>
			);
		});
	}

	function onConfirmOk() {
		handleClose(null, null);
	}

	function onConfirmCancel() {
		setDialog({ inProgress: false });
	}

	useEffect(() => {
		let subscriptions: Subscription[] = [];
		if (blueprints === null && !apiState.error) {
			subscriptions.push(
				fetchBuiltInBlueprints().subscribe({
					next: (blueprints) => {
						setBlueprints([
							{
								id: 'GIT',
								name: formatMessage(messages.gitBlueprintName),
								description: formatMessage(messages.gitBlueprintDescription),
								documentation: null,
								media: {
									screenshots: [
										{
											description: '',
											title: formatMessage(messages.gitBlueprintName),
											icon: <GitFilled fontSize="large" color="error" />
										}
									],
									videos: []
								}
							},
							{
								id: 'DUPLICATE',
								name: <FormattedMessage defaultMessage="Duplicate Project" />,
								description: <FormattedMessage defaultMessage="Create an exact copy of an existing Studio project." />,
								documentation: null,
								media: {
									screenshots: [
										{
											description: '',
											title: formatMessage(messages.gitBlueprintName),
											icon: <ContentCopyIcon fontSize="large" color="success" />
										}
									],
									videos: []
								}
							},
							...blueprints.map((bp) => bp.plugin)
						]);
					},
					error: ({ response }) => {
						if (response) {
							setApiState({ creatingSite: false, errorResponse: response.response });
						}
					}
				})
			);
		}
		if (finishRef && finishRef.current && site.selectedView === 2) {
			finishRef.current.focus();
		}
		return () => {
			subscriptions.forEach((sub) => sub.unsubscribe());
		};
	}, [apiState.error, blueprints, formatMessage, setApiState, site.selectedView]);

	useEffect(() => {
		let subscriptions: Subscription[] = [];
		hasGlobalPermissions('list_plugins', 'duplicate_site').subscribe((permissions) => {
			setPermissionsLookup(permissions);
			if (permissions['list_plugins'] && marketplace === null && !apiState.error) {
				subscriptions.push(fetchMarketplaceBlueprints());
			}
		});
		return () => {
			subscriptions.forEach((sub) => sub.unsubscribe());
		};
	}, [apiState.error, fetchMarketplaceBlueprints, marketplace]);

	return (
        <>
            <ConfirmDialog
				open={dialog.inProgress}
				onOk={onConfirmOk}
				onCancel={onConfirmCancel}
				body={formatMessage(messages.dialogCloseMessage)}
				title={formatMessage(messages.dialogCloseTitle)}
				disableEnforceFocus={disableEnforceFocus}
			/>
            {apiState.creatingSite || (apiState.error && apiState.global) || site.details.blueprint ? (
				(apiState.creatingSite && <CreateSiteDialogLoader handleClose={handleClose} />) ||
				(apiState.errorResponse && (
					<ApiResponseErrorState
						sxs={{ root: { height: '100%' } }}
						error={extractErrorPayload(apiState.errorResponse)}
						onButtonClick={handleErrorBack}
					/>
				)) ||
				(site.details && (
					<PluginDetailsView
						plugin={site.details.blueprint}
						selectedImageSlideIndex={site.details.index}
						onBlueprintSelected={handleBlueprintSelected}
						onCloseDetails={handleCloseDetails}
						changeImageSlideInterval={5000}
						isMarketplacePlugin={Boolean(site?.details.blueprint.url)}
					/>
				))
			) : (
				<Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
					<DialogHeader
						title={views[site.selectedView].title}
						subtitle={views[site.selectedView].subtitle}
						id="create-site-dialog"
						onCloseButtonClick={handleClose}
					/>

					{blueprints ? (
						<DialogBody sx={{ padding: 0 }}>
							{site.selectedView === 0 && (
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
									<Grid container spacing={3} sx={{ alignContent: 'baseline' }}>
										{renderBlueprints(blueprints)}
										{hasListPluginPermission && (
											<>
												<Grid size={12}>
													<Divider sx={{ ml: -3, mr: -3 }} />
												</Grid>
												<Grid size={12} sx={{ display: 'flex', alignItems: 'center' }}>
													<Typography
                                                        variant="overline"
                                                        sx={{
                                                            color: "text.secondary",
                                                            mr: 2
                                                        }}>
														{formatMessage(messages.publicMarketplaceBlueprints)}
													</Typography>
													<IconButton
														size="small"
														onClick={handleSearchClick}
														aria-label={formatMessage({ defaultMessage: 'Search' })}
													>
														<SearchIcon />
													</IconButton>
													<FormControlLabel
														sx={{ marginLeft: 'auto' }}
														control={
															<Checkbox
																checked={site.showIncompatible}
																onChange={(e: ChangeEvent<HTMLInputElement>) => handleShowIncompatibleChange(e)}
																color="primary"
																sx={{ pt: 0, pb: 0 }}
															/>
														}
														label={
															<Typography sx={{ fontSize: '0.8125rem' }}>
																{formatMessage(messages.showIncompatible)}
															</Typography>
														}
														labelPlacement="start"
													/>
												</Grid>
												{search.searchSelected && site.selectedView === 0 && (
													<Grid size={12}>
														<Box sx={{ width: '100%', zIndex: 1 }}>
															<SearchBar
																showActionButton={Boolean(search.searchKey)}
																onChange={handleOnSearchChange}
																keyword={search.searchKey}
																autoFocus={true}
															/>
														</Box>
													</Grid>
												)}
												{apiState.marketplaceError ? (
													<Box
														sx={(theme) => ({
															width: '100%',
															display: 'flex',
															alignItems: 'center',
															flexDirection: 'column',
															rowGap: theme.spacing(2),
															padding: theme.spacing(5)
														})}
													>
														<SignalWifiBadRounded sx={{ color: (theme) => theme.palette.text.secondary }} />
														<Typography variant="body1" sx={{
                                                            color: "text.secondary"
                                                        }}>
															{formatMessage(messages.marketplaceUnavailable)}
														</Typography>
														<Button variant="text" onClick={fetchMarketplaceBlueprints}>
															{formatMessage(messages.retry)}
														</Button>
													</Box>
												) : apiState?.fetchingMarketplace ? (
													<Box sx={{ width: '100%' }}>
														<LoadingState />
													</Box>
												) : !filteredMarketplace || filteredMarketplace?.length === 0 ? (
													<EmptyState
														title={formatMessage(messages.noMarketplaceBlueprints)}
														subtitle={formatMessage(messages.changeQuery)}
														sxs={{ root: { width: '100%' } }}
													/>
												) : (
													renderBlueprints(filteredMarketplace, true)
												)}
											</>
										)}
									</Grid>
								</Box>
							)}
							{site.selectedView === 1 && (
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
									{site.blueprint && (
										<BlueprintForm
											inputs={site}
											setInputs={setSite}
											onCheckNameExist={checkNameExist}
											onSubmit={handleFinish}
											blueprint={site.blueprint}
											sxs={{ root: { marginTop: '10px' } }}
											fieldsErrorsLookup={fieldsErrorsLookup}
										/>
									)}
								</Box>
							)}
							{site.selectedView === 2 && (
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
									{site.blueprint && <BlueprintReview onGoTo={handleGoTo} inputs={site} blueprint={site.blueprint} />}
								</Box>
							)}
						</DialogBody>
					) : apiState.error ? (
						<ApiResponseErrorState
							sxs={{ root: { height: '100%' } }}
							error={extractErrorPayload(apiState.errorResponse)}
						/>
					) : (
						<Box sx={{ position: 'relative', padding: 16, flexGrow: 1 }}>
							<LoadingState />
						</Box>
					)}
					{site.selectedView !== 0 && (
						<DialogFooter sx={{ animation: `${keyframes`${fadeIn}`} 1s` }}>
							<Button color="primary" variant="outlined" onClick={handleBack} children={formatMessage(messages.back)} />
							<PrimaryButton ref={finishRef} onClick={handleFinish} children={views[site.selectedView].btnText} />
						</DialogFooter>
					)}
				</Box>
			)}
        </>
    );
}

export default CreateSiteDialogContainer;
