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

import { NewContentDialogContainerProps } from './utils';
import { useActiveSiteId } from '../../hooks/useActiveSiteId';
import { FormattedMessage, useIntl } from 'react-intl';
import { useDispatch } from 'react-redux';
import useStyles from './styles';
import { useSelection } from '../../hooks/useSelection';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LegacyContentType } from '../../models/ContentType';
import translations from './translations';
import { withoutIndex } from '../../utils/path';
import { batchActions } from '../../state/actions/misc';
import { closeNewContentDialog, newContentCreationComplete } from '../../state/actions/dialogs';
import { fetchLegacyContentTypes } from '../../services/contentTypes';
import { showErrorDialog } from '../../state/reducers/dialogs/error';
import { useLogicResource } from '../../hooks/useLogicResource';
import { useSubject } from '../../hooks/useSubject';
import { debounceTime } from 'rxjs/operators';
import DialogBody from '../DialogBody/DialogBody';
import { Box, Checkbox, FormControlLabel } from '@mui/material';
import SingleItemSelector from '../SingleItemSelector';
import SearchBar from '../SearchBar/SearchBar';
import { SuspenseWithEmptyState } from '../Suspencified/Suspencified';
import DialogFooter from '../DialogFooter/DialogFooter';
import ContentTypesFilter from '../ContentTypeFilter';
import { ContentTypesGrid, ContentTypesLoader } from './NewContentDialog';

export function NewContentDialogContainer(props: NewContentDialogContainerProps) {
  const { item, onContentTypeSelected, compact = false, rootPath } = props;
  const site = useActiveSiteId();
  const { formatMessage } = useIntl();
  const dispatch = useDispatch();
  const { classes } = useStyles();
  const authoringBase = useSelection<string>((state) => state.env.authoringBase);

  const [isCompact, setIsCompact] = useState(compact);
  const [openSelector, setOpenSelector] = useState(false);
  const [selectedItem, setSelectedItem] = useState(item);
  const [contentTypes, setContentTypes] = useState<LegacyContentType[]>();
  const [keyword, setKeyword] = useState('');
  const [debounceKeyword, setDebounceKeyword] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');

  const filters = [
    {
      label: formatMessage(translations.contentTypeAllLabel),
      type: 'all'
    },
    {
      label: formatMessage(translations.contentTypePageLabel),
      type: 'page'
    },
    {
      label: formatMessage(translations.contentTypeComponentLabel),
      type: 'component'
    }
  ];

  const onSelectedContentType = useCallback(
    (contentType: LegacyContentType) => {
      const path = withoutIndex(selectedItem.path);
      onContentTypeSelected?.({
        authoringBase,
        path,
        isNewContent: true,
        contentTypeId: contentType.form,
        onSaveSuccess: batchActions([closeNewContentDialog(), newContentCreationComplete()])
      });
    },
    [authoringBase, onContentTypeSelected, selectedItem?.path]
  );

  useEffect(() => {
    if (selectedItem.path) {
      // TODO: https://github.com/craftersoftware/craftercms/issues/4473
      const path =
        selectedItem.systemType === 'folder' && !selectedItem.path.endsWith('/')
          ? `${selectedItem.path}/`
          : selectedItem.path;

      fetchLegacyContentTypes(site, path).subscribe({
        next(response) {
          if (response.length === 1) {
            dispatch(closeNewContentDialog());
            onSelectedContentType(response[0]);
          } else {
            setContentTypes(response);
          }
        },
        error(response) {
          dispatch(showErrorDialog({ error: response }));
        }
      });
    }
  }, [dispatch, selectedItem, site, onSelectedContentType]);

  const resource = useLogicResource(
    useMemo(() => ({ contentTypes, selectedFilter, debounceKeyword }), [contentTypes, selectedFilter, debounceKeyword]),
    {
      shouldResolve: ({ contentTypes }) => Boolean(contentTypes),
      shouldReject: () => null,
      shouldRenew: (source, resource) => resource.complete,
      resultSelector: ({ contentTypes, debounceKeyword, selectedFilter }) => {
        return contentTypes.filter(
          (contentType) =>
            contentType.label.toLowerCase().includes(debounceKeyword.toLowerCase()) &&
            (selectedFilter === 'all' || contentType.type === selectedFilter)
        );
      },
      errorSelector: () => null
    }
  );

  const onSearch$ = useSubject<string>();

  useEffect(() => {
    onSearch$.pipe(debounceTime(400)).subscribe((keywords) => {
      setDebounceKeyword(keywords);
    });
  });

  const onSearch = (keyword: string) => {
    onSearch$.next(keyword);
    setKeyword(keyword);
  };

  return (
    <>
      <DialogBody classes={{ root: classes.dialogContent }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <SingleItemSelector
              label={<FormattedMessage id="words.item" defaultMessage="Item" />}
              open={openSelector}
              onClose={() => setOpenSelector(false)}
              onDropdownClick={() => setOpenSelector(!openSelector)}
              rootPath={rootPath}
              selectedItem={selectedItem}
              canSelectFolders
              onItemClicked={(item) => {
                setOpenSelector(false);
                setSelectedItem(item);
              }}
            />
          </Box>
          <Box className={classes.searchBox}>
            <SearchBar onChange={onSearch} keyword={keyword} autoFocus showActionButton={Boolean(keyword)} />
          </Box>
        </Box>
        <SuspenseWithEmptyState
          resource={resource}
          suspenseProps={{
            fallback: <ContentTypesLoader isCompact={isCompact} />
          }}
          withEmptyStateProps={{
            emptyStateProps: {
              classes: {
                image: classes.emptyStateImg
              },
              title: (
                <FormattedMessage id="newContentDialog.emptyStateMessage" defaultMessage="No Content Types Found" />
              )
            }
          }}
        >
          <ContentTypesGrid resource={resource} isCompact={isCompact} onTypeOpen={onSelectedContentType} />
        </SuspenseWithEmptyState>
      </DialogBody>
      <DialogFooter>
        <FormControlLabel
          className={classes.compact}
          control={<Checkbox checked={isCompact} onChange={() => setIsCompact(!isCompact)} color="primary" />}
          label={formatMessage(translations.compactInput)}
        />
        <ContentTypesFilter filters={filters} selected={selectedFilter} onFilterChange={setSelectedFilter} />
      </DialogFooter>
    </>
  );
}
