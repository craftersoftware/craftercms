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

import React, { lazy, Suspense, useEffect } from 'react';
import StandardAction from '../../models/StandardAction';
import { Dispatch } from 'redux';
import { useDispatch } from 'react-redux';
import { isPlainObject } from '../../utils/object';
import { SnackbarKey, useSnackbar } from 'notistack';
import { getHostToHostBus } from '../../utils/subjects';
import { blockUI, newProjectReady, projectBootstrapReady, showSystemNotification, unblockUI } from '../../state/actions/system';
import Launcher from '../Launcher/Launcher';
import useSelection from '../../hooks/useSelection';
import { useWithPendingChangesCloseRequest } from '../../hooks/useWithPendingChangesCloseRequest';
import MinimizedBar from '../MinimizedBar';
import { RenameAssetDialog } from '../RenameAssetDialog';
import { FormattedMessage, useIntl } from 'react-intl';
import Button from '@mui/material/Button';
import { getSystemLink } from '../../utils/system';
import useEnv from '../../hooks/useEnv';
import { filter, map, switchMap } from 'rxjs/operators';
import { ProjectLifecycleEvent } from '../../models/ProjectLifecycleEvent';
import { fetchAll as fetchSitesService } from '../../services/sites';
import IconButton from '@mui/material/IconButton';
import CloseRounded from '@mui/icons-material/CloseRounded';
import useAuth from '../../hooks/useAuth';
import useActiveSiteId from '../../hooks/useActiveSiteId';

// region const ... = lazy(() => import('...'));
const ViewVersionDialog = lazy(() => import('../ViewVersionDialog'));
const CompareVersionsDialog = lazy(() => import('../CompareVersionsDialog'));
const RejectDialog = lazy(() => import('../RejectDialog'));
const EditSiteDialog = lazy(() => import('../EditSiteDialog'));
const ConfirmDialog = lazy(() => import('../ConfirmDialog'));
const ErrorDialog = lazy(() => import('../ErrorDialog'));
const NewContentDialog = lazy(() => import('../NewContentDialog'));
const ChangeContentTypeDialog = lazy(() => import('../ChangeContentTypeDialog'));
const HistoryDialog = lazy(() => import('../HistoryDialog'));
const PublishDialog = lazy(() => import('../PublishDialog'));
const DependenciesDialog = lazy(() => import('../DependenciesDialog/DependenciesDialog'));
const DeleteDialog = lazy(() => import('../DeleteDialog'));
const WorkflowCancellationDialog = lazy(() => import('../WorkflowCancellationDialog'));
const LegacyFormDialog = lazy(() => import('../LegacyFormDialog'));
const CreateFolderDialog = lazy(() => import('../CreateFolderDialog'));
const CopyItemsDialog = lazy(() => import('../CopyDialog'));
const CreateFileDialog = lazy(() => import('../CreateFileDialog'));
const BulkUploadDialog = lazy(() => import('../UploadDialog'));
const SingleFileUploadDialog = lazy(() => import('../SingleFileUploadDialog'));
const PreviewDialog = lazy(() => import('../PreviewDialog'));
const ItemMenu = lazy(() => import('../ItemActionsMenu'));
const ItemMegaMenu = lazy(() => import('../ItemMegaMenu'));
const AuthMonitor = lazy(() => import('../AuthMonitor'));
const PublishingStatusDialog = lazy(() => import('../PublishingStatusDialog'));
const UIBlocker = lazy(() => import('../UIBlocker'));
const PathSelectionDialog = lazy(() => import('../PathSelectionDialog'));
const UnlockPublisherDialog = lazy(() => import('../UnlockPublisherDialog'));
const WidgetDialog = lazy(() => import('../WidgetDialog'));
const CodeEditorDialog = lazy(() => import('../CodeEditorDialog'));
const BrokenReferencesDialog = lazy(() => import('../BrokenReferencesDialog'));
const FolderMoveAlertDialog = lazy(() => import('../FolderMoveAlert/FolderMoveAlertDialog'));
// endregion

