import type { DomRefs } from "./admin_dom.js";

export type AdminViewRouter = {
  init(): void;
  setActiveView(viewName: string): void;
};

type ViewHandlers = {
  onTargetAudiences?(): void;
  onEasyRead?(): void;
  onOrdlista?(): void;
};

export function initAdminViewRouter(
  refs: DomRefs,
  handlers: ViewHandlers,
): AdminViewRouter {
  const init = (): void => {
    refs.viewInputs.forEach((input) => {
      input.addEventListener("change", () => {
        const view = input.dataset.viewTarget;
        if (view && input.checked) {
          setActiveView(view);
        }
      });
    });
  };

  const setActiveView = (viewName: string): void => {
    setVisibleView(refs, viewName);
    setCheckedInput(refs, viewName);
    runViewHandler(viewName);
  };

  function runViewHandler(viewName: string): void {
    if (viewName === "target-audiences") handlers.onTargetAudiences?.();
    if (viewName === "easy-to-read") handlers.onEasyRead?.();
    if (viewName === "ordlista") handlers.onOrdlista?.();
  }

  return { init, setActiveView };
}

function setVisibleView(refs: DomRefs, viewName: string): void {
  refs.views.forEach((view) => {
    if (view.getAttribute("data-view") === viewName) {
      view.removeAttribute("hidden");
    } else {
      view.setAttribute("hidden", "");
    }
  });
}

function setCheckedInput(refs: DomRefs, viewName: string): void {
  refs.viewInputs.forEach((input) => {
    input.checked = input.dataset.viewTarget === viewName;
  });
}
