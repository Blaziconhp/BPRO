import { directApi } from './direct-runtime.mjs';

window.BPRO_DIRECT_API = directApi;
const app = document.createElement('script');
app.src = new URL('./app.js', document.baseURI).href;
app.defer = true;
app.onerror = () => {
  const root = document.getElementById('root');
  if (root) root.textContent = 'BPRO could not load. Refresh the page or contact the project owner.';
};
document.body.append(app);
