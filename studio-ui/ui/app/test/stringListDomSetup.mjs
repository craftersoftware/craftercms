import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
const { window } = dom;

function install(name, value) {
	try {
		Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
	} catch {
		// Node already exposes a non-configurable global (for example navigator).
	}
}

install('window', window);
install('document', window.document);
install('navigator', window.navigator);
install('HTMLElement', window.HTMLElement);
install('HTMLInputElement', window.HTMLInputElement);
install('HTMLButtonElement', window.HTMLButtonElement);
install('Node', window.Node);
install('Element', window.Element);
install('DocumentFragment', window.DocumentFragment);
install('SVGElement', window.SVGElement);
install('getComputedStyle', window.getComputedStyle.bind(window));
install('requestAnimationFrame', (callback) => setTimeout(() => callback(Date.now()), 0));
install('cancelAnimationFrame', (id) => clearTimeout(id));
install('IS_REACT_ACT_ENVIRONMENT', true);

window.HTMLElement.prototype.scrollIntoView = () => {};
