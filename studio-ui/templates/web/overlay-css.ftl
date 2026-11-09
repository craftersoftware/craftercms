<#if args.baseUrl?exists>
  <#assign urlBase = args.baseUrl >
<#else>
  <#assign urlBase = url.context >
</#if>
<#if args.siteId?exists>
  <#assign siteId = args.siteId >
<#else>
  <#assign siteId = "" >
</#if>
<#if urlBase == "/proxy/authoring">
  <#assign previewMode = true >
<#else>
  <#assign previewMode = false >
</#if>
/* * * * * * * * * * * * * * * * * * * * * * * * * * */
/* * * New framework styles (Please keep clean) * * */

<#--
    IMPORTANT: Do not place any rules above this line
    Icon framework rules/styles
-->
@import url("${urlBase}/static-assets/themes/cstudioTheme/css/icons.css");

<#if previewMode == true>
div.yui-calcontainer {
    background-color: #F2F2F2;
    border: 1px solid #D4D4D4;
    margin: 10px 0 0;
    position: absolute;
    padding:10px;
}

table.yui-calendar {
    border-collapse: separate;
    border-spacing: 2px;
}

.yui-calendar td.calcell {
    background: none repeat scroll 0 0 #F6F6F6;
    border: 1px solid #E6E6E6;
    color: #E9E8EB !important;
    cursor: default;
    height: 1.6em;
    line-height: 1.6em;
    padding: 2px;
    text-align: center;
    white-space: nowrap;
}

.yui-calcontainer {
    float: left;
    position: relative;
}

div.yui-calcontainer {
    background-color: #F2F2F2;
    border: 1px solid #D4D4D4;
    margin: 10px 0 0;
    position: absolute;
}

.yui-calendar div.calheader {
    padding-top: 7px;
}

.yui-calendar .calheader {
    background: none repeat scroll 0 0 transparent;
    font-weight: bold;
    padding: 0 0 0.6em;
    text-align: center;
}

.yui-calendar .calnavleft {
    background: url("${urlBase}/yui/assets/skins/default/sprite.png") no-repeat scroll 0 -450px transparent;
    bottom: 0;
    cursor: pointer;
    height: 15px;
    left: -10px;
    margin-left: 0.4em;
    top: 0;
    width: 25px;
}

.yui-calendar .calnavright {
    background: url("${urlBase}/yui/assets/skins/default/sprite.png") no-repeat scroll 0 -500px transparent;
    bottom: 0;
    cursor: pointer;
    height: 15px;
    margin-right: 0.4em;
    right: -10px;
    top: 0;
    width: 25px;
}

.strike {
    text-decoration: line-through;
}
</#if>

.cstudio-view .view-square-wrp {
    border:1px #7f9db9 solid;
    margin-bottom: 15px;
}
.cstudio-view a:hover {
    color: #0176B1;
    text-decoration: none;
}
.cstudio-view .view-square-wrp .head {
    background-color:#7f9db9;
    padding:3px 10px;
    color:#FFFFFF;
}
.cstudio-view .view-square-wrp .body {
    background-color:#FFF;
    padding:5px 10px;
    overflow-y:scroll;
    overflow-x:hidden;
    height:198px;
}
.cstudio-view h1.view-title {
    font: 1.9em Arial,Helvetica,Sans-Serif;
    margin-bottom:0;
    padding:0;
    color:#333;
    letter-spacing:0;
}
.cstudio-view .view-caption {
    margin-bottom:15px;
}
.cstudio-view .view-block {
    margin-bottom: 15px;
}
.cstudio-view input.date-picker,
.cstudio-view input.time-picker {
    border: 1px solid #7f9db9;
    width: 100px;
    padding: 1px 0;
}
.water-marked {
    color: #777777;
}
.cstudio-view input.date-picker {
    background-image:url("${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_calendar.gif");
    background-position:right center;
    background-repeat:no-repeat;
    width: 75px;
    padding-right: 25px;
}
.cstudio-view .action-wrapper {
    text-align: center;
}
.cstudio-view .terms-policy-wrp {
    background-color: #FFFFFF;
    border: 1px solid #7f9db9;
    height: 301px;
    overflow: auto;
    padding: 15px 20px;
}
.dependencies-listing .item {
    width: 200px;
    margin: 2px 5px 0 0;
    white-space: nowrap;
    overflow:hidden;
}
.dependencies-listing .item input[type=checkbox] {
    float: left;
    margin: 2px 7px 0 0;
}
.dependencies-listing .sub-item {
    padding-left: 15px;
}
/* * * * * * */
.cstudio-dialogue {
    border: none;
}
.cstudio-dialogue.yui-dialog {
    padding: 0;
}
.cstudio-dialogue .bd.cstudio-dialogue-body {
    background: #D6D6D6 url("${urlBase}/static-assets/themes/cstudioTheme/images/bg/submit_bg.jpg") repeat-x scroll 0 0;
    padding: 15px 25px !important;
    border: none;
    color: #000000 !important;
    margin: 0;
    <#if previewMode == true>
    height: auto !important;
    text-align: left;
    </#if>
}
.cstudio-dialogue .hd,
.cstudio-dialogue .ft {
    display:none;
}
.cstudio-dialogue .yui-module.yui-overlay.yui-panel {
    border: 4px solid #000000;
}
.context-nav-title-element {
    float: left !important;
    margin: 6px 0 0 10px;
    color: #000;
}
/* * * Please keep clean * * */
/* * * * * * * * * * * * * * */
.cstudio-view {
    font-size: 12px !important;
}

#acnVersionWrapper, div.schedulePolicyWrapper  { width: 554px; }

#acnVersionWrapper.go-live,
#acnVersionWrapper.schedule { width: 840px; }

#acnVersionWrapper .acnScroll { float: left; }

.cstudio-view h1,
#acnSubmitWrapper h3 {
    color: #000;
    padding: 0;
    margin: 0;
}
.cstudio-view label,
#acnSubmitWrapper label {
    color: #000;
    font-weight: normal;
    width: auto;
}
.cstudio-view a,
#acnVersionWrapper a,
#acnSubmitWrapper a {
    color: #0176B1;
    text-decoration: none;
}
.cstudio-dialogue-body .cstudio-view .status-icon {
    padding-top: 0;
    padding-bottom: 0;
    padding-right: 0;
    text-align: left;
}
.cstudio-view table,
table.dependencies-table-head,
#acnVersionWrapper table{
    margin: 0;
    padding: 0;
    border-collapse: collapse;
  background-color: transparent;
  border: 0;
}

table.dependencies-table td,
table.dependencies-table-head td{
  padding: 2px;
  boder: 0;
}

#acnVersionWrapper table.history-tbl {
  background-color: transparent;
  border: 0;
  margin: 0;
  padding: 0;
}

#acnVersionWrapper table.history-tbl td {
  padding: 2px;
  border: none;
    vertical-align: top;
}

#acnVersionWrapper table.history-tbl.history-listing td {
  color: #000000;
}

#acnVersionWrapper label {
  width: auto;
}

#acnVersionWrapper .pub-channel select {
  display: inline;
  margin: 0;
}

/* * * * * * * * * * * * * * */
body, var
{
  margin:0;
}

#acn-wrapper a
{
  color:#0176b1;
  text-decoration:none;
}

#acn-wrapper-link a:hover
{
  color:#005986;
  background:none;
}

#acn-wrapper
{
  min-width:1024px;
  width:100%;
}

#acn-wcm-logo
{
  float:left;
  margin:0 0 0 10px;
  padding:0;
}

#authoringContextNavHeader
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/bg/bar_shadow.png') repeat-x bottom;
  height:33px;
  position:fixed;
  top:0;
  left:0;
  width:100%;
  z-index:100;
  font:12px Arial, Verdana, sans-serif;
}

#acn-bar
{
  background:#ccc url('${urlBase}/static-assets/themes/cstudioTheme/images/bg/bar_bg.gif') repeat-x left;
  height:30px;
  margin:0;
  min-width:960px;
  position:relative;
  width:100%;
  whitespace:no-wrap;
}

#acn-group
{
  float:left;
  margin:0;
  width:80%;
}

div#acn-active-content
{
  padding:2px 0 0;
}