// @formatter:off
function createCallback(action: StandardAction, dispatch: Dispatch): (output?: unknown) => void {
  // prettier-ignore
  return action ? (output: any) => {
    const hasPayload = Boolean(action.payload);
    const hasOutput = Boolean(output) && isPlainObject(output);
    const payload = (hasPayload && !hasOutput)
      // If there's a payload in the original action and there
      // is no output from the resulting callback, simply use the
      // original payload
      ? action.payload
      // Otherwise, if there's no payload but there is an output sent
      // to the resulting callback, use the output as the payload
      : (!hasPayload && hasOutput)
        ? output
        : (
          (hasPayload && hasOutput)
            // If there's an output and a payload, merge them both into a single object.
            // We're supposed to be using objects for all our payloads, otherwise this
            // could fail with literal native values such as strings or numbers.
            ? Array.isArray(action.payload)
              // If it's an array, assume is a BATCH_ACTIONS action payload; each item
              // of the array should be an action, so merge each item with output.
              ? action.payload.map((a) => ({ ...a, payload: { ...a.payload, ...output } }))
              // If it's not an array, it's a single action. Merge with output.
              : { ...action.payload, ...output }
            // Later, we check if there's a payload to add it
            : false
        );
    dispatch({
      type: action.type,
      ...(payload ? { payload } : {})
    });
  } : null;
}
// @formatter:on

