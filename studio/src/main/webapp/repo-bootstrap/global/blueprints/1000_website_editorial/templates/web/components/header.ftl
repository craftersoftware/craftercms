<#import "/templates/system/common/crafter.ftl" as crafter />

<@crafter.header id="header">
  <a href="/" class="logo">
    <#--
    TODO/FYI For docs...
    While using the macro, for whatever reason, doing src=(contentModel.logo_s!"") works
    but doing src="${contentModel.logo_text_t!""}" doesn't. Inversely on loops, $index="${item?index}"
    works whilst  $index=(item?index) doesn't.
    -->
    <@crafter.img $field="logo_s,logo_text_t" src=(contentModel.logo_s!"") alt=(contentModel.logo_text_t!"") border=0 />
    <#if profile??>
      <#assign name = profile.attributes.name!profile.username!"stranger" />
    <#else>
      <#assign name = "stranger" />
    </#if>
    Howdy, ${name}
  </a>
  <@crafter.renderComponentCollection $field="socialMediaWidget_o" />
</@crafter.header>