div.acn-link
{
  background : url( '${urlBase}/static-assets/themes/cstudioTheme/images/bg/widget_vertical_divider.png' ) no-repeat scroll left center;
  float:left;
  margin:6px 0 0 0;
  color: #FFF;
  <#if previewMode == true>
  padding: 0 5px 0;
  <#else>
  padding: 1px 5px 0;
  </#if>
  text-align: center;
}

div.acn-link a
{
  border-right:1px solid #fff;
  line-height:12px;
  padding:0 5px 0 5px;
}
div.acn-link img
{
  display: none;
  height:10px;
  float:right;
}
div#acn-active-content div.acn-link-last a
{
  border-right:none;
}

#acn-render
{
  float:left;
  padding-top:0;
}

#contextual_nav_menu_items .yui-resize-label
{
  padding-left:22px;
}

#contextual_nav_menu_items
{
  padding-top:2px;
}

#acn-group .acn-image
{
  float:left;
  margin:0 0 0 10px;
  padding:0;
}

.acn-taxonomy
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/taxonomy_small.gif') no-repeat scroll 0 4px transparent;
  padding:5px 0 0 20px;
    color: #666;
    font-style: italic;
}

.acn-taxonomy-category
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/category_small.gif') no-repeat scroll 0 4px transparent;
  padding:5px 0 0 20px;
  color: #666;
    font-style: italic;
}

.acn-navTitle
{
  float:left;
  color:#000;
  margin:4px 0 10px 6px;
}

.acn-default-navTitle
{
  float:left;
  color:#000;
  margin:6px 10px 0;
}

#acn-render ul
{
  float:left;
  margin:0;
  list-style:none;
}

.acn-render li
{
  color:#fff;
  float:left;
  margin:5px 10px 0;
  list-style:none;
}

#acn-li
{
  color:#fff;
  float:left;
  margin:0 0 0 10px;
  list-style:none;
}

#acn-wcm-logo .acn-logo-image
{
  style:none;
  border:0;
}

#acn-right
{
  position:absolute;
  margin:0 10px 0 0;
  text-align:right;
  top:0;
  right:0;
  width:auto;
}

#acn-ice-tools-container
{
  padding: 4px 8px 5px 0;
  cusor: pointer;
  background: url('${urlBase}/static-assets/themes/cstudioTheme/images/bg/bar_vertical_divider.gif') repeat-y scroll right center transparent;
  cursor: pointer;
}

#acn-ice-tools-image
{
  padding-top: 2px;
  cursor: pointer;
}


#acn-preview-tools-container
{
  padding: 4px 12px 5px 8px;
  cusor: pointer;
  background: url('${urlBase}/static-assets/themes/cstudioTheme/images/bg/bar_vertical_divider.gif') repeat-y scroll right center transparent;
  cursor: pointer;
}

#acn-preview-tools-image
{
  padding-top: 2px;
  cursor: pointer;
}

#acn-search
{
  float:left;
  _margin:5px 0 0 0;
  margin:5px 0 0;
  text-align:right;
  padding-right: 5px;
  width:162px;
}

#acn-search input
{
  border:1px solid #0176B1;
  color:#000;
  font-size:1em;
  height:17px;
  margin:0;
  margin-right:3px;
  padding:1px 0 0 2px;
  width:148px;
}

#acn-logout
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/bg/bar_vertical_divider.gif') repeat-y left;
  float:right;
  height:25px;
  width:45px;
  margin:0;
  padding:5px 0 0 10px;
}

#acn-logout a
{
  display:block;
  padding:3px 0 0;
}

#authoringContextNavHeader table {
  font-size: inherit;
  background-color: transparent;
}
#authoringContextNavHeader table.ygtvtable td.ygtvcontent span { cursor: pointer; }

#authoringContextNavHeader,.acn-dropdown-wrapper .acn-dropdown-menu-inner
{
  font-size:12px;
}

#authoringContextNavHeader a,#authoringContextNavHeader a:hover,#authoringContextNavHeader a:visited,.acn-dropdown-wrapper a,.acn-dropdown-wrapper a:hover,.acn-dropdown-wrapper a:visited
{
  background-color:transparent;
  text-decoration:none;
  border:none;
  cursor: pointer;
}

/* WCM Styles */

.yuimenu li.menu-separator
{
  margin: -5px 0 0 0;
}

.yuimenu li.menu-separator a div
{
  text-indent: -99999px;
  background: url('${urlBase}/static-assets/themes/cstudioTheme/images/bg/bar_shadow.png') repeat-x 0 center;
}

*.unselectable {
   -moz-user-select: none;
   -khtml-user-select: none;
   -webkit-user-select: none;
   user-select: none;
}

.acn-dropdown-wrapper
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/bg/bar_vertical_divider.gif') repeat-y left;
  font-size:12px;
  margin:0 0 0 10px;
  padding:0;
  height:30px;
  float:left;
}

.acn-dropdown-wrapper .acn-dropdown
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/bg/bar_vertical_divider.gif') repeat-y right;
  float:left;
  height:30px;
  margin:0 0 0 10px;
  padding:0 10px 0 0;
}

.acn-dropdown-wrapper .acn-dropdown-inner
{
  padding:8px 0 0;
}

.acn-dropdown-wrapper .acn-drop-arrow
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat;
  background-position:70px -43px;
  padding-right:12px;
  width:100%;
}

.acn-dropdown-wrapper .acn-dropdown-menu-wrapper
{
  background-color:#cdcdcd;
  border-width:0 2px 1px 0;
  border-style:none solid solid none;
  border-color:#a1a1a1;
  left:0;
  position:absolute;
  top:31px;
  z-index:100;
}

.acn-dropdown-wrapper .acn-dropdown-menu
{
  background-color:#f0f0f0;
  padding:10px 10px 10px 10px;
  overflow-y:scroll;
  overflow-x:hidden;
  text-align:left;
}

.acn-dropdown-wrapper .acn-dropdown-menu select
{
  border:1px solid #0176B1;
  color:#000;
  font-size:1em;
  position:relative;
  width:100%;
  <#if previewMode == true>
  background:#ffffff;
  padding:0;
  border-radius:0;
  box-shadow:0;
  -moz-border-radius:0;
  </#if>
}

.acn-dropdown-wrapper .acn-dropdown-menu-inner
{
  padding:1px 0 0;
  color:#0176B1;
}

.acn-dropdown-wrapper .acn-dropdown-menu a
{
  display:block;
  white-space:nowrap;
  list-style:none;
  margin:0 0 2px;
}

.acn-dropdown-menu-wrapper .yuimenu
{
  background:#FFF;
  margin:0;
  padding:0;
}

.yuimenu li
{
  margin:0 auto 5px;
}

.acn-dropdown-menu-wrapper .yuimenu .yuimenuitemlabel
{
  font-size:12px;
  line-height:15px;
  padding:0 10px;
  text-align:left;
  color:#444 !important;
}

.acn-dropdown-menu-wrapper .yuimenu .yuimenuitemlabel-selected
{
  background-color:#D0D0D0 !important;
}

.acn-dropdown-menu-wrapper .yuimenu .yuimenuitemlabel-disabled
{
  color:#aaa !important;
}

.yuimenu .bd
{
  border:1px #444 solid;
  padding-top:5px;
}

.yui-resize .yui-resize-handle-br
{
  height:13px;
  width:12px;
}

.yui-skin-cstudioTheme .yui-resize .yui-resize-handle-br
{
  background-position:-20px -58px;
}

.yui-skin-cstudioTheme .yui-resize .yui-resize-handle
{
  background-color: transparent;
}

.yui-skin-cstudioTheme .yui-resize .yui-resize-handle-active
{
  background-color: transparent;
}

.yuimenuitem
{
  margin:0 0 5px;
}

.acn-dropdown-wrapper .acn-dropdown-menu li
{
  border-bottom:1px dotted #666;
  white-space:nowrap;
  list-style:none;
  margin:5px 0 0;
  padding:0 0 5px;
}

.acn-dropdown-wrapper .acn-dropdown-menu div.acn-parent div.acn-parent {
  padding:0;
}

.acn-dropdown-wrapper .acn-dropdown-menu div.acn-parent
{
  border-bottom:1px dotted #999;
  /*margin:0 10px 0 0;*/
  padding:7px 0;
}

.acn-dropdown-wrapper .acn-dropdown-menu li.last
{
  border-width:0;
  padding-bottom:40px;
}

