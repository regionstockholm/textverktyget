import type { DomRefs } from "./admin_dom.js";

export type AdminViewRouter = {
  init(): void;
  setActiveView(viewName: string): void;
};

type ViewHandlers = {
  onTargetAudiences?(): void;
  onOrdlista?(): void;
  onUsers?(): void;
  onSubmissionLog?(): void;
};

export function initAdminViewRouter(
  refs: DomRefs,
  handlers: ViewHandlers,
): AdminViewRouter {
  const init = (): void => {
    refs.viewInputs.forEach((link) => {
      link.addEventListener("click", (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        const view = link.dataset.viewTarget;
        if (view) {
          if (window.location.hash !== `#${view}`) window.history.pushState(null, "", `#${view}`);
          setActiveView(view);
          document.getElementById("admin-content")?.focus();
        }
      });
    });
    // Fragment changes also fire when navigating back/forward through sidebar links.
    // Listening only once avoids running lazy loaders twice for a history change.
    window.addEventListener("hashchange", () => {
      if (window.location.hash !== "#admin-content") setActiveView(window.location.hash.slice(1) || "prompts");
    });
    document.querySelector<HTMLAnchorElement>(".admin-skip-link")?.addEventListener("click", (event) => {
      event.preventDefault();
      document.getElementById("admin-content")?.focus();
    });
    const toggle = document.getElementById("admin-menu-toggle");
    toggle?.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      document.getElementById("admin-navigation")?.classList.toggle("is-open", open);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && toggle?.getAttribute("aria-expanded") === "true") {
        closeMenu();
        toggle.focus();
      }
    });
  };

  const setActiveView = (viewName: string): void => {
    const link = Array.from(refs.viewInputs).find((item) => item.dataset.viewTarget === viewName && !item.closest("[hidden], .hidden"));
    if (!link) viewName = "prompts";
    setVisibleView(refs, viewName);
    setActiveLink(refs, viewName);
    const title = document.getElementById("admin-page-title");
    const activeLink = Array.from(refs.viewInputs).find((item) => item.dataset.viewTarget === viewName);
    if (title) title.textContent = activeLink?.textContent || "Adminpanel";
    const descriptions: Record<string, string> = {
      prompts: "Hantera textverktygets regler och instruktioner.",
      tasks: "Hantera uppgifter, funktioner och uppgiftsspecifika prompter.",
      "target-audiences": "Hantera kategorier och anpassningar för olika målgrupper.",
      genai: "Konfigurera AI-provider, modell och kvalitetsinställningar.",
      ordlista: "Hantera ord och uttryck som ska ersättas i texten.",
      users: "Hantera konton som har åtkomst till textverktyget.",
      "submission-log": "Hantera lagringstid och export av inskickade texter.",
      backup: "Exportera inställningar eller återställ från en backup.",
    };
    const description = document.getElementById("admin-page-description");
    if (description) description.textContent = descriptions[viewName] || "Hantera inställningar för textverktyget.";
    closeMenu();
    runViewHandler(viewName);
  };

  function closeMenu(): void {
    document.getElementById("admin-menu-toggle")?.setAttribute("aria-expanded", "false");
    document.getElementById("admin-navigation")?.classList.remove("is-open");
  }

  function runViewHandler(viewName: string): void {
    if (viewName === "target-audiences") handlers.onTargetAudiences?.();
    if (viewName === "ordlista") handlers.onOrdlista?.();
    if (viewName === "users") handlers.onUsers?.();
    if (viewName === "submission-log") handlers.onSubmissionLog?.();
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

function setActiveLink(refs: DomRefs, viewName: string): void {
  refs.viewInputs.forEach((input) => {
    if (input.dataset.viewTarget === viewName) input.setAttribute("aria-current", "page");
    else input.removeAttribute("aria-current");
  });
}
