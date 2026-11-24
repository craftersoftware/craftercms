<#macro layout
pageTitle=""
errorCode=""
errorTitle=pageTitle
errorMessage=""
stackTrace=""
paddedErrorMessage=false
>
	<!DOCTYPE html>
	<html lang="en" class="h-full bg-gray-100 dark:bg-neutral-900">
	<head>
		<title>${pageTitle}</title>
		<style>
			/*! tailwindcss v3.4.3 | MIT License | https://tailwindcss.com*/
			*, :after, :before {
				box-sizing: border-box;
				border: 0 solid #e5e7eb
			}

			:after, :before {
				--tw-content: ""
			}

			:host, html {
				line-height: 1.5;
				-webkit-text-size-adjust: 100%;
				-moz-tab-size: 4;
				-o-tab-size: 4;
				tab-size: 4;
				font-family: ui-sans-serif, system-ui, sans-serif, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji;
				font-feature-settings: normal;
				font-variation-settings: normal;
				-webkit-tap-highlight-color: transparent
			}

			body {
				margin: 0;
				line-height: inherit
			}

			hr {
				height: 0;
				color: inherit;
				border-top-width: 1px
			}

			abbr:where([title]) {
				-webkit-text-decoration: underline dotted;
				text-decoration: underline dotted
			}

			h1, h2, h3, h4, h5, h6 {
				font-size: inherit;
				font-weight: inherit
			}

			a {
				color: inherit;
				text-decoration: inherit
			}

			b, strong {
				font-weight: bolder
			}

			code, kbd, pre, samp {
				font-family: monospace;
				font-feature-settings: normal;
				font-variation-settings: normal;
				font-size: 1em
			}

			small {
				font-size: 80%
			}

			sub, sup {
				font-size: 75%;
				line-height: 0;
				position: relative;
				vertical-align: initial
			}

			sub {
				bottom: -.25em
			}

			sup {
				top: -.5em
			}

			table {
				text-indent: 0;
				border-color: inherit;
				border-collapse: collapse
			}

			button, input, optgroup, select, textarea {
				font-family: inherit;
				font-feature-settings: inherit;
				font-variation-settings: inherit;
				font-size: 100%;
				font-weight: inherit;
				line-height: inherit;
				letter-spacing: inherit;
				color: inherit;
				margin: 0;
				padding: 0
			}

			button, select {
				text-transform: none
			}

			button, input:where([type=button]), input:where([type=reset]), input:where([type=submit]) {
				-webkit-appearance: button;
				background-color: initial;
				background-image: none
			}

			:-moz-focusring {
				outline: auto
			}

			:-moz-ui-invalid {
				box-shadow: none
			}

			progress {
				vertical-align: initial
			}

			::-webkit-inner-spin-button, ::-webkit-outer-spin-button {
				height: auto
			}

			[type=search] {
				-webkit-appearance: textfield;
				outline-offset: -2px
			}

			::-webkit-search-decoration {
				-webkit-appearance: none
			}

			::-webkit-file-upload-button {
				-webkit-appearance: button;
				font: inherit
			}

			summary {
				display: list-item
			}

			blockquote, dd, dl, figure, h1, h2, h3, h4, h5, h6, hr, p, pre {
				margin: 0
			}

			fieldset {
				margin: 0
			}

			fieldset, legend {
				padding: 0
			}

			menu, ol, ul {
				list-style: none;
				margin: 0;
				padding: 0
			}

			dialog {
				padding: 0
			}

			textarea {
				resize: vertical
			}

			input::-moz-placeholder, textarea::-moz-placeholder {
				opacity: 1;
				color: #9ca3af
			}

			input::placeholder, textarea::placeholder {
				opacity: 1;
				color: #9ca3af
			}

			[role=button], button {
				cursor: pointer
			}

			:disabled {
				cursor: default
			}

			audio, canvas, embed, iframe, img, object, svg, video {
				display: block;
				vertical-align: middle
			}

			img, video {
				max-width: 100%;
				height: auto
			}

			[hidden] {
				display: none
			}

			*, ::backdrop, :after, :before {
				--tw-border-spacing-x: 0;
				--tw-border-spacing-y: 0;
				--tw-translate-x: 0;
				--tw-translate-y: 0;
				--tw-rotate: 0;
				--tw-skew-x: 0;
				--tw-skew-y: 0;
				--tw-scale-x: 1;
				--tw-scale-y: 1;
				--tw-pan-x: ;
				--tw-pan-y: ;
				--tw-pinch-zoom: ;
				--tw-scroll-snap-strictness: proximity;
				--tw-gradient-from-position: ;
				--tw-gradient-via-position: ;
				--tw-gradient-to-position: ;
				--tw-ordinal: ;
				--tw-slashed-zero: ;
				--tw-numeric-figure: ;
				--tw-numeric-spacing: ;
				--tw-numeric-fraction: ;
				--tw-ring-inset: ;
				--tw-ring-offset-width: 0px;
				--tw-ring-offset-color: #fff;
				--tw-ring-color: #3b82f680;
				--tw-ring-offset-shadow: 0 0 #0000;
				--tw-ring-shadow: 0 0 #0000;
				--tw-shadow: 0 0 #0000;
				--tw-shadow-colored: 0 0 #0000;
				--tw-blur: ;
				--tw-brightness: ;
				--tw-contrast: ;
				--tw-grayscale: ;
				--tw-hue-rotate: ;
				--tw-invert: ;
				--tw-saturate: ;
				--tw-sepia: ;
				--tw-drop-shadow: ;
				--tw-backdrop-blur: ;
				--tw-backdrop-brightness: ;
				--tw-backdrop-contrast: ;
				--tw-backdrop-grayscale: ;
				--tw-backdrop-hue-rotate: ;
				--tw-backdrop-invert: ;
				--tw-backdrop-opacity: ;
				--tw-backdrop-saturate: ;
				--tw-backdrop-sepia: ;
				--tw-contain-size: ;
				--tw-contain-layout: ;
				--tw-contain-paint: ;
				--tw-contain-style:
			}

			.mt-10 {
				margin-top: 2.5rem
			}

			.mt-4 {
				margin-top: 1rem
			}

			.mt-6 {
				margin-top: 1.5rem
			}

			.flex {
				display: flex
			}

			.grid {
				display: grid
			}

			.hidden {
				display: none
			}

			.h-full {
				height: 100%
			}

			.min-h-full {
				min-height: 100%
			}

			.max-w-full {
				max-width: 100%
			}

			.place-items-center {
				place-items: center
			}

			.items-center {
				align-items: center
			}

			.justify-center {
				justify-content: center
			}

			.gap-x-6 {
				-moz-column-gap: 1.5rem;
				column-gap: 1.5rem
			}

			.overflow-auto {
				overflow: auto
			}

			.rounded-md {
				border-radius: .375rem
			}

			.bg-gray-100 {
				--tw-bg-opacity: 1;
				background-color: rgb(243 244 246/var(--tw-bg-opacity))
			}

			.bg-gray-600 {
				--tw-bg-opacity: 1;
				background-color: rgb(75 85 99/var(--tw-bg-opacity))
			}

			.px-3 {
				padding-left: .75rem;
				padding-right: .75rem
			}

			.px-3\.5 {
				padding-left: .875rem;
				padding-right: .875rem
			}

			.px-6 {
				padding-left: 1.5rem;
				padding-right: 1.5rem
			}

			.py-2 {
				padding-top: .5rem;
				padding-bottom: .5rem
			}

			.py-2\.5 {
				padding-top: .625rem;
				padding-bottom: .625rem
			}

			.py-24 {
				padding-top: 6rem;
				padding-bottom: 6rem
			}

			.text-center {
				text-align: center
			}

			.font-mono {
				font-family: monospace
			}

			.text-3xl {
				font-size: 1.875rem;
				line-height: 2.25rem
			}

			.text-base {
				font-size: 1rem;
				line-height: 1.5rem
			}

			.text-sm {
				font-size: .875rem;
				line-height: 1.25rem
			}

			.font-bold {
				font-weight: 700
			}

			.font-semibold {
				font-weight: 600
			}

			.leading-7 {
				line-height: 1.75rem
			}

			.tracking-tight {
				letter-spacing: -.025em
			}

			.text-gray-500 {
				--tw-text-opacity: 1;
				color: rgb(107 114 128/var(--tw-text-opacity))
			}

			.text-gray-600 {
				--tw-text-opacity: 1;
				color: rgb(75 85 99/var(--tw-text-opacity))
			}

			.text-gray-900 {
				--tw-text-opacity: 1;
				color: rgb(17 24 39/var(--tw-text-opacity))
			}

			.text-white {
				--tw-text-opacity: 1;
				color: rgb(255 255 255/var(--tw-text-opacity))
			}

			.shadow-sm {
				--tw-shadow: 0 1px 2px 0 #0000000d;
				--tw-shadow-colored: 0 1px 2px 0 var(--tw-shadow-color);
				box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow)
			}

			.filter {
				filter: var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow)
			}

			.transition {
				transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, -webkit-backdrop-filter;
				transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter;
				transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter, -webkit-backdrop-filter;
				transition-timing-function: cubic-bezier(.4, 0, .2, 1);
				transition-duration: .15s
			}

			.hover\:bg-gray-500:hover {
				--tw-bg-opacity: 1;
				background-color: rgb(107 114 128/var(--tw-bg-opacity))
			}

			.focus-visible\:outline:focus-visible {
				outline-style: solid
			}

			.focus-visible\:outline-2:focus-visible {
				outline-width: 2px
			}

			.focus-visible\:outline-offset-2:focus-visible {
				outline-offset: 2px
			}

			.focus-visible\:outline-gray-600:focus-visible {
				outline-color: #4b5563
			}

			@media (min-width: 640px) {
				.sm\:py-32 {
					padding-top: 8rem;
					padding-bottom: 8rem
				}

				.sm\:text-5xl {
					font-size: 3rem;
					line-height: 1
				}
			}

			@media (min-width: 1024px) {
				.lg\:px-8 {
					padding-left: 2rem;
					padding-right: 2rem
				}
			}

			@media (prefers-color-scheme: dark) {
				.dark\:bg-neutral-900 {
					--tw-bg-opacity: 1;
					background-color: rgb(23 23 23/var(--tw-bg-opacity))
				}

				.dark\:text-gray-300 {
					--tw-text-opacity: 1;
					color: rgb(209 213 219/var(--tw-text-opacity))
				}

				.dark\:text-gray-400 {
					--tw-text-opacity: 1;
					color: rgb(156 163 175/var(--tw-text-opacity))
				}

				.dark\:text-white {
					--tw-text-opacity: 1;
					color: rgb(255 255 255/var(--tw-text-opacity))
				}
			}
		</style>
		<#-- Styles for expand/collapse functionallity -->
		<style>
			#stackTraceContent {
				max-height: 0px;
				transition: max-height .5s cubic-bezier(0, 1, 0, 1);;
			}

			#stackTraceContent.show {
				max-height: 1000em;
				transition: max-height .5s ease-in-out;
			}

			.padded-message {
				text-align: left;
				padding-left: 25%;
				padding-right: 15%;
			}
		</style>
	</head>
	<body>
	<main class="grid min-h-full place-items-center px-6 py-24 sm:py-32 lg:px-8">
		<div class="text-center">
			<p class="text-base font-semibold text-gray-500 dark:text-gray-400">${errorCode}</p>
			<h1 class="mt-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">${errorTitle!pageTitle}</h1>
			<p class="mt-6 text-base leading-7 text-gray-600 dark:text-gray-300 <#if paddedErrorMessage>padded-message</#if>">${errorMessage}</p>
			<div class="mt-10 flex items-center justify-center gap-x-6">
				<a href="/" class="rounded-md bg-gray-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600">Go back home</a>
				<a href="mailto:" class="text-sm font-semibold text-gray-900 dark:text-white">Contact support <span aria-hidden="true">&rarr;</span></a>
			</div>
		</div>
		<#if modePreview && stackTrace?has_content>
			<div class="text-sm font-semibold text-gray-900 dark:text-white mt-10">
				<a href="#" id="stackTraceToggleButton">Expand stack trace</a>
			</div>
			<div id="stackTraceContent" class="mt-10 max-w-full overflow-auto">
				<pre class="stackTrace text-gray-900 dark:text-white font-mono">${stackTrace}</pre>
			</div>
		</#if>
	</main>
	<script>
		const toggleButton = document.getElementById('stackTraceToggleButton');
		const stackTraceContent = document.getElementById('stackTraceContent');
		if (stackTraceContent) {
			toggleButton.addEventListener('click', (e) => {
				e.preventDefault();
				const currentlyShowing = stackTraceContent.classList.contains('show');
				if (currentlyShowing) {
					stackTraceContent.classList.remove('show');
					toggleButton.innerText = 'Expand stack trace';
				} else {
					stackTraceContent.classList.add('show');
					toggleButton.innerText = 'Collapse stack trace';
				}
			});
		}
	</script>

	<script defer src="/studio/static-assets/scripts/craftercms-xb.umd.js"></script>
	<script>
		document.addEventListener('craftercms.xb:loaded', () => {
			window.craftercms.xb.post('ERROR_PAGE_CHECK_IN', {code: ${errorCode}, message: "${errorMessage}"});
		});
	</script>
	</body>
	</html>
</#macro>