.acn-dropdown-wrapper .acn-dropdown-menu li.acn-parent ul
{
  padding:0 0 0 17px;
}

.acn-admin-console
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_sm_gears.png') no-repeat left;
  padding: 6px 0 0 21px;
}

.acn-dropdown-wrapper .acn-dropdown-menu .acn-previewsync
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat left;
  background-position:0 -1195px;
  padding:2px 0 0 18px;
}


.acn-dropdown-wrapper .acn-dropdown-menu .acn-parent-folder
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat left;
  background-position:0 -101px;
  padding:2px 0 0 18px;
}

.acn-dropdown-wrapper .acn-dropdown-menu .acn-parent-folder.loading
{
  background: transparent url('${urlBase}/static-assets/themes/cstudioTheme/images/treeview-loading.gif') no-repeat scroll 0 center;
  font-style: italic;
}

.acn-dropdown-wrapper .acn-dropdown-footer
{
  position:relative;
  text-align:right;
  width:inherit;
}

.acn-dropdown-wrapper .acn-dropdown-footer-resize
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat right #CDCDCD;
  background-position:100% -599px;
  height:20px;
  position:relative;
  width:inherit;
  min-width:20px;
}

.acn-doc
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -201px;
  padding:2px 0 0 18px;
}

.acn-page
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -201px;
  padding:2px 0 0 17px;
    cursor: pointer;
}

.acn-page-progress
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -221px;
  padding:2px 0 0 17px;
  cursor: pointer;
}

.acn-page-submitted
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -241px;
  padding:2px 0 0 17px;
  cursor: pointer;
}

.acn-page-scheduled
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -261px;
  padding:2px 0 0 17px;
  cursor: pointer;
}

.acn-page-submitted-scheduled
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -281px;
  padding:2px 0 0 17px;
  cursor: pointer;
}

.acn-page-deleted
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -660px;
  padding:2px 0 0 17px;
}

span.acn-page-deleted a, span.acn-page-deleted a:hover{
  color: #808080;
}

.acn-page-deleted-submitted
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -660px;
  padding:2px 0 0 17px;
}

.acn-page-deleted-scheduled
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -740px;
  padding:2px 0 0 17px;
}

.acn-page-deleted-submitted-scheduled
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -740px;
  padding:2px 0 0 17px;
}

.acn-page-floating
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -301px;
  padding:2px 0 0 17px;
  cursor: pointer;
}

.acn-page-floating-progress
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -321px;
  padding:2px 0 0 17px;
  cursor: pointer;
}

.acn-page-floating-submitted
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -341px;
  padding:2px 0 0 17px;
  cursor: pointer;
}

.acn-page-floating-scheduled
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -361px;
  padding:2px 0 0 17px;
  cursor: pointer;
}

.acn-page-floating-submitted-scheduled
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -381px;
  padding:2px 0 0 17px;
  cursor: pointer;
}

.acn-page-floating-deleted
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -680px;
  padding:2px 0 0 17px;
}

.acn-page-floating-deleted-submitted
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -680px;
  padding:2px 0 0 17px;
}

.acn-page-floating-deleted-scheduled
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -760px;
  padding:2px 0 0 17px;
}

.acn-page-floating-deleted-submitted-scheduled
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -760px;
  padding:2px 0 0 17px;
}

.acn-document
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -401px;
  padding:2px 0 0 17px;
}

.acn-document-progress
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -421px;
  padding:2px 0 0 17px;
}

.acn-document-submitted
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -441px;
  padding:2px 0 0 17px;
}

.acn-document-scheduled
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -461px;
  padding:2px 0 0 17px;
}

.acn-document-submitted-scheduled
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -481px;
  padding:2px 0 0 17px;
}

.acn-document-deleted
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -700px;
  padding:2px 0 0 17px;
}

.acn-document-deleted-submitted
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -700px;
  padding:2px 0 0 17px;
}

.acn-document-deleted-scheduled
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -780px;
  padding:2px 0 0 17px;
}

.acn-document-deleted-submitted-scheduled
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -780px;
  padding:2px 0 0 17px;
}

.acn-component
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -501px;
  padding:2px 0 0 18px;
}

.acn-component-progress
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -521px;
  padding:2px 0 0 17px;
}

.acn-component-submitted
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -541px;
  padding:2px 0 0 17px;
}

.acn-component-scheduled
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -561px;
  padding:2px 0 0 17px;
}

.acn-component-submitted-scheduled
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -581px;
  padding:2px 0 0 17px;
}

.acn-component-deleted
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -720px;
  padding:2px 0 0 17px;
}

.acn-component-deleted-submitted
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -720px;
  padding:2px 0 0 17px;
}

.acn-component-deleted-scheduled
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -800px;
  padding:2px 0 0 17px;
}

.acn-component-deleted-submitted-scheduled
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -800px;
  padding:2px 0 0 17px;
}

.docMarked
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -440px;
  padding:2px 0 0 17px;
}

.archive
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -120px;
  padding:2px 0 0 17px;
}

.acn-parentDoc
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 1px;
  padding:2px 0 0 17px;
}

.acn-parentDocOpen
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -20px;
  padding:2px 0 0 17px;
}

.acn-parentDocOpen ul
{
  border:1px solid red;
}

.ygtvtn
{
  background-image:none;
  background-position:0 -5600px;
}

.ygtvrow td
{
  height:18px;
  padding-top:0;
}

.ygtvlp,.ygtvtm,.ygtvtp,.ygtvlph,.ygtvlphh,.ygtvtn,.ygtvtph,.ygtvtphh,.ygtvtmh,.ygtvtmhh,.ygtvlm,.ygtvln,.ygtvlmh,.ygtvlmhh,.ygtvrow .ygtvloading
{
  width:16px;
  height:18px;
  cursor:pointer;
  background-color:transparent;
  background-image:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif');
  background-repeat:no-repeat;
}

.ygtvlp,.ygtvtp,.ygtvlph,.ygtvlphh,.ygtvtph,.ygtvtphh
{
  background-position:0 0;
}

.ygtvtm,.ygtvtmh,.ygtvtmhh,.ygtvlm,.ygtvlmh,.ygtvlmhh
{
  background-position:0 -20px;
}

.ygtvln
{
  background-position:0 -1600px;
  background-image:none;
}

.ygtvdepthcell
{
  background-image:none;
  background-position:0 -8000px;
  width:16px;
}

.ygtvrow .ygtvloading
{
  background:transparent url('${urlBase}/static-assets/themes/cstudioTheme/images/treeview-loading.gif') no-repeat scroll 0 center;
}

.acn-dropdown-menu-wrapper .ygtvitem table,
.acn-dropdown-menu-wrapper .ygtvitem table tr td
{
  color:#0176B1 !important;
}

.acn-dropdown-menu-wrapper .yui-resize-label
{
  cursor:pointer;
}

#header span
{
  color:#0176B1;
}

.ygtvspacer
{
  height:12px;
  width:16px;
}

#acn-context-tooltipWrapper,
#acn-context-tooltipWrapper-search,
#acn-context-tooltipWrapper-widgets
{
  background:#f0f0f0;
  border:1px #444 solid;
  margin:0;
  padding:0;
  width:290px;
}

#acn-context-tooltipWrapper .bd,
#acn-context-tooltipWrapper-search .bd,
#acn-context-tooltipWrapper-widgets .bd
{
  background-color:#f0f0f0;
  border:1px #444 solid;
  margin:0;
  padding:0;
  width:290px;
  height:auto !important;
}

.acn-tooltip
{
  margin:5px auto;
  width:280px;
}

.acn-tooltip td
{
  font-size:12px;
  line-height:16px;
  padding-left:2px;
  text-align:left;
  vertical-align:top;
}

.acn-width80
{
  width:80px;
}

.acn-width130
{
  width:130px;
}

.acn-width180
{
  width:180px;
}

.acn-width200
{
  width:200px;
}

.acn-width100
{
  width:100%;
}

.tooltipicon
{
  background:transparent url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip.gif') -380px 0 no-repeat;
  display:inline-block;
  height:20px;
  left:1px;
  _position:none;
  position:none;
  vertical-align:middle;
  width:18px;
}

#tooltipWrapper
{
  background:#f0f0f0;
  border:1px #444 solid;
  margin:0;
  padding:0;
  width:290px;
}

