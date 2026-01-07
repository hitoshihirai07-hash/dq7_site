import { renderHeader } from "./layout.js";

export function boot(pageTitle){
  renderHeader({});
  if (pageTitle) document.title = pageTitle;
}