function GlobalDialogManager() {
  const state = useSelection((state) => state.dialogs);
  const contentTypesBranch = useSelection((state) => state.contentTypes);
  const versionsBranch = useSelection((state) => state.versions);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const dispatch = useDispatch();
  const { authoringBase, socketConnected } = useEnv();
  const { active: authActive } = useAuth();
  const activeSiteId = useActiveSiteId();
  const { formatMessage } = useIntl();

  useEffect(() => {
    const hostToHost$ = getHostToHostBus();
    const subscription = hostToHost$.subscribe(({ type, payload }) => {
      switch (type) {
        case showSystemNotification.type:
          enqueueSnackbar(payload.message, payload.options);
          break;
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [enqueueSnackbar]);

  useEffect(() => {
    const subscription = getHostToHostBus()
      .pipe(
        filter((e: StandardAction<ProjectLifecycleEvent>) => e.type === newProjectReady.type || e.type === projectBootstrapReady.type),
        switchMap((e) =>
          // Not the most efficient approach to (re)fetch all sites (which already occurs when a new site is created), but it's not possible to
          // look site by uuid or to sync this even with the completion of the background fetch of the sites.
          fetchSitesService().pipe(
            map((sites) => sites.find((site) => site.uuid === e.payload.siteUuid)),
            filter((site) => Boolean(site))
          )
        )
      )
      .subscribe((site) => {
        if (!Boolean(document.querySelector('[data-dialog-id="create-site-dialog"]'))) {
          const siteId = site.id;
          enqueueSnackbar(
            <FormattedMessage defaultMessage={`Project "{siteId}" has been created.`} values={{ siteId }} />,
            {
              action: (
                <Button
                  size="small"
                  onClick={() => {
                    window.location.href = getSystemLink({
                      systemLinkId: 'preview',
                      authoringBase,
                      site: siteId,
                      page: '/'
                    });
                  }}
                >
                  <FormattedMessage id="words.view" defaultMessage="View" />
                </Button>
              )
            }
          );
        }
      });
    return () => subscription.unsubscribe();
  }, [authoringBase, enqueueSnackbar]);

  useEffect(() => {
    const isIframe = window.location !== window.parent.location;
    if (!isIframe && authActive && !socketConnected && activeSiteId !== null) {
      let timeout: NodeJS.Timeout, key: SnackbarKey;
      timeout = setTimeout(() => {
        fetch(`${authoringBase}/help/socket-connection-error`)
          .then((r) => {
            if (r.ok) {
              return r.text();
            } else {
              throw new Error('socket-connection-error fetch failed');
            }
          })
          .then(() => {
            key = enqueueSnackbar(<FormattedMessage defaultMessage="Studio will continue to retry the connection." />, {
              variant: 'warning',
              persist: true,
              anchorOrigin: { vertical: 'bottom', horizontal: 'center' },
              alertTitle: <FormattedMessage defaultMessage="Connection with the server interrupted" />,
              action: (key) => (
                <>
                  <Button
                    href={`${authoringBase}/help/socket-connection-error`}
                    target="_blank"
                    size="small"
                    color="inherit"
                  >
                    <FormattedMessage defaultMessage="Learn more" />
                  </Button>
                  <IconButton size="small" color="inherit" onClick={() => closeSnackbar(key)}>
                    <CloseRounded />
                  </IconButton>
                </>
              )
            });
          })
          .catch(() => {
            dispatch(
              blockUI({
                title: formatMessage({ defaultMessage: 'Connection with the server interrupted' }),
                message: formatMessage({
                  defaultMessage:
                    'Studio servers might be down, being restarted or your network connection dropped. Check your connection or ask the administrator to validate server status.'
                })
              })
            );
          });
      }, 5000);
      return () => {
        clearTimeout(timeout);
        if (key) {
          closeSnackbar(key);
        } else {
          dispatch(unblockUI());
        }
      };
    }
  }, [
    authoringBase,
    authActive,
    closeSnackbar,
    enqueueSnackbar,
    socketConnected,
    dispatch,
    formatMessage,
    activeSiteId
  ]);

  return (
    <Suspense fallback="">
      {/* region Confirm */}
      <ConfirmDialog
        {...state.confirm}
        onOk={createCallback(state.confirm.onOk, dispatch)}
        onCancel={createCallback(state.confirm.onCancel, dispatch)}
        onClose={createCallback(state.confirm.onClose, dispatch)}
        onClosed={createCallback(state.confirm.onClosed, dispatch)}
      />
      {/* endregion */}

      {/* region Error */}
      <ErrorDialog
        {...state.error}
        onClose={createCallback(state.error.onClose, dispatch)}
        onClosed={createCallback(state.error.onClosed, dispatch)}
        onDismiss={createCallback(state.error.onDismiss, dispatch)}
      />
      {/* endregion */}

      {/* region Edit (LegacyFormDialog) */}
      <LegacyFormDialog
        {...state.edit}
        onClose={createCallback(state.edit.onClose, dispatch)}
        onMinimize={createCallback(state.edit.onMinimize, dispatch)}
        onMaximize={createCallback(state.edit.onMaximize, dispatch)}
        onClosed={createCallback(state.edit.onClosed, dispatch)}
        onSaveSuccess={createCallback(state.edit.onSaveSuccess, dispatch)}
      />
      {/* endregion */}

      {/* region Code Editor */}
      <CodeEditorDialog
        {...state.codeEditor}
        onClose={createCallback(state.codeEditor.onClose, dispatch)}
        onMinimize={createCallback(state.codeEditor.onMinimize, dispatch)}
        onMaximize={createCallback(state.codeEditor.onMaximize, dispatch)}
        onClosed={createCallback(state.codeEditor.onClosed, dispatch)}
        onSuccess={createCallback(state.codeEditor.onSuccess, dispatch)}
        onFullScreen={createCallback(state.codeEditor.onFullScreen, dispatch)}
        onCancelFullScreen={createCallback(state.codeEditor.onCancelFullScreen, dispatch)}
        onWithPendingChangesCloseRequest={useWithPendingChangesCloseRequest(
          createCallback(state.codeEditor.onClose, dispatch)
        )}
      />
      {/* endregion */}

      {/* region Publish */}
      <PublishDialog
        {...state.publish}
        onClose={createCallback(state.publish.onClose, dispatch)}
        onClosed={createCallback(state.publish.onClosed, dispatch)}
        onSuccess={createCallback(state.publish.onSuccess, dispatch)}
        onWithPendingChangesCloseRequest={useWithPendingChangesCloseRequest(
          createCallback(state.publish.onClose, dispatch)
        )}
      />
      {/* endregion */}

      {/* region Create Content */}
      <NewContentDialog
        {...state.newContent}
        onContentTypeSelected={createCallback(state.newContent.onContentTypeSelected, dispatch)}
        onClose={createCallback(state.newContent.onClose, dispatch)}
        onClosed={createCallback(state.newContent.onClosed, dispatch)}
      />
      {/* endregion */}

      {/* region Change ContentType */}
      <ChangeContentTypeDialog
        {...state.changeContentType}
        onContentTypeSelected={createCallback(state.changeContentType.onContentTypeSelected, dispatch)}
        onClose={createCallback(state.changeContentType.onClose, dispatch)}
        onClosed={createCallback(state.changeContentType.onClosed, dispatch)}
      />
      {/* endregion */}

      {/* region Dependencies */}
      <DependenciesDialog
        {...state.dependencies}
        onClose={createCallback(state.dependencies.onClose, dispatch)}
        onClosed={createCallback(state.dependencies.onClosed, dispatch)}
      />
      {/* endregion */}

      {/* region Delete */}
      <DeleteDialog
        {...state.delete}
        onClose={createCallback(state.delete.onClose, dispatch)}
        onClosed={createCallback(state.delete.onClosed, dispatch)}
        onSuccess={createCallback(state.delete.onSuccess, dispatch)}
        onWithPendingChangesCloseRequest={useWithPendingChangesCloseRequest(
          createCallback(state.delete.onClose, dispatch)
        )}
      />
      {/* endregion */}

      {/* region History */}
      <HistoryDialog
        {...state.history}
        versionsBranch={versionsBranch}
        onClose={createCallback(state.history.onClose, dispatch)}
        onClosed={createCallback(state.history.onClosed, dispatch)}
      />
      {/* endregion */}

      {/* region View Versions */}
      <ViewVersionDialog
        {...state.viewVersion}
        rightActions={state.viewVersion.rightActions?.map((action) => ({
          ...action,
          onClick: createCallback(action.onClick, dispatch)
        }))}
        leftActions={state.viewVersion.leftActions?.map((action) => ({
          ...action,
          onClick: createCallback(action.onClick, dispatch)
        }))}
        contentTypesBranch={contentTypesBranch}
        onClose={createCallback(state.viewVersion.onClose, dispatch)}
        onClosed={createCallback(state.viewVersion.onClosed, dispatch)}
      />
      {/* endregion */}

      {/* region Compare Versions */}
      <CompareVersionsDialog
        {...state.compareVersions}
        leftActions={state.compareVersions.leftActions?.map((action) => ({
          ...action,
          onClick: createCallback(action.onClick, dispatch)
        }))}
        rightActions={state.compareVersions.rightActions?.map((action) => ({
          ...action,
          onClick: createCallback(action.onClick, dispatch)
        }))}
        contentTypesBranch={contentTypesBranch}
        selectedA={versionsBranch?.selected[0] ? versionsBranch.byId[versionsBranch.selected[0]] : null}
        selectedB={versionsBranch?.selected[1] ? versionsBranch.byId[versionsBranch.selected[1]] : null}
        versionsBranch={versionsBranch}
        onClose={createCallback(state.compareVersions.onClose, dispatch)}
        onClosed={createCallback(state.compareVersions.onClosed, dispatch)}
      />
      {/* endregion */}

      {/* region Auth Monitor */}
      <AuthMonitor />
      {/* endregion */}

      {/* region Workflow Cancellation */}
      <WorkflowCancellationDialog
        {...state.workflowCancellation}
        onClose={createCallback(state.workflowCancellation.onClose, dispatch)}
        onClosed={createCallback(state.workflowCancellation.onClosed, dispatch)}
        onContinue={createCallback(state.workflowCancellation.onContinue, dispatch)}
      />
      {/* endregion */}

      {/* region Broken References */}
      <BrokenReferencesDialog
        {...state.brokenReferences}
        onClose={createCallback(state.brokenReferences.onClose, dispatch)}
        onClosed={createCallback(state.brokenReferences.onClosed, dispatch)}
        onContinue={createCallback(state.brokenReferences.onContinue, dispatch)}
      />
      {/* endregion */}

      {/* region Reject */}
      <RejectDialog
        {...state.reject}
        onClose={createCallback(state.reject.onClose, dispatch)}
        onClosed={createCallback(state.reject.onClosed, dispatch)}
        onRejectSuccess={createCallback(state.reject.onRejectSuccess, dispatch)}
        onWithPendingChangesCloseRequest={useWithPendingChangesCloseRequest(
          createCallback(state.reject.onClose, dispatch)
        )}
      />
      {/* endregion */}

      {/* region Create Folder */}
      <CreateFolderDialog
        {...state.createFolder}
        onClose={createCallback(state.createFolder.onClose, dispatch)}
        onClosed={createCallback(state.createFolder.onClosed, dispatch)}
        onCreated={createCallback(state.createFolder.onCreated, dispatch)}
        onRenamed={createCallback(state.createFolder.onRenamed, dispatch)}
        onWithPendingChangesCloseRequest={useWithPendingChangesCloseRequest(
          createCallback(state.createFolder.onClose, dispatch)
        )}
      />
      {/* endregion */}

      {/* region Create File */}
      <CreateFileDialog
        {...state.createFile}
        onClose={createCallback(state.createFile.onClose, dispatch)}
        onClosed={createCallback(state.createFile.onClosed, dispatch)}
        onCreated={createCallback(state.createFile.onCreated, dispatch)}
        onWithPendingChangesCloseRequest={useWithPendingChangesCloseRequest(
          createCallback(state.createFile.onClose, dispatch)
        )}
      />
      {/* endregion */}

      {/* region Rename Asset */}
      <RenameAssetDialog
        {...state.renameAsset}
        onClose={createCallback(state.renameAsset.onClose, dispatch)}
        onClosed={createCallback(state.renameAsset.onClosed, dispatch)}
        onRenamed={createCallback(state.renameAsset.onRenamed, dispatch)}
        onWithPendingChangesCloseRequest={useWithPendingChangesCloseRequest(
          createCallback(state.renameAsset.onClose, dispatch)
        )}
      />
      {/* endregion */}

      {/* region Copy Items */}
      <CopyItemsDialog
        {...state.copy}
        onClose={createCallback(state.copy.onClose, dispatch)}
        onClosed={createCallback(state.copy.onClosed, dispatch)}
        onOk={createCallback(state.copy.onOk, dispatch)}
      />
      {/* endregion */}

      {/* region Bulk Upload */}
      <BulkUploadDialog
        {...state.upload}
        onClose={createCallback(state.upload.onClose, dispatch)}
        onClosed={createCallback(state.upload.onClosed, dispatch)}
        onFileAdded={createCallback(state.upload.onFileAdded, dispatch)}
        onUploadSuccess={createCallback(state.upload.onUploadSuccess, dispatch)}
      />
      {/* endregion */}

      {/* region Single File Upload */}
      <SingleFileUploadDialog
        {...state.singleFileUpload}
        onClose={createCallback(state.singleFileUpload.onClose, dispatch)}
        onClosed={createCallback(state.singleFileUpload.onClosed, dispatch)}
        onUploadStart={createCallback(state.singleFileUpload.onUploadStart, dispatch)}
        onUploadComplete={createCallback(state.singleFileUpload.onUploadComplete, dispatch)}
        onUploadError={createCallback(state.singleFileUpload.onUploadError, dispatch)}
      />
      {/* endregion */}

      {/* region PreviewDialog */}
      <PreviewDialog
        {...state.preview}
        onMinimize={createCallback(state.preview.onMinimize, dispatch)}
        onMaximize={createCallback(state.preview.onMaximize, dispatch)}
        onClose={createCallback(state.preview.onClose, dispatch)}
        onClosed={createCallback(state.preview.onClosed, dispatch)}
        onFullScreen={createCallback(state.preview.onFullScreen, dispatch)}
        onCancelFullScreen={createCallback(state.preview.onCancelFullScreen, dispatch)}
      />
      {/* endregion */}

      {/* region Edit Site */}
      <EditSiteDialog
        {...state.editSite}
        onClose={createCallback(state.editSite.onClose, dispatch)}
        onClosed={createCallback(state.editSite.onClosed, dispatch)}
        onSaveSuccess={createCallback(state.editSite.onSaveSuccess, dispatch)}
        onSiteImageChange={createCallback(state.editSite.onSiteImageChange, dispatch)}
        onWithPendingChangesCloseRequest={useWithPendingChangesCloseRequest(
          createCallback(state.editSite.onClose, dispatch)
        )}
      />
      {/* endregion */}

      {/* region Path Selection */}
      <PathSelectionDialog
        {...state.pathSelection}
        onClose={createCallback(state.pathSelection.onClose, dispatch)}
        onClosed={createCallback(state.pathSelection.onClosed, dispatch)}
        onOk={createCallback(state.pathSelection.onOk, dispatch)}
      />
      {/* endregion */}

      {/* region Item Menu */}
      <ItemMenu {...state.itemMenu} onClose={createCallback(state.itemMenu.onClose, dispatch)} />
      {/* endregion */}

      {/* region Item Mega Menu */}
      <ItemMegaMenu
        {...state.itemMegaMenu}
        onClose={createCallback(state.itemMegaMenu.onClose, dispatch)}
        onClosed={createCallback(state.itemMegaMenu.onClosed, dispatch)}
      />
      {/* endregion */}

      {/* region Launcher */}
      <Launcher {...state.launcher} />
      {/* endregion */}

      {/* region Publishing Status Dialog */}
      <PublishingStatusDialog
        {...state.publishingStatus}
        onClose={createCallback(state.publishingStatus.onClose, dispatch)}
        onRefresh={createCallback(state.publishingStatus.onRefresh, dispatch)}
        onUnlock={createCallback(state.publishingStatus.onUnlock, dispatch)}
      />
      {/* endregion */}

      {/* region Unlock Publisher Dialog */}
      <UnlockPublisherDialog
        open={state.unlockPublisher.open}
        onError={createCallback(state.unlockPublisher.onError, dispatch)}
        onCancel={createCallback(state.unlockPublisher.onCancel, dispatch)}
        onComplete={createCallback(state.unlockPublisher.onComplete, dispatch)}
      />
      {/* endregion */}

      {/* region Widget Dialog */}
      <WidgetDialog
        {...state.widget}
        onClose={createCallback(state.widget.onClose, dispatch)}
        onMinimize={createCallback(state.widget.onMinimize, dispatch)}
        onMaximize={createCallback(state.widget.onMaximize, dispatch)}
        onClosed={createCallback(state.widget.onClosed, dispatch)}
        onWithPendingChangesCloseRequest={useWithPendingChangesCloseRequest(
          createCallback(state.widget.onClose, dispatch)
        )}
      />
      {/* endregion */}

      {/* region Minimized Tabs */}
      {Object.values(state.minimizedTabs).map((tab) => (
        <MinimizedBar
          key={tab.id}
          open={tab.minimized}
          title={tab.title}
          subtitle={tab.subtitle}
          status={tab.status}
          onMaximize={createCallback(tab.onMaximized, dispatch)}
        />
      ))}
      {/* endregion */}

      {/* region UIBlocker */}
      <UIBlocker {...state.uiBlocker} />
      {/* endregion */}

      {/* region FolderMoveAlertDialog */}
      <FolderMoveAlertDialog
        {...state.folderMoveAlert}
        onClose={createCallback(state.folderMoveAlert.onClose, dispatch)}
        onClosed={createCallback(state.folderMoveAlert.onClosed, dispatch)}
      />
      {/* endregion */}
    </Suspense>
  );
}

export default React.memo(GlobalDialogManager);