#tooltipWrapper .bd
{
  background-color:#f0f0f0;
  border:1px #444 solid;
  margin:0;
  padding:0;
  width:290px;
}

.tooltip
{
  margin:5px auto;
  width:280px;
}

.tooltip td
{
  font-size:12px;
  line-height:20px;
  padding-left:2px;
  text-align:left;
  vertical-align:middle;
  white-space:nowrap;
}

#yui-gen0
{
  padding-bottom:3px;
  border-bottom:1px solid #a6a6a6;
}

.yuimenubar ul,.yuimenu ul,.yuimenubar li,.yuimenu li,.yuimenu h6,.yuimenubar h6
{
  margin:0 0 5px;
}

.ygtvblankdepthcell
{
  height:18px;
  width:16px;
}

#yui-gen1 div
{
  height:100%;
  top:0;
}

.yui-label-bold
{
  font-weight:bold;
}

#level1 .ygtvitem table tr:hover
{
  background-color:#E0E0E0;
}

#level1 .ygtvspacer
{
  padding-right:15px;
}

#level1 .ygtvdepthcell .ygtvspacer
{
  padding-right:0;
}

#level1 .ygtvblankdepthcell .ygtvspacer
{
  padding-right:0;
}

#level1 .ygtvchildren
{
  line-height:20px;
}

#level1 .ygtvlabel
{
  max-width:168px;
}

.ygtvrow .tr
{
  background:red;
}

.ygtvfocus
{
  background-color:inherit;
}

.yuimenu.wcm-root-folder-context-menu ul
{
  border-color:#CCCCCC;
  border-style:solid;
  border-width:0;
  padding:0;
}

.yuimenu.wcm-root-folder-context-menu .context-menu-load-msg
{
  background-color: #FFF;
  padding:0 5px;
  margin-top:-5px;
  font-style:italic;
  position:absolute;
  top:0;
  left:0;
}

#dropdownMenuWrapper
{
  background-color:#cdcdcd;
  border-width:0 2px 1px 0;
  border-style:none solid solid none;
  border-color:#a1a1a1;
  left:0;
  position:absolute;
  top:31px;
  z-index:100;
}

#dropdownMenu
{
  background-color:#f0f0f0;
  padding:10px 0 0;
  max-height:350px;
  overflow-y:scroll;
  overflow-x:hidden;
}

#dropdownMenu select
{
  border:1px solid #0176B1;
  color:#000;
  font-size:1em;
  position:relative;
  width:225px;
  <#if previewMode == true>
  background:#ffffff;
  padding:0;
  border-radius:0;
  box-shadow:0;
  -moz-border-radius:0;
  </#if>
}

.dropdownMenuInner
{
  padding:0 10px;
}

#dropdownMenu a,
#dropdownMenu li
{
  white-space:nowrap;
}

#dropdownMenu li.parent
{
  border-width:0 0 1px;
  border-style:dotted;
  margin:0 10px 0 0;
  padding:10px 0;
}

#dropdownMenu li.last
{
  border-width:0;
}

#dropdownMenu li.parent ul
{
  padding:0 0 0 17px;
}

.parentFolder
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat left;
  background-position:0 -101px;
  padding:2px 0 0 17px;
}

#dropdownFooter
{
  position:relative;
  text-align:right;
  width:inherit;
}

#dropdownFooterResize
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat right #CDCDCD;
  background-position:100% -599px;
  height:20px;
  position:relative;
  width:inherit;
  min-width:20px;
}

.doc
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -201px;
  padding:2px 0 0 15px;
}

.parentDoc
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 1px;
  padding:2px 0 0 17px;
}

.parentDocOpen
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat top;
  background-position:0 -20px;
  padding:2px 0 0 17px;
}

.parentDocOpen ul
{
  border:1px solid red;
}

#rejectionWrapper
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/bg/version_bg.gif') repeat-x;
  border:5px #333 solid;
  height:438px;
  margin:0 auto;
  padding:0;
  width:600px;
}

#rejectionContainer
{
  margin: 15px 25px 25px 25px;
}

.rejectionHeadertext
{
  color:#444;
  font-size:24px;
}

.rejectionSubtext
{
  font-size:12px;
  margin-top:2px;
}

.rejectionmaintext
{
  margin:14px 25px 15px 13px;
}

.rejectItemLayoutMargin
{
  padding-right:5px !important;
}

#rejectionscroll
{
  background-color:#FFF;
  border:1px solid #7f9db9;
  float:none;
  height:310px;
  margin:10px 0 0;
  overflow:auto;
  overflow-x:hidden;
  overflow-y:scroll;
  padding:0;
  width:548px;
  _width:548px;
}

.rejectionsubmitButton
{
  margin-top:17px;
  _margin-top:14px;
  text-align:center;
}

.rejectionsubmitButton input
{
  color:#333;
  font:12px Arial;
  height:25px;
  vertical-align:middle;
  width:74px;
}

#rejectionverticalWrapper
{
  display:block;
  height:1px;
  left:0;
  position:absolute;
  top:50%;
  width:100%;
}

#rejectionverticalContainer
{
  height:438px;
  left:50%;
  margin-left:-276px;
  position:absolute;
  top:-225px;
  width:600px;
}

#scheduleWrapper
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/bg/version_bg.gif') repeat-x;
  border:5px #333 solid;
  height:438px;
  margin:0 auto;
  padding:0;
  width:600px;
}

#scheduleContainer
{
  margin:15px 25px 25px;
}

.scheduleHeadertext
{
  color:#444;
  font-size:24px;
}

.schedulemaintext
{
  margin:11px 25px 15px 19px;
}

.schedulemaintext1
{
  clear:both;
  margin:14px 0 0 0;
}

#schedulescroll
{
  background-color:#FFF;
  border:1px solid #7f9db9;
  float:none;
  height:315px;
  margin:15px 0 0;
  overflow:auto;
  overflow-x:hidden;
  padding:0;
  width:548px;
  _width:548px;
}

.schedulesubmitButton
{
  margin-top:21px;
  _margin-top:18px;
  text-align:center;
}

.schedulesubmitButton input
{
  color:#333;
  font:12px Arial;
  height:25px;
  vertical-align:middle;
  width:74px;
}

#scheduleverticalWrapper
{
  display:block;
  height:1px;
  left:0;
  position:absolute;
  top:50%;
  width:100%;
}

#scheduleverticalContainer
{
  height:438px;
  left:50%;
  margin-left:-276px;
  position:absolute;
  top:-225px;
  width:600px;
}

div.acnBox {
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/bg/submit_bg.jpg') repeat-x;
  background-color:#d6d6d6;
  border:4px #000 solid;
  color:#000;
  margin:0;
  padding:15px 25px;
  position:relative;
  width:550px;
}


div.schedulePolicyWrapper{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/bg/submit_bg.jpg') repeat-x;
  background-color:#d6d6d6;
    border:4px #000 solid;
  color:#000;
  margin:0;
  padding:15px 25px;
  position:relative;
}

div.schedulePolicyContent{
  margin:0 0 15px 0;
  border: 1px solid #7F9DB9 ;
  overflow: auto;
  height: 330px;
  width: 510px;
  background: #FFFFFF;
  padding:15px 20px;

}

div.schedulePolicyWrapper h3
{
  font:normal 1.8em Arial !important;
  margin:0 !important;
}

div.acnBox h3.padBottom
{
  padding-bottom:15px !important;
}

div.acnBox p
{
  font-size:12px !important;
  margin:0 !important;
  padding:0 10px 5px 0 !important;
  text-align:justify;
}

div.acnBox p.center
{
  text-align:center;
}

div.acnBox div.acnBoxFloat
{
  overflow:hidden;
  width:550px;
}

div.acnBox div.acnBoxFloatLeft { float:left; margin:0; }
div.acnBox div.acnBoxFloatLeft .schedule-date { padding: 10px 0 4px 0; overflow: hidden; }
div.acnBox div.acnBoxFloatLeft span { display: block; }
div.acnBox div.acnBoxFloatLeft span.notice { padding-top: 3px; font-style: italic; }

div.acnBox div.acnBoxFloatRight
{
  float:right;
  padding-right:20px;
}

div.acnBox div.formRow
{
  margin:0;
  overflow:hidden;
  padding:0 10px 5px 0;
  width:550px;
}

div.acnBox div.formRow label
{
  float:left;
  padding:3px 5px 0 0;
  width:auto;
}

