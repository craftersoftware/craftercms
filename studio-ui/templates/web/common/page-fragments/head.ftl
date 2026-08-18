<#--
~ Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
~
~ This program is free software: you can redistribute it and/or modify
~ it under the terms of the GNU General Public License version 3 as published by
~ the Free Software Foundation.
~
~ This program is distributed in the hope that it will be useful,
~ but WITHOUT ANY WARRANTY; without even the implied warranty of
~ MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
~ GNU General Public License for more details.
~
~ You should have received a copy of the GNU General Public License
~ along with this program. If not, see <http://www.gnu.org/licenses/>.
-->
<#-- <#include "/templates/system/common/versionInfo.ftl" /> -->
<#if envConfig.site?? == false || envConfig.site == "">
  <meta http-equiv="refresh" content="0;URL='/studio/user-dashboard/#/sites/all'" />
<#else>

  <link rel="stylesheet" type="text/css" href="/studio/static-assets/themes/cstudioTheme/yui/assets/skin.css" />
  <link rel="stylesheet" type="text/css" href="/studio/static-assets/yui/container/assets/skins/sam/container.css"/>
  <link rel="stylesheet" type="text/css" href="/studio/static-assets/themes/cstudioTheme/base.css" />
  <link rel="stylesheet" type="text/css" href="/studio/static-assets/themes/cstudioTheme/dashboard.css" />
  <link rel="stylesheet" type="text/css" href="/studio/static-assets/themes/cstudioTheme/dashboard-presentation.css" />
  <link rel="stylesheet" type="text/css" href="/studio/static-assets/themes/cstudioTheme/presentation.css" />
  <link rel="stylesheet" type="text/css" href="/studio/static-assets/themes/cstudioTheme/css/contextNav.css"/>
  <link rel="stylesheet" type="text/css" href="/studio/static-assets/themes/cstudioTheme/css/global.css" />
  <link rel="stylesheet" type="text/css" href="/studio/static-assets/themes/cstudioTheme/css/styleicon.css" />
  <link rel="stylesheet" type="text/css" href="/studio/static-assets/themes/cstudioTheme/css/font-awesome.min.css" />
  <link rel="stylesheet" type="text/css" href="/studio/static-assets/libs/datetimepicker/jquery.datetimepicker.css" />
  <link rel="stylesheet" type="text/css" href="/studio/static-assets/styles/uppy.css" />

  <script src="/studio/static-assets/yui/utilities/utilities.js"></script>
  <script src="/studio/static-assets/yui/button/button-min.js"></script>
  <script src="/studio/static-assets/yui/container/container-min.js"></script>
  <script src="/studio/static-assets/yui/menu/menu-min.js"></script>
  <script src="/studio/static-assets/yui/json/json-min.js"></script>
  <script src="/studio/static-assets/yui/selector/selector-min.js"></script>
  <script src="/studio/static-assets/yui/connection/connection-min.js"></script>
  <script src="/studio/static-assets/yui/element/element-min.js"></script>
  <script src="/studio/static-assets/yui/dragdrop/dragdrop-min.js"></script>
  <script src="/studio/static-assets/yui/yahoo-dom-event/yahoo-dom-event.js"></script>
  <script src="/studio/static-assets/yui/yahoo/yahoo-min.js"></script>
  <script src="/studio/static-assets/yui/utilities/utilities.js"></script>
  <script src="/studio/static-assets/yui/calendar/calendar-min.js"></script>
  <script src="/studio/static-assets/yui/event-delegate/event-delegate-min.js"></script>
  <script src="/studio/static-assets/yui/resize/resize-min.js"></script>

  <script src="/studio/static-assets/components/cstudio-common/common-api.js"></script>
  <script src="/studio/static-assets/libs/jquery/jquery.min.js"></script>
  <script src="/studio/static-assets/libs/jquery-ui/jquery-ui.min.js"></script>
  <script src="/studio/static-assets/yui/bubbling.v1.5.0-min.js" type="text/javascript"></script>
  <script src="/studio/static-assets/libs/bootstrap/popper.min.js"></script>
  <script src="/studio/static-assets/libs/bootstrap/bootstrap.min.js"></script>
  <script src="/studio/static-assets/libs/datetimepicker/jquery.datetimepicker.js"></script>

  <#outputformat "HTML">
  <script>document.domain = "${cookieDomain}";</script>
  </#outputformat>

</#if>

<link rel="shortcut icon" href="/studio/static-assets/img/favicon.ico">
