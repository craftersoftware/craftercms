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
        <xsl:copy>
            <xsl:copy-of select="@*"/>
            <xsl:apply-templates select="node() | @*"/>
        </xsl:copy>
    </xsl:template>

    <xsl:template match="/permissions/role[not(rule[@regex='.*'])]">
        <xsl:copy>
            <xsl:copy-of select="@*"/>
            <xsl:apply-templates/>
            <xsl:element name="rule">
                <xsl:attribute name="regex">
                    <xsl:text>.*</xsl:text>
                </xsl:attribute>
                <xsl:element name="allowed-permissions">
                    <xsl:if test="rule/allowed-permissions/permission[text() = 'cancel_publish' or text() = 'content_write']">
                        <xsl:element name="permission">
                            <xsl:text>publish_cancel</xsl:text>
                        </xsl:element>
                    </xsl:if>
                    <xsl:if test="not(permission = 'publish_get_queue' or permission = 'get_publishing_queue')">
                        <xsl:element name="permission">
                            <xsl:text>publish_get_queue</xsl:text>
                        </xsl:element>
                    </xsl:if>
                </xsl:element>
            </xsl:element>
        </xsl:copy>
    </xsl:template>

    <!--
        Add publish_cancel if content_write exists
        Move publish-related permissions to '.*' rule
      -->
    <xsl:template match="/permissions/role/rule[@regex='.*']/allowed-permissions">
        <xsl:copy>
            <xsl:copy-of select="@*"/>
            <xsl:apply-templates/>
            <xsl:if test="ancestor::role[1]/rule/allowed-permissions/permission[text() = 'content_write'] or ancestor::role[1]/rule[not(@regex='.*')]/allowed-permissions/permission[text() = 'cancel_publish']">
                <xsl:if test="not(permission[text() = ('cancel_publish', 'publish_cancel')])">
                    <xsl:element name="permission">
                        <xsl:text>publish_cancel</xsl:text>
                    </xsl:element>
                </xsl:if>
            </xsl:if>
            <xsl:choose>
                <xsl:when test="ancestor::role[@name='author']">
                    <xsl:apply-templates select="self::node()" mode="author"/>
                </xsl:when>
                <xsl:when test="ancestor::role[@name='publisher']">
                    <xsl:apply-templates select="self::node()" mode="publisher"/>
                </xsl:when>
                <xsl:when test="ancestor::role[@name='reviewer']">
                    <xsl:apply-templates select="self::node()" mode="reviewer"/>
                </xsl:when>
                <xsl:when test="ancestor::role[@name='admin']">
                    <xsl:apply-templates select="self::node()" mode="admin"/>
                </xsl:when>
                <xsl:when test="ancestor::role[@name='developer']">
                    <xsl:apply-templates select="self::node()" mode="developer"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:if test="ancestor::role[1]/rule/allowed-permissions/permission[text() = 'publish']">
                        <xsl:element name="permission">
                            <xsl:text>publish_request</xsl:text>
                        </xsl:element>
                        <xsl:element name="permission">
                            <xsl:text>publish_review</xsl:text>
                        </xsl:element>
                    </xsl:if>
                </xsl:otherwise>
            </xsl:choose>
            <xsl:if test="not(permission = 'publish_get_queue' or permission = 'get_publishing_queue')">
                <xsl:element name="permission">
                    <xsl:text>publish_get_queue</xsl:text>
                </xsl:element>
            </xsl:if>
        </xsl:copy>
    </xsl:template>

    <!-- Add permissions to author role -->
    <xsl:template match="allowed-permissions" mode="author">
        <xsl:if test="not(permission = 'publish_request')">
            <xsl:element name="permission">
                <xsl:text>publish_request</xsl:text>
            </xsl:element>
        </xsl:if>
    </xsl:template>

    <!-- Add permissions to publisher role -->
    <xsl:template match="allowed-permissions" mode="publisher">
        <xsl:if test="not(permission = 'publish_request')">
            <xsl:element name="permission">
                <xsl:text>publish_request</xsl:text>
            </xsl:element>
        </xsl:if>
        <xsl:if test="not(permission = 'publish_review')">
            <xsl:element name="permission">
                <xsl:text>publish_review</xsl:text>
            </xsl:element>
        </xsl:if>
    </xsl:template>

    <!-- Add permissions to reviewer role -->
    <xsl:template match="allowed-permissions" mode="reviewer">
        <xsl:if test="not(permission = 'publish_review')">
            <xsl:element name="permission">
                <xsl:text>publish_review</xsl:text>
            </xsl:element>
        </xsl:if>
    </xsl:template>

    <!-- Add permissions to admin role -->
    <xsl:template match="allowed-permissions" mode="admin">
        <xsl:if test="not(permission = 'publish_request')">
            <xsl:element name="permission">
                <xsl:text>publish_request</xsl:text>
            </xsl:element>
        </xsl:if>
        <xsl:if test="not(permission = 'publish_review')">
            <xsl:element name="permission">
                <xsl:text>publish_review</xsl:text>
            </xsl:element>
        </xsl:if>
    </xsl:template>

    <!-- Add permissions to developer role -->
    <xsl:template match="allowed-permissions" mode="developer">
        <xsl:if test="not(permission = 'publish_request')">
            <xsl:element name="permission">
                <xsl:text>publish_request</xsl:text>
            </xsl:element>
        </xsl:if>
    </xsl:template>

    <!--
        Permission renames
        Remove publish_by_commits
        Drop publish-related permissions from rules other than '.*'
        Drop old unused permissions
     -->
    <xsl:template match="permissions/role/rule/allowed-permissions/permission">
        <xsl:choose>
            <xsl:when test="text() = 'cancel_publish'">
                <xsl:if test="not(ancestor::role[@name = 'reviewer']) and ancestor::rule[@regex='.*']">
                    <xsl:element name="permission">
                        <xsl:text>publish_cancel</xsl:text>
                    </xsl:element>
                </xsl:if>
            </xsl:when>
            <xsl:when test="text() = 'get_publishing_queue'">
                <xsl:element name="permission">
                    <xsl:text>publish_get_queue</xsl:text>
                </xsl:element>
            </xsl:when>
            <xsl:when test="text() = ('publish', 'publish_by_commits', 'publish_clear_lock', 'rebuild_database')">
                <!-- Remove -->
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