div.acnBox div.formRow div.field
{
  float:left;
}

div.acnBox div.radio
{
  padding-bottom:0;
}

div.acnBox div.radio div.field
{
  float:left;
  padding:.4166em 0 0;
  width:20px;
}

div.acnBox div.radio div.field input
{
  margin:0;
  padding:0;
}

div.acnBox div.radio label
{
  float:left;
  padding:.4166em 0 0;
}

div.acnBox div.radio div.textField
{
  padding:0 0 0 5px;
}

#timeIncrementButton {
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/bg/up.gif') no-repeat;
  width: 20px;
  height: 12px;
  border: none;
  margin: 1px 0 0 0;
  padding: 0;
  display: block;
  cursor: pointer;
}

#timeDecrementButton {
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/bg/down.gif') no-repeat;
  width: 20px;
  height: 12px;
  border: none;
  margin: -4px 0 0 0;
  padding: 0;
  display: block;
  cursor: pointer;
}

div.textField .calendarContainer {
  margin: 12px 5px 0;
}

.timeButtonContainer{
  position:relative;
  float:left;
  width:22px;
}

div.acnBox div.radio div.textField input
{
  height:15px;
  width:100px;
}

div.acnBox div.padTop
{
  padding-top: 5px;
}

div.acnBox div.padBottom
{
  padding-bottom: 8px;
}

div.acnBox div.acnScroll
{
  margin:0 0 10px;
  overflow:hidden;
  padding:0;
  width:550px;
}

div.acnBox div.acnScrollPadTop
{
  margin-top:5px;
  padding:0;
}

div.acnBox div.acnScroll h5
{
  background-color:#7f9db9;
  color:#fff;
  font-weight:normal;
  margin:0;
  overflow:hidden;
  padding:3px 20px 3px 27px;
  width:503px;
}

div.acnBox div.acnScroll h5 span.left
{
  display:block;
  float:left;
}

div.acnBox div.acnScroll h5 span.right
{
  display:block;
  float:right;
  padding-right:5px;
}

div.acnBox div.acnScroll div.acnScrollBox
{
  border:1px solid #7F9BD9;
  background-color:#fff;
  height: 280px;
  overflow-y: scroll;
  overflow-x: hidden;
  padding: 5px;
  width: 538px;
}

div.schedulePolicyWrapper div.schedulePolicySubmitButtons{
  text-align:center;
}

div.acnBox table.acnLiveTable
{
  width:540px !important;
}

div.acnBox table.acnLiveTable td
{
  padding:3px 0 0 0;
}

div.acnBox table.acnLiveTable td.acnLiveTableFileURI{
  width: 220px !important;
}

div.acnBox td.acnLiveTableRight div.acnGoLiveSetTime {
  width:80px;
  float:right;
  padding:0;
}

div.acnBox td.acnLiveTableRight div.acnGoLiveSetTime a,
div.acnBox td.acnLiveTableRight div.acnGoLiveSetTime a:hover,
.admin-delete-view table.dependencies-table .item-sch a,
.admin-delete-view table.dependencies-table .item-sch a:hover {
    color: #0176B1;
    cursor: pointer;
    text-decoration: none;
    <#if previewMode == true>
    background: none;
    </#if>
}

div.acnBox table.acnLiveTable td div
{
  float:left;
  padding:0 5px 0 0;
}

div.acnBox table.acnLiveTable td div.acnLiveTableCheckbox
{
  position:relative;
  padding-right:7px;
  height:20px;
  top:2px;
}

div.acnBox table.acnLiveTable td div.acnLiveCellIndented
{
  padding-left:20px;
}

div.acnBox table.acnLiveTable td.acnLiveTableFileName
{
  width:260px;
}

div.acnBox table.acnLiveTable td.acnLiveTableFileName div.icon
{
  height:20px;
  padding:0 0 0 20px;
}

div.acnBox table.acnLiveTable td.acnLiveTableFileName div.ttSubmitted
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif') no-repeat scroll 0 -241px transparent;
}

div.acnBox table.acnLiveTable td.acnLiveTableRight
{
  padding-right:20px;
  text-align:right;
  width: 100px;
}

#submitWrapper
{
  background:url('${urlBase}/static-assets/themes/cstudioTheme/images/bg/submit_bg.jpg') repeat-x;
  border:5px #333 solid;
  margin:0 auto;
  padding:0;
  width:600px;
}

#submitContainer
{
  margin:16px 25px 25px;
}

.submitHeadertext
{
  color:#444;
  font-size:24px;
}

.submitSubtext
{
  font-size:12px;
  margin:3px 0 0 2px;
}

.submitSub
{
  margin:22px 5px 5px 0;
}

.submitHead
{
  background-color:#7f9db9;
}

.submiticon
{
  background:transparent url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip.gif') -320px 0 no-repeat;
  display:inline-block;
  height:20px;
  left:1px;
    position: relative;
  _position:none;
    *position: none;
  vertical-align:middle;
  width:18px;
}

.datePickerInput
{
  background-image:url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_calendar.gif');
  background-position:right center;
  background-repeat:no-repeat;
  cursor:pointer;
}


#datepicker, #timepicker {
  cursor:pointer;
}

.submitdate, .submittime {
  border: 1px solid #0176B1 !important;
}

.submitsubtext
{
  margin:0;
}

#submitHeadtab
{
  background-color:#7f9db9;
}

.submitHeader
{
  color:#FFF;
    height: 20px;
    *height: 24px;
  _height:20px;
  padding:3px 0 0 8px;
  vertical-align:middle;
}

.submitSubhead
{
  background-color:#FFF;
}

#submitscroll
{
  background-color:#FFF;
  border:1px solid #7f9db9;
  float:none;
  height:250px;
  margin:-5px 0 0;
  _margin:0;
  overflow:auto;
  overflow-x:hidden;
  padding:0;
  width:548px;
  _width:548px;
}

.submitSubheader td
{
  line-height:17px;
  padding-left:8px;
  text-align:left;
  vertical-align:middle;
  white-space:nowrap;
}

.submitblankrow
{
  background-color:#FFF;
  height:8px;
  line-height:8px;
}

.submitlivesubmitButton
{
  margin-top:17px;
  _margin-top:14px;
  text-align:center;
}

.submitlivesubmitButton input
{
  color:#333;
  font:12px Arial;
  height:24px;
  vertical-align:middle;
  width:74px;
}

#submitverticalWrapper
{
  display:block;
  height:1px;
  left:0;
  position:absolute;
  top:50%;
  width:100%;
}

#submitverticalContainer
{
  height:438px;
  left:50%;
  margin-left:-276px;
  position:absolute;
  top:-225px;
  width:600px;
}

.radiobutton
{
  margin:3px 0 0;
}

.textradio
{
  margin:0;
  text-align:left;
  vertical-align:top;
}

.marginheight
{
  margin-top:10px;
}

#submitPanel .bd
{
  padding:0;
  border: 0;
  margin: 0;
  text-align: left;
}

#schedulePolicyPanel .bd{
  padding:0;
  border: 0;
  margin: 0;
  width:610px;
}

#liveWrapper
{
  margin:0 auto;
  padding:0;
  width:600px;
  height:440px;
  border:5px solid #333333;
  background:transparent url('${urlBase}/static-assets/themes/cstudioTheme/images/bg/submit_bg.jpg') repeat-x scroll 0 0;
}

#liveContainer
{
  margin:15px 25px 25px;
}

.liveHeadertext
{
  color:#444;
  font-size:24px;
}

.liveSubtext
{
  font-size:12px;
  margin:3px 0 0 2px;
}

.liveSub
{
  margin:2px 8px 8px 0;
}

.liveHead
{
  background-color:#7f9db9;
}

.liveicon
{
  background:transparent url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip.gif') -320px 0 no-repeat;
  display:inline-block;
  height:19px;
  left:1px;
  _margin-top:3px;
  _position:none;
  position:none;
  vertical-align:middle;
  width:18px;
}

.liveicon1
{
  background:transparent url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip.gif') -380px 0 no-repeat;
  display:inline-block;
  height:19px;
  left:1px;
  _margin-top:3px;
  _position:none;
  position:none;
  vertical-align:middle;
  width:18px;
}

.livesubtext
{
  margin:0;
}

#liveHeadtab
{
  background-color:#7f9db9;
}

