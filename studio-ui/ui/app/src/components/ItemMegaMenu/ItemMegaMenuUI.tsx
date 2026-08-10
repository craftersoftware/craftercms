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

import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import EmptyState from '../EmptyState/EmptyState';
import { FormattedMessage } from 'react-intl';
import Typography from '@mui/material/Typography';
import ItemDisplay from '../ItemDisplay';
import ItemStateIcon from '../ItemStateIcon/ItemStateIcon';
import { getItemPublishingTargetText, getItemStateText, isInWorkflow } from '../ItemDisplay/utils';
import React, { ReactNode } from 'react';
import { makeStyles } from 'tss-react/mui';
import Popover, { PopoverOrigin, PopoverPosition, PopoverProps, PopoverReference } from '@mui/material/Popover';
import palette from '../../styles/palette';
import { SystemIconDescriptor } from '../SystemIcon';
import { DetailedItem } from '../../models/Item';
import { ContextMenuOption } from '../ContextMenu/ContextMenu';
import GlobalState from '../../models/GlobalState';
import Skeleton from '@mui/material/Skeleton';
import { CSSObject as CSSProperties } from 'tss-react';
import ItemPublishingTargetIcon from '../ItemPublishingTargetIcon/ItemPublishingTargetIcon';
import useUnmount from '../../hooks/useUnmount';

export type ItemMegaMenuUIClassKey =
  | 'root'
  | 'mainItem'
  | 'actionsContainer'
  | 'actionsColumn'
  | 'emptyRoot'
  | 'itemsList'
  | 'itemInfo'
  | 'itemInfoContentType'
  | 'itemEdited'
  | 'itemEditedText'
  | 'itemState'
  | 'infoItem'
  | 'menuItem'
  | 'itemDisplayRoot'
  | 'itemTypeIcon'
  | 'itemTypography'
  | 'icon';

export type ItemMegaMenuUIStyles = Partial<Record<ItemMegaMenuUIClassKey, CSSProperties>>;

export interface MenuOption {
  id: string;
  icon?: SystemIconDescriptor;
  label: ReactNode;
}

export interface ItemMegaMenuUIProps {
  open: boolean;
  styles?: ItemMegaMenuUIStyles;
  classes?: Partial<Record<ItemMegaMenuUIClassKey, string>>;
  isLoading?: boolean;
  numOfLoaderItems?: number;
  item: DetailedItem;
  options: ContextMenuOption[][];
  editorialOptions: ContextMenuOption[];
  nonEditorialOptions: ContextMenuOption[][];
  anchorEl?: PopoverProps['anchorEl'];
  anchorOrigin?: PopoverOrigin;
  anchorReference?: PopoverReference;
  anchorPosition?: PopoverPosition;
  contentType: string;
  locale: GlobalState['uiConfig']['locale'];
  onClose?(): void;
  onClosed?(): void;
  onMenuItemClicked(option: string, event: React.MouseEvent<Element, MouseEvent>): void;
}

const useStyles = makeStyles<ItemMegaMenuUIStyles, ItemMegaMenuUIClassKey>()(
  (
    theme,
    {
      root,
      mainItem,
      actionsContainer,
      actionsColumn,
      emptyRoot,
      itemsList,
      itemInfo,
      itemInfoContentType,
      itemEdited,
      itemEditedText,
      itemState,
      infoItem,
      menuItem,
      itemDisplayRoot,
      itemTypeIcon,
      itemTypography,
      icon
    } = {} as ItemMegaMenuUIStyles
  ) => ({
    root: {
      maxWidth: 400,
      borderRadius: '12px',
      ...root
    },
    mainItem: {
      padding: '10px 20px',
      ...mainItem
    },
    actionsContainer: {
      display: 'flex',
      flexDirection: 'row',
      padding: '10px',
      ...actionsContainer
    },
    actionsColumn: {
      display: 'flex',
      flexDirection: 'column',
      flexBasis: '100%',
      flex: '1',
      '&:first-child': {
        marginRight: '60px'
      },
      ...actionsColumn
    },
    emptyRoot: {
      display: 'block',
      padding: '10px',
      textAlign: 'center',
      ...emptyRoot
    },
    itemsList: {
      padding: 0,
      ...itemsList
    },
    itemInfo: {
      display: 'block',
      borderBottom: `1px solid ${palette.gray.light4}`,
      ...itemInfo
    },
    itemInfoContentType: {
      color: theme.palette.text.secondary,
      marginBottom: '4px',
      ...itemInfoContentType
    },
    itemEdited: {
      paddingTop: '12px',
      borderTop: `1px solid ${palette.gray.light4}`,
      ...itemEdited
    },
    itemEditedText: {
      color: theme.palette.text.secondary,
      fontWeight: 600,
      ...itemEditedText
    },
    itemState: {
      '&> *': {
        marginRight: '5px'
      },
      ...itemState
    },
    infoItem: {
      cursor: 'default',
      backgroundColor: 'inherit !important',
      '&:hover': {
        backgroundColor: 'inherit'
      },
      ...infoItem
    },
    menuItem: {
      minWidth: '100px',
      ...menuItem
    },
    itemDisplayRoot: {
      marginBottom: 5,
      ...itemDisplayRoot
    },
    itemTypeIcon: {
      color: palette.teal.main,
      marginRight: '2px',
      ...itemTypeIcon
    },
    itemTypography: {
      color: theme.palette.text.primary,
      ...itemTypography
    },
    icon: {
      fontSize: '0.8rem',
      verticalAlign: 'middle',
      ...icon
    }
  })
);

