<#import "/templates/system/common/crafter.ftl" as crafter />

<@crafter.section>
	<header class="major">
            <@crafter.h2 $field="title_t">${contentModel.title_t}</@crafter.h2>
	</header>
    <@crafter.div $field="text_html">
        ${contentModel.text_html}
    </@crafter.div>
	<ul class="contact">
		<li class="icon solid fa-envelope">
                    <@crafter.a href="mailto:${contentModel.email_s}" $field="email_s">${contentModel.email_s}</@crafter.a>
		</li>
            <@crafter.li class="icon solid fa-phone" $field="phone_s">
                ${contentModel.phone_s}
            </@crafter.li>
            <@crafter.li class="icon solid fa-home" $field="address_html">
                ${contentModel.address_html}
            </@crafter.li>
	</ul>
</@crafter.section>