.liveHeader
{
  color:#FFF;
  height:24px;
  _height:20px;
  padding:3px 10px 0 28px;
  _padding:3px 10px 0 28px;
  vertical-align:middle;
}

.liveSubhead
{
  background-color:#FFF;
}

#livescroll
{
  background-color:#FFF;
  border:1px solid #7f9db9;
  float:none;
  height:265px;
  margin:0;
  _margin:0;
  overflow:auto;
  overflow-x:hidden;
  overflow-y:scroll;
  padding:0;
  width:548px;
  _width:548px;
}

.liveblankrow
{
  background-color:#FFF;
  height:8px;
  line-height:8px;
}

.livesubmitButton
{
  margin-top:13px;
  _margin-top:10px;
  text-align:center;
}

.livesubmitButton input
{
  color:#333;
  font:12px Arial;
  height:24px;
  vertical-align:middle;
  width:74px;
}

#liveverticalWrapper
{
  display:block;
  height:1px;
  left:0;
  position:absolute;
  top:50%;
  width:100%;
}

#liveverticalContainer
{
  height:438px;
  left:50%;
  margin-left:-305px;
  position:absolute;
  top:-225px;
  width:600px;
}

.liveTable
{
  background-color:#FFF;
  border:none;
  width:100%;
}

.liveTable td
{
  line-height:14px;
  text-align:left;
  vertical-align:middle;
  white-space:nowrap;
}

.liveTable td.alignRight,th.alignRight
{
  text-align:right;
}

.liveTable td.alignCenter,th.alignCenter
{
  text-align:center;
}

.liveColLast
{
  padding-right:20px;
  _padding-right:35px;
}

.liveFirstCol12
{
  padding-left:1px;
  vertical-align:middle;
}

.livetext
{
  margin-top:12px;
  text-align:center;
}

.liveFirstCol128
{
  padding-left:21px;
  vertical-align:middle;
}

.livecancelButton
{
  margin-left:10px;
}

.liveItemName
{
  padding-left:20px;
  padding-right:5px;
  position: relative !important;
  top: 3px;
}

.wcm-widget-margin {
  margin-left: 5px;
}

#goLivePopWrapper
{
  background:#d6d6d6;
  border:1px #7f9db9 solid;
  height:53px;
  padding:0;
  width:256px;
}
#goLivePopWrapper .clear {
    clear: both;
    display: block;
    height: 1px;
    overflow: hidden;
    margin: 0;
    padding: 0;
}

.goLivePopRadio
{
  float:left;
  width:17px;
  padding:2px 5px 0 0;
}

.goLivePopDate
{
  background:#fff;
  border:1px solid #7f9db9;
  float:left;
  height:20px;
  margin:0 0 5px 2px;
  width:98px;
}

.goLivePopTime
{
  background:#fff;
  border:1px solid #7f9db9;
  float:left;
  height:20px;
  margin:0 0 5px 3px;
  width:71px;
}

.goLivePopIcondDate
{
  background:transparent url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/topdown.jpg') no-repeat;
  display:inline-block;
  float:left;
  height:20px;
  left:1px;
  margin:2px 0 0 3px;
  _position:none;
  position:none;
  vertical-align:middle;
  width:18px;
}

.goLivePopText
{
  color:#ccc;
  padding:1px 0 0 5px;
  float:left;
  font-size: 12px;
    font-weight: normal;
    line-height: 14px;
}

.goliveEst
{
  float:left;
  padding:1px 0 0 3px;
}

.goLiveRight
{
  border:0;
  float:right;
  margin:0;
  padding:0;
}

.goLiveTopRight
{
  float:right;
  padding:0 8px 0 0;
}

.goLivePopTextTop
{
  color:#000;
  padding:1px 0 0 3px;
  float:left;
}

.rejectTopBox
{
  margin-top:9px;
  border:1px solid #7F9BD9;
  width\*:547px;
}

.rejectTitle
{
  background-color:#7F9DB9;
  height:20px;
  width:550px;
  width\*:547px;
}

.rejectTitlePage
{
  color:#FFFFFF;
  margin-left:25px;
  _margin-left:13px;
  float:left;
}

.rejectSubmittedBy
{
  color:#FFFFFF;
  float:right;
  margin-right:28px;
  _margin-right:14px;
}

.rejectListArea
{
  height:106px;
  overflow-y:scroll;
  width:550px;
  width /*\*/:547px\9;
  background-color:white;
}

.rejectTable
{
  background-color:#FFF;
  height:106px;
  width:100%;
}

#rejectscroll
{
  background-color:#FFF;
  border:1px solid #7f9db9;
  float:none;
  height:106px;
  margin:0;
  _margin:0;
  overflow:auto;
  overflow-x:hidden;
  overflow-y:scroll;
  padding:0;
  width:549px;
  _width:549px;
}

.rejectRowCheck
{
  width:23px;
}

.rejectRowIcon
{
  width:24px;
}

.rejectRowContent
{
  width:380px;
}

.rejectRowContentHead
{
  width:40px;
}

.rejectRowSubmitted
{
  width:64px;
}

.rejectBoxSeperator
{
  margin:15px 0 38px;
  _margin:17px 0 -10px 0;
}

.rejectReason
{
  width:107px;
}

.rejectReasonDropDown
{
  width:443px;
  margin-bottom:3px;
  border:1px solid #7F9BD9;
  <#if previewMode == true>
  color:#000000;
  background:#ffffff;
  padding:0;
  border-radius:0;
  box-shadow:0;
  -moz-border-radius:0;
  </#if>
}

.rejectBottomBox
{
  border:1px solid #7F9BD9;
  height:139px;
}

.rejectTextarea
{
  width:547px;
    width /*\*/:540px\9;
  height:145px;
  overflow-y:scroll;
}

.rejectButtons
{
  margin-top:17px;
  _margin-bottom:-10px;
  text-align:center;
}

.rejectCancel
{
  margin-left:10px;
}

.rejectButtons input
{
  color:#333;
  font:24px Arial;
  vertical-align:middle;
}

.rejecticon
{
  background:transparent url('${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip.gif') -240px 0 no-repeat;
  display:inline-block;
  float:left;
  height:18px;
  left:0;
  margin-top:1px;
  _margin-top:2px;
    position: relative;
  _position:none;
    *position: none;
  vertical-align:middle;
  width:16px;
}

.ellipsisblock76
{
  width:76px;
}

.ellipsisblock160
{
  width:160px;
}

.ellipsisblock165
{
  width:165px;
}

.ellipsisblock155
{
  width:155px;
}

.ellipsisblock270
{
  width:270px;
}

.ellipsisblock330
{
  width:330px;
}


#submitPanel_c {
  padding:0 0 0 0;
}

#submitPanel {
  border:0;
  border-bottom:none;
  border-top:none;
}

/* yui calendar/datepicker global styles*/
div.yui-calcontainer{
  background-color: #F2F2F2;
  border: 1px solid #d4d4d4;
  position: absolute;
  margin: 10px 0 0 0;
  width: 188px;
  z-index: 100;
}

.yui-calendar th.calhead{
  background-color: #F2F2F2;
  height: 20px;
  width: 200px;
}

.yui-calendar div.calheader{
  padding-top: 7px;
}

.yui-calendar a.calnavleft{
  background:transparent url('${urlBase}/yui/assets/skins/default/sprite.png') no-repeat scroll 0 -450px;
  top: 7px;
  left: -10px;
}

.yui-calendar a.calnavright{
  background:transparent url('${urlBase}/yui/assets/skins/default/sprite.png') no-repeat scroll 0 -500px;
  top: 7px;
  right: -10px;
}

div#cal1Container{
  padding: 1px;
}

.yui-calendar td.calcell {
  background: #fff;
  border: 0;
  #padding: 5px;
}

.yui-calendar td.calcell{
  background-color: #e6e6e6 !important;
  color: #a6a6a6 !important;
  border: 1px solid #e6e6e6 !important;
}

.yui-calendar td.calcell a{
  color: #0066CC;
}

.yui-calendar td.calcell.oom {
  background-color: #f6f6f6 !important;
  color: #e9e8eb !important;
  cursor: default;
  padding: 2px ;
  border: 1px solid #e6e6e6 !important;
}

table.yui-calendar{
  border-collapse: separate;
  border-spacing: 2px;
}