export function ItemMegaMenuUI(props: ItemMegaMenuUIProps) {
  const {
    open,
    styles,
    item,
    isLoading = false,
    numOfLoaderItems = 5,
    options,
    editorialOptions,
    nonEditorialOptions,
    anchorEl,
    anchorOrigin,
    anchorReference,
    anchorPosition,
    contentType,
    locale,
    onClose,
    onClosed,
    onMenuItemClicked,
    classes: propClasses
  } = props;
  const { classes, cx } = useStyles(styles);
  const isFolder = item?.systemType === 'folder';
  const inWorkflow = isInWorkflow(item?.stateMap);
  return (
    <Popover
      open={open}
      onClose={onClose}
      anchorEl={anchorEl}
      anchorOrigin={anchorOrigin}
      anchorReference={anchorReference}
      anchorPosition={anchorPosition}
      classes={{
        paper: classes.root,
        ...propClasses
      }}
    >
      <section className={cx(classes.itemInfo, classes.infoItem, classes.mainItem)}>
        <Typography variant="body2" className={classes.itemInfoContentType}>
          {isLoading ? <Skeleton animation="wave" /> : contentType}
        </Typography>
        {isLoading ? (
          <Skeleton animation="wave" />
        ) : (
          <ItemDisplay
            item={item}
            labelComponent="h2"
            showPublishingTarget={false}
            showWorkflowState={false}
            classes={{ root: classes.itemDisplayRoot, icon: classes.itemTypeIcon }}
            labelTypographyProps={{
              className: classes.itemTypography
            }}
          />
        )}
        {isLoading ? (
          <Skeleton animation="wave" />
        ) : (
          <div className={classes.itemState}>
            {/* @see https://github.com/craftersoftware/craftercms/issues/5442 */}
            {!isFolder &&
              (inWorkflow ? (
                <>
                  <ItemStateIcon item={item} className={classes.icon} />
                  <Typography variant="body2" component="span">
                    {getItemStateText(item?.stateMap, { user: item?.lockOwner?.username })}
                  </Typography>
                </>
              ) : (
                <>
                  <ItemPublishingTargetIcon item={item} className={classes.icon} />
                  <Typography variant="body2" component="span">
                    {getItemPublishingTargetText(item?.stateMap)}
                  </Typography>
                </>
              ))}
          </div>
        )}
      </section>
      {isLoading ? (
        <div className={cx(classes.actionsContainer)}>
          {new Array(2).fill(null).map((value, i) => (
            <MenuList key={i} className={cx(classes.actionsColumn, classes.itemsList)}>
              {new Array(Math.ceil(numOfLoaderItems / 2)).fill(null).map((value, j) => (
                <MenuItem key={j} className={cx(classes.menuItem, propClasses?.menuItem)}>
                  <Skeleton animation="wave" width="100%" />
                </MenuItem>
              ))}
            </MenuList>
          ))}
        </div>
      ) : options.flatMap((i) => i).length === 0 ? (
        <EmptyState
          title={
            <FormattedMessage id="contextMenu.emptyOptionsMessage" defaultMessage="No options available to display." />
          }
        />
      ) : (
        <div className={cx(classes.actionsContainer)}>
          <MenuList className={cx(classes.actionsColumn, classes.itemsList)}>
            {editorialOptions.map((option: MenuOption, y: number) => (
              <MenuItem
                dense
                autoFocus={y === 0}
                key={option.id}
                onClick={(e) => onMenuItemClicked(option.id, e)}
                className={cx(classes.menuItem, propClasses?.menuItem)}
                children={option.label}
              />
            ))}
          </MenuList>
          <div className={classes.actionsColumn}>
            {nonEditorialOptions.map((section: any, i: number) => (
              <MenuList key={i} className={classes.itemsList}>
                {section.map((option: MenuOption, y: number) => (
                  <MenuItem
                    dense
                    key={option.id}
                    divider={i !== nonEditorialOptions.length - 1 && y === section.length - 1}
                    onClick={(e) => onMenuItemClicked(option.id, e)}
                    className={cx(classes.menuItem, propClasses?.menuItem)}
                    children={option.label}
                  />
                ))}
              </MenuList>
            ))}
          </div>
        </div>
      )}
      <section className={cx(classes.itemEdited, classes.infoItem, classes.mainItem)}>
        {isLoading ? (
          <Skeleton animation="wave" width="100%" />
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" title={item.path} noWrap>
              {item.path}
            </Typography>
            <Typography variant="body2">
              <FormattedMessage
                id="itemMegaMenu.editedBy"
                defaultMessage="{edited} {date} {byLabel} {by}"
                values={{
                  date: new Intl.DateTimeFormat(locale.localeCode, locale.dateTimeFormatOptions).format(
                    new Date(item?.sandbox.dateModified)
                  ),
                  by: item?.sandbox.modifier?.username ?? '',
                  edited: (
                    <span className={classes.itemEditedText}>
                      <FormattedMessage id="words.edited" defaultMessage="Edited" />
                    </span>
                  ),
                  byLabel: item?.sandbox.modifier?.username ? (
                    <span className={classes.itemEditedText}>
                      <FormattedMessage id="words.by" defaultMessage="By" />
                    </span>
                  ) : (
                    ''
                  )
                }}
              />
            </Typography>
          </>
        )}
      </section>
      <Unmount onClosed={onClosed} />
    </Popover>
  );
}

function Unmount(props: { onClosed?(): void }) {
  useUnmount(props.onClosed);
  return null;
}

export default ItemMegaMenuUI;
