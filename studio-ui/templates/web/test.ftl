<!DOCTYPE html>
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

<html lang="en">
<head>
	<script>
		CStudioAuthoring = {
			cookieDomain: "${cookieDomain}"
		}
	</script>
	<link rel="stylesheet" type="text/css" href="/studio/static-assets/css/diff.css" />
</head>
<body>
<style>
	.content {
		border: 1px solid black;
		display: block;
		padding: 10px;
		margin: 10px;
		overflow: scroll;
	}
</style>
<div class='content'>

	<table>
		<tr>
			<th width="500px">Test Name</th>
			<th width="100px">Duration</th>
			<th width="100px">Status</th>
			<th width="500px">Message</th>
		</tr>
		<#list tests as test>
			<#assign bgcolor = "red" />
			<#if test.status == true>
				<#assign bgcolor = "green" />
			</#if>

			<tr>
				<td width="500px">${test.name}</td>
				<td width="100px">${test.duration}</td>
				<td width="100px" style="background-color:${bgcolor};">${test.status?string('Pass', 'Fail')}</td>
				<td width="500px">${test.error!""}</td>
			</tr>
		</#list>
	</table>

</div>
</body>
</html>