.yui-calendar td.calcell.today{
  background-color: #fff !important;
  color: #a6a6a6 !important;
  border: 1px solid #fcf1ae !important;
}

.yui-calendar td.calcell.today a{
  background-color: #fff !important;
  color: #0066CC !important;
}

.yui-calendar td.calcell.calcellhover{
  background-color: #fff !important;
  color: #a6a6a6 !important;
  border: 1px solid #fcf1ae !important;
}

.yui-calendar td.calcell.calcellhover a {
  background-color: #fff !important;
  color: #a6a6a6 !important;
}

/*

#level1
{
  margin:0;
}

#acn-context-menuWrapper ul
{
  border-color:#CCCCCC;
  border-style:solid;
  border-width:0;
  padding:0;
}

#acn-context-menuWrapper
{
  background:#FFF;
  border:1px #444 solid;
  margin:0;
  padding:0;
  width:68px;
}

#acn-context-menuWrapper .yuimenuitemlabel
{
  font-size:12px;
  line-height:22px;
  padding-left:5px;
  text-align:left;
  vertical-align:middle;
  white-space:nowrap;
}

#acn-context-menuWrapper a
{
  color:#000000;
}


#level1 .yuimenubar ul,.yuimenu ul,.yuimenubar li,.yuimenu li,.yuimenu h6,.yuimenubar h6
{
  margin:0 auto 5px;
}

#level1 .yui-skin-cstudioTheme .yuimenu .bd
{
  border:0 #444 solid;
}

.yui-skin-cstudioTheme .yui-menu-shadow-visible
{
  display:none;
}

#level1 .yuimenuitem
{
  margin:0 auto 5px;
  width:100%;
}

#level1 .ygtvitem
{
  line-height:13px;
}

#level1 .ygtvitem table
{
  width:100%;
}

#level1 .ygtvrow
{
  width:100%;
  vertical-align:middle;
  height:18px;
}

#level1 .ygtvrow td
{
  overflow:hidden;
  vertical-align:middle;
  height:18px;
}

#level1 .ygtvcontent
{
  overflow:hidden;
}

#level1 .yui-resize-label
{
  overflow:hidden;
  display:inline-block;
  color:#0176B1;
  font-size:12px;
}
*/

/* CSS for preview server dialog icons */
.document {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -398px;
  display: inline-block;
  padding-left: 20px;
  float: left;
}

.madeLiveDocument {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -398px;
  display: inline-block;
}

.documentSubmitted {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -441px;
  display: inline-block;
}

.documentScheduled {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -461px;
  display: inline-block;
}

.documentSubmittedScheduled {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -481px;
  display: inline-block;
}

.documentInProgress {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -421px;
  display: inline-block;
}

.documentDeleted {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -701px;
  display: inline-block;
}

.documentDeletedSubmitted {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -701px;
  display: inline-block;
}

.documentDeletedScheduled,
.documentDeletedSubmittedScheduled {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -781px;
  display: inline-block;
}

.documentApprovedScheduled {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -461px;
  display: inline-block;
}


.ttFloating {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -301px;
  display: inline-block;
}

.ttFloatingSubmitted {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -341px;
  display: inline-block;
}

.ttFloatingScheduled {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -361px;
  display: inline-block;
}

.ttFloatingSubmittedScheduled {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -381px;
  display: inline-block;
}

.ttFloatingInProgress {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -321px;
  display: inline-block;
}

.ttFloatingDeleted {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -680px;
  display: inline-block;
}

.ttFloatingDeletedSubmitted {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -680px;
  display: inline-block;
}

.ttFloatingDeletedScheduled {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -760px;
  display: inline-block;
}

.ttFloatingDeletedSubmittedScheduled {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -760px;
  display: inline-block;
}

.ttFloatingApprovedScheduled {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -361px;
  display: inline-block;
}

.ttSubmitted {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -241px;
  display: inline-block;
}

.ttScheduled {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -261px;
  display: inline-block;
}

.ttSubmittedScheduled {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -281px;
  display: inline-block;
}

.ttDeleted {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -661px;
  display: inline-block;
}

.ttDeletedSubmitted {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -661px;
  display: inline-block;
}

.ttDeletedScheduled {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -740px;
  display: inline-block;
}

.ttDeletedSubmittedScheduled {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -740px;
  display: inline-block;
}

.ttInProgress {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -221px;
  display: inline-block;
}

.ttApprovedScheduled {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -261px;
  display: inline-block;
}

.component {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -498px;
  display: inline-block;
  padding-left: 20px;
  float: left;
}

.madeLiveComponent {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -498px;
  display: inline-block;
}

.componentSubmitted {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -541px;
  display: inline-block;
}

.componentScheduled {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -561px;
  display: inline-block;
}

.componentSubmittedScheduled {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -581px;
  display: inline-block;
}

.componentInProgress {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -521px;
  display: inline-block;
}

.componentDeleted {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -721px;
  display: inline-block;
}

.componentDeletedSubmitted {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -721px;
  display: inline-block;
}

.componentDeletedScheduled {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -800px;
  display: inline-block;
}

.componentDeletedSubmittedScheduled {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -800px;
  display: inline-block;
}

.componentApprovedScheduled {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -561px;
  display: inline-block;
}

.navPage {
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif) no-repeat;
  background-position: 0 -201px;
  display: inline-block;
}

/* canned search icon */
span.acn-canned-search{
  background: url(${urlBase}/static-assets/themes/cstudioTheme/images/icons/magnify-icon.jpg) no-repeat;
  background-repeat: no-repeat;
  padding: 0 0 0 16px;
}

/* added for copy items.*/
.contentTypePopupContent {
  text-align:left;
}

.copy-content-container {
  margin: 10px 0 10px 0;
  height: 292px;
  overflow: hidden;
  width: 546px;
}

.copy-content-container h5 {
  background-color: #7F9DB9;
  color: #FFFFFF;
  font-weight: normal;
  margin-bottom: 0;
  overflow: hidden;
  padding: 3px 20px;
}

.copy-content-container h5 span {
  display:block;
  float:left;
}

.copy-content-container div.scrollBox {
  background-color: #FFFFFF;
  border: 1px solid #7F9BD9;
  height: 267px;
  overflow-x: hidden;
  overflow-y: scroll;
  position: relative;
  width: 544px;
  padding: 2px 0 0;
}

.copy-content-container ul div{
  margin-left:2px;
  padding-right: 10px;
}

.copy-content-container ul div div{
  margin-left: 17px;
}

.copy-content-container ul {
  margin: 0;
}

.copy-content-container ul li {
  margin:5px 0 5px 15px;
  list-style-type: none;
}

.copy-content-container ul input {
  vertical-align:bottom;
  margin-right: 2px;
}

#authoringContextNavHeader .no-preview, .no-preview,
#authoringContextNavHeader .folder, .folder {
  color: #808080 !important;
  cursor:default !important;
}

.submitdtext {
  color: #ccc;
  margin: 1px 0 0 5px;
  float: left;
}

.submitdate {
  border: 1px solid #7f9db9;
  float: left;
  height: 18px;
  margin: 0 0 5px 5px;
  width: 100px;
  padding:1px 0;
}

.submittime {
  background: #fff;
  border: 1px solid #7f9db9;
  float: left;
  height: 18px;
  margin: 0 0 5px 5px;
  width: 74px;
  padding:1px 0;
}

<#if previewMode == true>
.contentTypePopupBtn .cstudio-xform-button {
  padding:0 6px 0 6px;
}

body.masked {
  overflow:auto !important;
}
</#if>

/* --- Preview Tools Overlay --- */
#preview-tools-panel-container{
  border: 1px solid black;
  width: 200px;
  height: 200px;
  background: #F0F0F0;
}

/* -- default styles -- */
#preview-tools-panel-container div, #preview-tools-panel-container span, #preview-tools-panel-container select, #preview-tools-panel-container option,
#preview-tools-panel-container a {
    direction: ltr; font: normal normal normal 12px/normal arial, sans-serif; font-size-adjust: none; font-stretch: normal;
    letter-spacing: normal; line-height: normal; text-align: left; text-indent: 0; text-justify: auto; text-outline: none; text-shadow: none;
    text-transform: none; white-space: normal; word-spacing: normal; word-break: normal; word-wrap: normal;
}
#preview-tools-panel-container div, #preview-tools-panel-container span, #preview-tools-panel-container select, #preview-tools-panel-container option { color: #444; cursor: auto; }

