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

import React, { PropsWithChildren } from 'react';
import TextField from '@mui/material/TextField';
import { FormattedMessage } from 'react-intl';
import PasswordTextField from '../PasswordTextField/PasswordTextField';
import Button from '@mui/material/Button';
import { makeStyles } from 'tss-react/mui';
import { USER_PASSWORD_MAX_LENGTH, USER_USERNAME_MAX_LENGTH } from '../UserManagement/utils';

export type LogInFormProps = PropsWithChildren<{
  username: string;
  password: string;
  isFetching: boolean;
  onSubmit: (e: any) => any;
  onSetPassword: Function;
  enableUsernameInput?: boolean;
  onSetUsername?: Function;
  classes?: Partial<Record<'username' | 'password' | 'submit' | 'recover', string>>;
  action?: string;
  method?: 'get' | 'post';
  onRecover?: Function;
  xsrfParamName?: string;
  xsrfToken?: string;
}>;

const useStyles = makeStyles()((theme) => ({
  spacing: {
    marginBottom: theme.spacing(1.5)
  },
  doubleSpacing: {
    marginBottom: theme.spacing(2)
  },
  inputLabel: {
    '&.MuiInputLabel-shrink, &[class*="MuiInputLabel-shrink"]': {
      padding: '0 8px',
      borderRadius: 10,
      background: theme.palette.background.paper,
      transform: 'translate(9px, -6px) scale(.75)'
    }
  }
}));

export function LogInForm(props: LogInFormProps) {
  const { classes: cls, cx } = useStyles();
  const {
    children,
    username,
    onSubmit,
    onSetUsername,
    isFetching,
    onSetPassword,
    password,
    enableUsernameInput = false,
    classes,
    action = '/studio/login',
    method = 'post',
    onRecover,
    xsrfParamName,
    xsrfToken
  } = props;
  return (
    <form action={action} method={method} onSubmit={onSubmit}>
      {children}
      <TextField
        id="loginFormUsernameField"
        name="username"
        fullWidth
        autoFocus={enableUsernameInput && !Boolean(username)}
        disabled={!enableUsernameInput}
        type="text"
        value={username}
        onChange={(e: any) => onSetUsername?.(e.target.value)}
        className={cx(cls.spacing, classes?.username)}
        label={<FormattedMessage id="loginView.usernameTextFieldLabel" defaultMessage="Username" />}
        slotProps={{
          inputLabel: { className: cls.inputLabel },
          htmlInput: { maxLength: USER_USERNAME_MAX_LENGTH }
        }}
      />
      <PasswordTextField
        id="loginFormPasswordField"
        name="password"
        fullWidth
        autoFocus={!enableUsernameInput || Boolean(username)}
        value={password}
        onChange={(e: any) => onSetPassword?.(e.target.value)}
        className={cx(cls.spacing, classes?.password, 'last-before-button')}
        label={<FormattedMessage id="authMonitor.passwordTextFieldLabel" defaultMessage="Password" />}
        slotProps={{
          inputLabel: { className: cls.inputLabel },
          htmlInput: { autoComplete: 'current-password', maxLength: USER_PASSWORD_MAX_LENGTH }
        }}
      />
      {xsrfParamName && <input type="hidden" name={xsrfParamName} value={xsrfToken} />}
      <Button
        color="primary"
        variant="contained"
        fullWidth
        type="submit"
        disabled={isFetching}
        className={cx(onRecover && cls.spacing, classes?.submit)}
      >
        <FormattedMessage id="loginView.loginButtonLabel" defaultMessage="Log In" />
      </Button>
      {onRecover && (
        <Button
          type="button"
          color="primary"
          disabled={isFetching}
          variant="text"
          fullWidth
          className={classes?.recover}
          onClick={() => onRecover()}
        >
          <FormattedMessage id="loginView.forgotPasswordButtonLabel" defaultMessage="Forgot your password?" />
        </Button>
      )}
    </form>
  );
}

export default LogInForm;
