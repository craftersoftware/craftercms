<!--
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
  ~ along with this program.  If not, see <http://www.gnu.org/licenses/>.
  -->

<#include "/templates/system/common/versionInfo.ftl" />

<!doctype html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>

  <meta charset="utf-8"/>
  <title>CrafterCMS - Content Form</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>

  <link rel="stylesheet" href="/studio/static-assets/themes/cstudioTheme/css/forms-default.css"/>
  <link rel="stylesheet" href="/studio/static-assets/styles/forms-engine.css"/>
  <link rel="stylesheet" href="/studio/static-assets/styles/bootstrap-5.3.css"/>

  <#include "/templates/web/common/page-fragments/head.ftl" />
  <#include "/templates/web/common/page-fragments/studio-context.ftl" />

  <script src="/studio/static-assets/components/cstudio-common/resources/en/base.js"></script>
  <script src="/studio/static-assets/components/cstudio-common/resources/ko/base.js"></script>
  <script src="/studio/static-assets/components/cstudio-common/resources/es/base.js"></script>
  <script src="/studio/static-assets/components/cstudio-common/resources/de/base.js"></script>

  <link rel="stylesheet" type="text/css" href="/studio/static-assets/themes/cstudioTheme/yui/assets/rte.css" />
  <link rel="stylesheet" type="text/css" href="/studio/static-assets/styles/tinymce-ace.css" />

  <script src="/studio/static-assets/libs/ace/ace.js"></script>
  <script src="/studio/static-assets/libs/tinymce/tinymce.min.js"></script>
  <script src="/studio/static-assets/modules/editors/tinymce/v2/tiny_mce/tiny_mce.js"></script>
  <script src="/studio/static-assets/libs/amplify/lib/amplify.core.js"></script>
  <script src="/studio/static-assets/libs/notify/notify.min.js"></script>
  <script>CStudioAuthoring.Module.moduleLoaded("publish-subscribe", {});</script>

  <script src="/studio/static-assets/scripts/crafter.js"></script>
  <script src="/studio/static-assets/components/cstudio-forms/forms-engine.js"></script>

  <script src="/studio/static-assets/scripts/animator.js"></script>
  <script src="/studio/static-assets/components/cstudio-components/loader.js"></script>

  <script src="/studio/static-assets/libs/momentjs/moment.min.js"></script>
  <script src="/studio/static-assets/libs/momentjs/moment-timezone-with-data-2000-2030.min.js"></script>
</head>

<body class="yui-skin-cstudioTheme form-engine-body">

<header id="formHeader" style="display: none; overflow: hidden">
  <hgroup>
    <div class="page-header">
      <div class="container">
        <h1>
          <span class="header"></span>
          <div>
            <small class="name"></small>
            <small class="location"></small>
          </div>
        </h1>
				<div class="in-workflow-warning"></div>
        <p class="page-description"></p>
      </div>
    </div>
  </hgroup>
  <div class="container">
    <a id="cstudio-form-expand-all" class="btn btn-default btn-sm" href="javascript:"></a>
    <a id="cstudio-form-collapse-all" class="btn btn-default btn-sm" href="javascript:"></a>
  </div>
</header>

<div id="formContainer">
  <div style="display: flex; height: 100%; align-items: center">
    <div style="width: 100%; text-align: center;"><i class="fa fa-spinner fa-spin fa-3x fa-fw loading"></i></div>
  </div>
</div>

<#include "/static-assets/app/pages/legacy.html">
<script>
  document.addEventListener("CrafterCMS.CodebaseBridgeReady", () => {
    // Main call that starts the form engine
		CrafterCMSNext.system.getStore().subscribe(() => {
			CStudioForms.engine.render(null, "default", "formContainer");
		});
  });
</script>

</body>
</html>