#preview-tools-panel-container #preview-tools-panel-container_h {
  color: #0176B1;
  background: #FFFFFF;
  font-size: 14px;
  line-height: 1.2em;
  font-weight: bold;
  padding-left: 14px;
}

#preview-tools-panel-container .acn-accordion-header {
  background: url("${urlBase}/static-assets/themes/cstudioTheme/images/bg/bar_bg.gif") repeat-x scroll 0 0 #F0F0F0;
    border-bottom: 1px solid #A1A1A1;
    height: 22px;
    margin: 0;
    padding: 3px 15px 0 15px;
}

#preview-tools-panel-container .acn-accordion-toggle {
    background-color: transparent;
  background-image: url("${urlBase}/static-assets/themes/cstudioTheme/images/icons/icon_strip_vertical.gif");
  background-repeat: no-repeat;
  background-attachment: scroll;
  color: #444444;
  display: inline-block;
  line-height: 20px;
  padding-left: 16px;
    text-decoration: none;
}

#preview-tools-panel-container .acn-accordion-panel {
  background: #F0F0F0;
  border-bottom: 1px solid #CCCCCC;
  padding: 5px;
}

#preview-tools-panel-container .contracted .acn-accordion-toggle { background-position: 0 1px; }
#preview-tools-panel-container .contracted .acn-accordion-panel { display: none; }

#preview-tools-panel-container .expanded .acn-accordion-toggle { background-position: 0 -19px; }
#preview-tools-panel-container .expanded .acn-accordion-panel { display: block; }

#preview-tools-panel-container .acn-ptools-button {
  display: inline;
    padding: 5px 10px;
}

#preview-tools-panel-container .acn-ptools-ice-label {
    display: inline;
}

#preview-tools-panel-container .acn-panel-dropdown {
    background: none repeat scroll 0 0 #FFFFFF;
    border: 1px solid #0176B1;
    margin: 5px 0 6px 10px;
    border-radius: 0 0 0 0;
    color: #000000;
    font-size: 1em;
    padding: 1px 0 1px 2px;
    position: relative;
    width: 93%;
}

#preview-tools-panel-container .acn-dropdown .ice-tools {
  padding-top: 5px;
}

#cstudio-emulate { z-index: 99999; }

.yui-carousel-content{
  left: 30px;
}

.yui-carousel {
    border: none;
    width: 100%;
}

.yui-carousel .yui-carousel-item-selected {
    border: none;
}

.yui-carousel-pager-item {
  display: none;
}

#preview-tools-panel-container_c.yui-panel-container span.yui-carousel-button {
  display: none;
}


#preview-tools-panel-container_c.yui-panel-container div#preview-tools-panel-container.yui-module div div.expanded div.acn-accordion-panel div div#container.yui-carousel-visible div.yui-carousel-nav ul {
  display:none;
}

#preview-tools-panel-persona-selected {
  width: 100px;
  height: 100px;
    margin-left: 70px;
  border: 1px solid black;
}

#preview-tools-panel-persona-selected-title {
  display:block !important;
    margin-top: 10px;
    text-align: center !important;
  color: #444444 !important
    font-size: 14px !important;
    font-weight: bold !important;
}

/** translated site: translateded asset */
.no-overlay {
  color: #9FB6CD !important;
}

/**
 * Bulk Upload Styles
**/

.full-screen-overlay {
    z-index: 99999;
    background: rgba(50, 50, 50, .8);
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    -webkit-box-shadow: inset 2px 1px 10px 5px rgba(200, 200, 200, .5);
    -moz-box-shadow: inset 2px 1px 10px 5px rgba(200, 200, 200, .5);
    box-shadow: inset 2px 1px 10px 5px rgba(200, 200, 200, .5);
    -webkit-transition: background 300ms ease;
    -moz-transition: background 300ms ease;
    -ms-transition: background 300ms ease;
    -o-transition: background 300ms ease;
    transition: background 300ms ease;
}

.full-screen-overlay .message {
    top: 20px;
    background: #ccc;
    /*border-radius: 10px;*/
    text-align: center;
    vertical-align: middle;
    font-size: 20px;
    height: 95px;
    overflow: auto;
}

.full-screen-overlay .message > * {
    font-size: 20px;
    line-height: 25px;
}

.full-screen-overlay .message .pad {
    padding: 25px;
    padding-bottom: 0;
}

.full-screen-overlay .close {
    background-color: rgba(200, 200, 200, 0.5);
    border-radius: 10px 10px 10px 10px;
    padding: 5px;
    position: absolute;
    right: 20px;
    text-decoration: none;
    top: 20px;
}

.full-screen-overlay .close:hover {
    background-color: rgba(200, 200, 200, 1);
}

.file-display-container .pad {
    padding: 15px;
}

.file-display-container {
    background: #fff;
    top: 140px;
    bottom: 20px;
    overflow: auto;
    min-height: 200px;
}

.file-display-container,
.full-screen-overlay .message {
    position: absolute;
    left: 50%;
    width: 450px;
    margin-left: -225px;
    border: 4px solid #000;
}

.dropbox-element.dropbox-dragover {
    background: rgba(10, 10, 10, .85);
}

.dropbox-element.dropbox-dragover {
    -webkit-box-shadow: inset 0 0 50px #777;
    -moz-box-shadow: inset 0 0 50px #777;
    box-shadow: inset 0 0 50px #777;
}

.dropbox-element .title {
    display: block;
}

.dropbox-element .detalis {
    font-style: italic;
}

.dropbox-element .dropbox-file-display {
    color: #fff;
    background-color: #7F9DB9;
    margin-bottom: 10px;
    padding-right: 10px;
}

.dropbox-element .dropbox-file-display img,
.dropbox-element .dropbox-file-display .img {
    float: left;
    width: 175px;
    height: 100px;
    margin-right: 10px;
    overflow: hidden;
    background-color: #ccc;
}

.dropbox-element .dropbox-file-display .img .pad {
    font-size: 15px;
    padding: 40px 20px;
    padding-bottom: 0;
    text-align: center;
}

.file-display-area {
    background-color: #FFFFFF;
    height: 300px;
    overflow: auto;
}

.dropbox-file-display .progress {
    margin: 10px 0;
}

/**
 * Progress bar styles from Twitter's Bootstrap */
.progress {
    height: 20px;
    margin-bottom: 20px;
    overflow: hidden;
    background-color: #f7f7f7;
    background-image: -moz-linear-gradient(top, #f5f5f5, #f9f9f9);
    background-image: -webkit-gradient(linear, 0 0, 0 100%, from(#f5f5f5), to(#f9f9f9));
    background-image: -webkit-linear-gradient(top, #f5f5f5, #f9f9f9);
    background-image: -o-linear-gradient(top, #f5f5f5, #f9f9f9);
    background-image: linear-gradient(to bottom, #f5f5f5, #f9f9f9);
    background-repeat: repeat-x;
    -webkit-border-radius: 4px;
    -moz-border-radius: 4px;
    border-radius: 4px;
    filter: progid:DXImageTransform.Microsoft.gradient(startColorstr='#fff5f5f5', endColorstr='#fff9f9f9', GradientType=0);
    -webkit-box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
    -moz-box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.progress .bar {
    float: left;
    width: 0;
    height: 100%;
    font-size: 12px;
    color: #ffffff;
    text-align: center;
    text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.25);
    background-color: #0e90d2;
    background-image: -moz-linear-gradient(top, #888, #333);
    background-image: -webkit-gradient(linear, 0 0, 0 100%, from(#888), to(#333));
    background-image: -webkit-linear-gradient(top, #888, #333);
    background-image: -o-linear-gradient(top, #888, #333);
    background-image: linear-gradient(to bottom, #888, #333);
    background-repeat: repeat-x;
    filter: progid:DXImageTransform.Microsoft.gradient(startColorstr='#ff149bdf', endColorstr='#ff0480be', GradientType=0);
    -webkit-box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.15);
    -moz-box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.15);
    box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.15);
    -webkit-box-sizing: border-box;
    -moz-box-sizing: border-box;
    box-sizing: border-box;
    -webkit-transition: width 0.6s ease;
    -moz-transition: width 0.6s ease;
    -o-transition: width 0.6s ease;
    transition: width 0.6s ease;
}
