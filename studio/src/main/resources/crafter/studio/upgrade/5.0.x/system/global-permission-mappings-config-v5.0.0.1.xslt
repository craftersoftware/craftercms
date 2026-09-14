<?xml version="1.0" encoding="UTF-8"?>
<!--
  ~ Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">

	<!-- to keep the right formatting -->
	<xsl:output method="xml" indent="yes"/>
	<xsl:strip-space elements="*"/>

	<!-- copy all elements -->
	<xsl:template match="node() | @*">
		<!-- insert line breaks before comments -->
		<xsl:if test="self::comment()">
			<xsl:text>&#10;</xsl:text>
		</xsl:if>
		<xsl:copy>
			<xsl:apply-templates select="node() | @*"/>
		</xsl:copy>
		<!-- insert line breaks after comments -->
		<xsl:if test="self::comment()">
			<xsl:text>&#10;</xsl:text>
		</xsl:if>
	</xsl:template>

	<xsl:template match="permissions/role/rule[@regex='/.*']/allowed-permissions">
		<xsl:copy>
			<xsl:copy-of select="@*"/>
			<xsl:apply-templates/>
			<xsl:if test="ancestor::role[1]/rule/allowed-permissions/permission[text() = 'content_write'] or ancestor::role[1]/rule[not(@regex='/.*')]/allowed-permissions/permission[text() = 'cancel_publish']">
				<xsl:if test="not(permission = 'publish_cancel')">
					<xsl:element name="permission">
						<xsl:text>publish_cancel</xsl:text>
					</xsl:element>
				</xsl:if>
			</xsl:if>
			<xsl:if test="ancestor::role[1]/rule/allowed-permissions/permission[text() = 'publish']">
				<xsl:element name="permission">
					<xsl:text>publish_request</xsl:text>
				</xsl:element>
			</xsl:if>

			<xsl:if test="ancestor::role[1]/rule/allowed-permissions/permission[text() = 'publish'] or ancestor::role/@name = 'system_admin'">
				<xsl:if test="not(permission = 'publish_review')">
					<xsl:element name="permission">
						<xsl:text>publish_review</xsl:text>
					</xsl:element>
				</xsl:if>
			</xsl:if>
		</xsl:copy>
	</xsl:template>

	<xsl:template match="permissions/role/rule/allowed-permissions/permission">
		<xsl:choose>
			<xsl:when
			    test="text() = ('publish', 'cancel_publish', 'publish_by_commits', 'publish_clear_lock', 'rebuild_database')">
				<!-- Remove -->
			</xsl:when>
			<xsl:when test="text() = 'get_publishing_queue'">
				<xsl:element name="permission">
					<xsl:text>publish_get_queue</xsl:text>
				</xsl:element>
			</xsl:when>
			<xsl:otherwise>
				<xsl:copy>
					<xsl:copy-of select="@*"/>
					<xsl:apply-templates/>
				</xsl:copy>
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>
</xsl:stylesheet>
