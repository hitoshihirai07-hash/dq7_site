import { initGlobalSearch } from "./global_search.js";
import { renderHeader } from "./layout.js";

export function boot(pageTitle){
  renderHeader({});
  initGlobalSearch();
  if (pageTitle) document.title = pageTitle;
}
